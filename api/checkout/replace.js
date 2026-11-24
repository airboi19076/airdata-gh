import { randomUUID } from 'node:crypto';
import { getDatabase } from '../_lib/wallet.js';

const NETWORK_MAP = {
  MTN: 'MTN',
  'AirtelTigo iShare': 'AT-iShare',
  'AirtelTigo BigTime': 'AT-BigTime',
  Telecel: 'Telecel'
};

const ALLOWED_STATUSES = [
  'pending', 'queued', 'blacklisted', 'processing',
  'completed', 'failed', 'refunded'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const reference = String(req.body?.reference || '').trim();

  if (!/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)) {
    return res.status(400).json({ error: 'Invalid order reference.' });
  }

  const mode = String(process.env.PAYSTACK_MODE || 'test').toLowerCase();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supplierKey = (process.env.KINGFLEXY_API_KEY || '').replace(/\s+/g, '');

  if (mode !== 'live' || !secretKey?.startsWith('sk_live_')) {
    return res.status(403).json({
      error: 'Only genuine live payments qualify for a free replacement.'
    });
  }

  if (!supplierKey) {
    return res.status(503).json({
      error: 'Supplier connection is unavailable.'
    });
  }

  try {
    const sql = await getDatabase();

    const rows = await sql`
      SELECT
        reference, network, volume_gb, recipient,
        retail_price_pesewas, payment_status, payment_provider,
        replacement_reference, replacement_status
      FROM public.guest_data_orders
      WHERE reference = ${reference}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: 'Original order not found.' });
    }

    const order = rows[0];

    if (
      order.payment_provider !== 'paystack' ||
      order.payment_status !== 'paid'
    ) {
      return res.status(409).json({
        error: 'The original payment is not confirmed as successful.'
      });
    }

    if (order.replacement_reference) {
      return res.status(200).json({
        success: true,
        already_replaced: true,
        reference,
        replacement_reference: order.replacement_reference,
        replacement_status: order.replacement_status || 'processing',
        message: 'A replacement has already been requested. You will not be charged again.'
      });
    }

    // Independently verify the original payment with Paystack.
    const paymentResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: 'application/json'
        }
      }
    );

    const paymentResult = await paymentResponse.json();
    const payment = paymentResult?.data;

    if (
      !paymentResponse.ok ||
      paymentResult?.status !== true ||
      payment?.status !== 'success' ||
      payment?.reference !== reference ||
      payment?.currency !== 'GHS' ||
      Number(payment?.amount) !== Number(order.retail_price_pesewas)
    ) {
      return res.status(409).json({
        error: 'Paystack could not confirm the original successful payment. No replacement was made.'
      });
    }

    // Verify the original failure directly with KingFlexy.
    const originalResponse = await fetch(
      `https://api.kingflexygh.com/api/v2/orders/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: supplierKey,
          Accept: 'application/json'
        }
      }
    );

    const originalResult = await originalResponse.json();
    const originalStatus = String(
      originalResult?.data?.status || ''
    ).toLowerCase();

    if (
      !originalResponse.ok ||
      originalResult?.success !== true ||
      !['failed', 'refunded'].includes(originalStatus)
    ) {
      return res.status(409).json({
        error: 'The supplier has not confirmed that the original order failed or was refunded. No replacement was made.'
      });
    }

    const supplierNetwork = NETWORK_MAP[order.network];

    if (!supplierNetwork) {
      return res.status(409).json({
        error: 'This network is not configured for automatic replacement.'
      });
    }

    const replacementReference = `ADGH-${randomUUID()}`;

    // Reserve the one permitted replacement atomically.
    const claimed = await sql`
      UPDATE public.guest_data_orders
      SET status = ${originalStatus},
          supplier_status = ${originalStatus},
          replacement_reference = ${replacementReference},
          replacement_status = 'submitting',
          replacement_requested_at = now(),
          updated_at = now()
      WHERE reference = ${reference}
        AND payment_status = 'paid'
        AND payment_provider = 'paystack'
        AND replacement_reference IS NULL
      RETURNING reference
    `;

    if (!claimed.length) {
      return res.status(409).json({
        error: 'A replacement has already been requested for this order.'
      });
    }

    // Submit the same bundle to the same phone number without another payment.
    let supplierResponse;
    let supplierResult;

    try {
      supplierResponse = await fetch(
        'https://api.kingflexygh.com/api/v2/data/purchase',
        {
          method: 'POST',
          headers: {
            Authorization: supplierKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            network: supplierNetwork,
            volume_gb: Number(order.volume_gb),
            recipient: order.recipient,
            reference: replacementReference
          })
        }
      );

      supplierResult = await supplierResponse.json();
    } catch (error) {
      // Do not submit again automatically: the supplier may have received it.
      await sql`
        UPDATE public.guest_data_orders
        SET replacement_status = 'processing',
            replacement_response = ${JSON.stringify({
              message: 'Supplier response could not be confirmed.',
              error: String(error?.message || 'Network error')
            })}::jsonb,
            updated_at = now()
        WHERE reference = ${reference}
          AND replacement_reference = ${replacementReference}
      `;

      return res.status(202).json({
        success: true,
        reference,
        replacement_reference: replacementReference,
        replacement_status: 'processing',
        message: 'Your replacement request was sent. We are confirming delivery. You will not be charged again.'
      });
    }

    const returnedStatus = String(
      supplierResult?.data?.status ||
      supplierResult?.status ||
      'processing'
    ).toLowerCase();

    const replacementStatus =
      supplierResponse.ok && ALLOWED_STATUSES.includes(returnedStatus)
        ? returnedStatus
        : 'processing';

    const supplierOrderId =
      supplierResult?.data?.order_id ||
      supplierResult?.data?.id ||
      supplierResult?.order_id ||
      null;

    await sql`
      UPDATE public.guest_data_orders
      SET replacement_status = ${replacementStatus},
          replacement_order_id = ${supplierOrderId ? String(supplierOrderId) : null},
          replacement_response = ${JSON.stringify(supplierResult || {})}::jsonb,
          updated_at = now()
      WHERE reference = ${reference}
        AND replacement_reference = ${replacementReference}
    `;

    return res.status(200).json({
      success: true,
      reference,
      replacement_reference: replacementReference,
      replacement_status: replacementStatus,
      message: replacementStatus === 'completed'
        ? 'Your replacement bundle has been delivered. You were not charged again.'
        : 'Your free replacement has been submitted. We are tracking its delivery.'
    });

  } catch (error) {
    console.error('Replacement request error:', error?.message || error);
    return res.status(500).json({
      error: 'Could not process your replacement request. Please try again later.'
    });
  }
}
