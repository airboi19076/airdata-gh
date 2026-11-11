
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const reference = String(req.query?.reference || '').trim();

  if (!/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)) {
    return res.status(400).json({ error: 'Invalid order reference.' });
  }

  const apiKey = (process.env.KINGFLEXY_API_KEY || '').replace(/\s+/g, '');

  if (!apiKey) {
    return res.status(500).json({
      error: 'KiNG FLEXY API key is not configured.'
    });
  }

  try {
    const sql = await getDatabase();

    const orders = await sql`
      SELECT reference, network, volume_gb, recipient, status
      FROM public.data_orders
      WHERE reference = ${reference}
        AND user_id = ${user.id}::uuid
      LIMIT 1
    `;

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const response = await fetch(
      `https://api.kingflexygh.com/api/v2/orders/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          Accept: 'application/json'
        }
      }
    );

    const result = await response.json();

    if (!response.ok || result.success !== true || !result.data) {
      return res.status(502).json({
        error: 'Could not confirm the supplier order status. Please try again.'
      });
    }

    const data = result.data;
    const supplierStatus = String(data.status || '').toLowerCase();

    const allowedStatuses = [
      'pending',
      'queued',
      'blacklisted',
      'processing',
      'completed',
      'failed',
      'refunded'
    ];

    if (!allowedStatuses.includes(supplierStatus)) {
      return res.status(502).json({
        error: 'The supplier returned an unrecognized order status.'
      });
    }

    if (supplierStatus === 'refunded') {
      // Credit the customer's wallet only once, after the supplier
      // confirms that the order has actually been refunded.
      await sql`
        WITH order_update AS (
          UPDATE public.data_orders
          SET status = 'refunded',
              supplier_status = 'refunded',
              supplier_order_id = COALESCE(
                ${data.order_id || null},
                supplier_order_id
              ),
              supplier_response = ${JSON.stringify(data)}::jsonb,
              updated_at = now()
          WHERE reference = ${reference}
            AND user_id = ${user.id}::uuid
            AND status <> 'refunded'
          RETURNING reference
        ),
        ledger_refund AS (
          UPDATE public.wallet_transactions AS wt
          SET status = 'refunded',
              updated_at = now()
          FROM order_update AS ou
          WHERE wt.reference = ou.reference
            AND wt.user_id = ${user.id}::uuid
            AND wt.provider = 'kingflexy'
            AND wt.status = 'success'
          RETURNING wt.user_id, wt.amount_pesewas
        ),
        wallet_credit AS (
          INSERT INTO public.wallets (user_id, balance_pesewas)
          SELECT user_id, amount_pesewas
          FROM ledger_refund
          ON CONFLICT (user_id) DO UPDATE
          SET balance_pesewas =
            public.wallets.balance_pesewas + EXCLUDED.balance_pesewas,
            updated_at = now()
          RETURNING balance_pesewas
        )
        SELECT balance_pesewas FROM wallet_credit
      `;
    } else {
      await sql`
        UPDATE public.data_orders
        SET status = ${supplierStatus},
            supplier_status = ${supplierStatus},
            supplier_order_id = COALESCE(
              ${data.order_id || null},
              supplier_order_id
            ),
            supplier_response = ${JSON.stringify(data)}::jsonb,
            updated_at = now()
        WHERE reference = ${reference}
          AND user_id = ${user.id}::uuid
          AND status <> 'refunded'
      `;
    }

    const walletRows = await sql`
      SELECT balance_pesewas
      FROM public.wallets
      WHERE user_id = ${user.id}::uuid
    `;

    let message = 'Your order is being processed.';

    if (supplierStatus === 'completed') {
      message = 'Your data bundle has been delivered successfully.';
    } else if (supplierStatus === 'refunded') {
      message = 'Your order was refunded to your AirData GH wallet.';
    } else if (supplierStatus === 'failed') {
      message = 'The supplier marked this order as failed. Please contact support to review your refund.';
    } else if (supplierStatus === 'blacklisted') {
      message = 'Your order is on hold with the supplier.';
    } else if (supplierStatus === 'queued') {
      message = 'Your order is queued and waiting for processing.';
    }

    return res.status(200).json({
      success: true,
      reference,
      status: supplierStatus,
      balance: Number(walletRows[0]?.balance_pesewas || 0) / 100,
      message
    });

  } catch (error) {
    console.error('Order status check failed:', error.message);

    return res.status(500).json({
      error: 'Could not check this order. Please try again.'
    });
  }
}
