
import { timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../_lib/wallet.js';

function moneyToPesewas(value) {
  const text = String(value ?? '');

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const [cedis, pesewas = ''] = text.split('.');
  return Number(cedis) * 100 + Number(pesewas.padEnd(2, '0'));
}

function validSecret(received, expected) {
  if (typeof received !== 'string' || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
  const accountNumber = process.env.MOOLRE_ACCOUNT_NUMBER;

  if (!expectedSecret || !accountNumber) {
    return res.status(500).json({ error: 'Callback configuration is incomplete.' });
  }

  const payload = req.body;
  const data = payload?.data;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid callback payload.' });
  }

  if (!validSecret(data.secret, expectedSecret)) {
    return res.status(401).json({ error: 'Invalid callback secret.' });
  }

  const reference = String(data.externalref || '').trim();

  if (
    !reference ||
    String(data.accountnumber || '').trim() !== String(accountNumber).trim()
  ) {
    return res.status(400).json({ error: 'Invalid payment reference or account.' });
  }

  try {
    const sql = await getDatabase();

    const orders = await sql`
      SELECT *
      FROM public.guest_data_orders
      WHERE reference = ${reference}
        AND payment_provider = 'moolre'
      LIMIT 1
    `;

    const order = orders[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (
      Number(payload.status) === 0 &&
      payload.code === 'P02' &&
      Number(data.txstatus) === 2
    ) {
      await sql`
        UPDATE public.guest_data_orders
        SET payment_status = 'failed',
            status = 'payment_failed',
            payment_response = ${JSON.stringify(payload)}::jsonb,
            updated_at = now()
        WHERE reference = ${reference}
          AND payment_status = 'pending'
          AND status = 'awaiting_payment'
      `;

      return res.status(200).json({
        received: true,
        message: 'Failed payment recorded.'
      });
    }

    if (
      Number(payload.status) !== 1 ||
      payload.code !== 'P01' ||
      Number(data.txstatus) !== 1
    ) {
      return res.status(200).json({
        received: true,
        message: 'No successful payment action taken.'
      });
    }

    const callbackAmount = moneyToPesewas(data.amount);

    if (
      callbackAmount === null ||
      callbackAmount !== Number(order.retail_price_pesewas)
    ) {
      return res.status(400).json({
        error: 'Payment amount does not match this order.'
      });
    }

    if (!data.transactionid) {
      return res.status(400).json({
        error: 'Payment transaction ID is missing.'
      });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({
        received: true,
        already_processed: true
      });
    }

    const claimed = await sql`
      UPDATE public.guest_data_orders
      SET payment_status = 'paid',
          payment_provider_reference = ${String(data.transactionid)},
          payment_response = ${JSON.stringify(payload)}::jsonb,
          status = 'submitting',
          supplier_status = 'submitting',
          updated_at = now()
      WHERE reference = ${reference}
        AND payment_status = 'pending'
        AND status = 'awaiting_payment'
        AND retail_price_pesewas = ${callbackAmount}
      RETURNING reference, network, volume_gb, recipient
    `;

    if (!claimed.length) {
      return res.status(200).json({
        received: true,
        message: 'Order was already processed or is no longer pending.'
      });
    }

    const paidOrder = claimed[0];
    const apiKey = (process.env.KINGFLEXY_API_KEY || '').replace(/\s+/g, '');

    if (!apiKey) {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        payment_confirmed: true,
        message: 'Payment confirmed. Awaiting supplier configuration.'
      });
    }

    const networkMap = {
      MTN: 'MTN',
      'AirtelTigo iShare': 'AT-iShare',
      'AirtelTigo BigTime': 'AT-BigTime',
      Telecel: 'Telecel'
    };

    const supplierNetwork = networkMap[paidOrder.network];

    if (!supplierNetwork) {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        payment_confirmed: true,
        message: 'Payment confirmed. Order requires supplier review.'
      });
    }

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
            network: supplierNetwork,
            volume_gb: Number(paidOrder.volume_gb),
            recipient: paidOrder.recipient,
            reference
          })
        }
      );

      let supplierResult;

      try {
        supplierResult = await supplierResponse.json();
      } catch {
        supplierResult = null;
      }

      if (
        supplierResponse.ok &&
        supplierResult?.success === true &&
        supplierResult?.data
      ) {
        const supplierData = supplierResult.data;
        const allowedStatuses = [
          'pending',
          'queued',
          'blacklisted',
          'processing',
          'completed',
          'failed',
          'refunded'
        ];

        const returnedStatus = String(
          supplierData.status || 'pending'
        ).toLowerCase();

        const supplierStatus = allowedStatuses.includes(returnedStatus)
          ? returnedStatus
          : 'pending';

        await sql`
          UPDATE public.guest_data_orders
          SET status = ${supplierStatus},
              supplier_status = ${supplierStatus},
              supplier_order_id = ${
                supplierData.order_id
                  ? String(supplierData.order_id)
                  : null
              },
              supplier_response = ${JSON.stringify(supplierData)}::jsonb,
              updated_at = now()
          WHERE reference = ${reference}
            AND payment_status = 'paid'
        `;
      } else {
        await sql`
          UPDATE public.guest_data_orders
          SET status = 'processing',
              supplier_status = 'awaiting_confirmation',
              supplier_response = ${JSON.stringify(
                supplierResult || {
                  error: 'Supplier returned an unreadable response.'
                }
              )}::jsonb,
              updated_at = now()
          WHERE reference = ${reference}
            AND payment_status = 'paid'
        `;
      }
    } catch (supplierError) {
      console.error('KiNG FLEXY purchase error:', supplierError.message);

      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
          AND payment_status = 'paid'
      `;
    }

    return res.status(200).json({
      received: true,
      payment_confirmed: true,
      message: 'Payment confirmation processed.'
    });

  } catch (error) {
    console.error('Guest payment callback failed:', error.message);

    return res.status(500).json({
      error: 'Could not process payment notification.'
    });
  }
}
