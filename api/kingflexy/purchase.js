
import { requireUser, getDatabase } from '../_lib/wallet.js';

const RETAIL_PRICES = {
  MTN: {
    1: 475, 2: 950, 3: 1425, 4: 1900, 5: 2375,
    6: 2850, 8: 3800, 10: 4750, 15: 7125,
    20: 9300, 25: 11625, 30: 13950, 40: 18600, 50: 23250
  },
  AirtelTigo: {
    1: 430, 2: 860, 3: 1290, 4: 1720, 5: 2150,
    6: 2580, 7: 3010, 8: 3440, 10: 4300,
    15: 6450, 20: 8600
  },
  Telecel: {
    10: 4200, 15: 6300, 20: 8400, 25: 10500,
    30: 12600, 40: 16800, 50: 21000
  }
};

const SUPPLIER_NETWORK = {
  MTN: 'MTN',
  AirtelTigo: 'AT-iShare',
  Telecel: 'Telecel'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const network = String(req.body?.network || '');
  const volume = Number(req.body?.volume_gb);
  const recipient = String(req.body?.recipient || '').trim();
  const reference = String(req.body?.reference || '').trim();

  if (
    !SUPPLIER_NETWORK[network] ||
    !Number.isFinite(volume) ||
    !/^0\d{9}$/.test(recipient) ||
    !/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)
  ) {
    return res.status(400).json({
      error: 'Please check the network, bundle, phone number and order reference.'
    });
  }

  const pricePesewas = RETAIL_PRICES[network]?.[volume];

  if (!pricePesewas) {
    return res.status(400).json({
      error: 'This bundle is not available.'
    });
  }

  const apiKey = (process.env.KINGFLEXY_API_KEY || '').replace(/\s+/g, '');

  if (!apiKey) {
    return res.status(500).json({
      error: 'KiNG FLEXY API key is not configured.'
    });
  }

  try {
    const sql = await getDatabase();

    // Reusing a reference must never create another customer debit.
    const existing = await sql`
      SELECT reference, network, volume_gb, recipient, status
      FROM public.data_orders
      WHERE reference = ${reference}
        AND user_id = ${user.id}::uuid
      LIMIT 1
    `;

    if (existing.length) {
      const order = existing[0];

      if (
        order.network !== network ||
        Number(order.volume_gb) !== volume ||
        order.recipient !== recipient
      ) {
        return res.status(409).json({
          error: 'This order reference was already used for different details.'
        });
      }

      return res.status(200).json({
        success: true,
        reference,
        status: order.status,
        message: 'This order has already been submitted.'
      });
    }

    // Reserve the customer's money before contacting the supplier.
    const reserved = await sql`
      WITH debit AS (
        UPDATE public.wallets
        SET balance_pesewas = balance_pesewas - ${pricePesewas},
            updated_at = now()
        WHERE user_id = ${user.id}::uuid
          AND balance_pesewas >= ${pricePesewas}
        RETURNING user_id
      ),
      new_order AS (
        INSERT INTO public.data_orders (
          user_id, reference, network, volume_gb, recipient,
          retail_price_pesewas, status
        )
        SELECT
          user_id, ${reference}, ${network}, ${volume},
          ${recipient}, ${pricePesewas}, 'initiated'
        FROM debit
        RETURNING user_id, reference
      ),
      ledger AS (
        INSERT INTO public.wallet_transactions (
          user_id, amount_pesewas, currency, status,
          provider, reference, description
        )
        SELECT
          user_id, ${pricePesewas}, 'GHS', 'success',
          'kingflexy', ${reference},
          ${`Data purchase: ${network} ${volume}GB to ${recipient}`}
        FROM new_order
        RETURNING reference
      )
      SELECT reference FROM ledger
    `;

    if (!reserved.length) {
      return res.status(402).json({
        error: 'Insufficient wallet balance. Please deposit and try again.'
      });
    }

    // Submit the order using the same unique reference.
    // A timeout is treated as pending, never as an automatic refund.
    try {
      const supplierResponse = await fetch(
        'https://api.kingflexygh.com/api/v2/data/purchase',
        {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            network: SUPPLIER_NETWORK[network],
            volume_gb: volume,
            recipient,
            reference
          })
        }
      );

      const supplierResult = await supplierResponse.json();

      if (supplierResponse.ok && supplierResult.success === true) {
        const data = supplierResult.data || {};

        await sql`
          UPDATE public.data_orders
          SET status = ${data.status || 'pending'},
              supplier_status = ${data.status || 'pending'},
              supplier_order_id = ${data.order_id || null},
              supplier_response = ${JSON.stringify(data)}::jsonb,
              updated_at = now()
          WHERE reference = ${reference}
            AND user_id = ${user.id}::uuid
        `;

        const balanceRows = await sql`
          SELECT balance_pesewas
          FROM public.wallets
          WHERE user_id = ${user.id}::uuid
        `;

        return res.status(200).json({
          success: true,
          reference,
          status: data.status || 'pending',
          balance: Number(balanceRows[0]?.balance_pesewas || 0) / 100,
          message: 'Your order has been submitted.'
        });
      }

      // Keep the order reserved until the status endpoint confirms
      // whether KiNG FLEXY accepted it or rejected it.
      await sql`
        UPDATE public.data_orders
        SET supplier_response = ${JSON.stringify(supplierResult)}::jsonb,
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
          AND user_id = ${user.id}::uuid
      `;

      return res.status(202).json({
        success: true,
        reference,
        status: 'pending',
        message: 'Your order is awaiting supplier confirmation.'
      });

    } catch (supplierError) {
      console.error('KiNG FLEXY request outcome is uncertain.');

      return res.status(202).json({
        success: true,
        reference,
        status: 'pending',
        message: 'Your order is being checked. Please do not submit it again.'
      });
    }

  } catch (error) {
    console.error('Data purchase error:', error.message);

    return res.status(500).json({
      error: 'Could not process your order. Please contact support.'
    });
  }
}
