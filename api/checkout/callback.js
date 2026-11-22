
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../_lib/wallet.js';

const SITE_MODE = String(process.env.PAYSTACK_MODE || 'test')
  .trim()
  .toLowerCase();

const NETWORK_MAP = {
  MTN: 'MTN',
  'AirtelTigo iShare': 'AT-iShare',
  'AirtelTigo BigTime': 'AT-BigTime',
  Telecel: 'Telecel'
};

function verifyPaystackSignature(req, secretKey) {
  const signature = req.headers['x-paystack-signature'];

  if (!signature || typeof signature !== 'string') {
    return false;
  }

  const rawBody = req.rawBody
    ? Buffer.from(req.rawBody)
    : Buffer.from(JSON.stringify(req.body || {}));

  const expected = createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  try {
    const receivedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

async function verifyTransaction(reference, secretKey) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json'
      }
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    result?.status !== true ||
    result?.data?.status !== 'success' ||
    result?.data?.reference !== reference ||
    result?.data?.currency !== 'GHS'
  ) {
    throw new Error('Paystack transaction verification failed.');
  }

  return result.data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      received: false,
      error: 'Method not allowed.'
    });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error('PAYSTACK_SECRET_KEY is missing.');

    return res.status(500).json({
      received: false,
      error: 'Payment configuration is incomplete.'
    });
  }

  if (!verifyPaystackSignature(req, secretKey)) {
    return res.status(401).json({
      received: false,
      error: 'Invalid payment notification signature.'
    });
  }

  const event = req.body?.event;

  // Ignore other Paystack events.
  if (event !== 'charge.success') {
    return res.status(200).json({
      received: true,
      ignored: true
    });
  }

  const reference = String(
    req.body?.data?.reference || ''
  ).trim();

  if (!/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)) {
    return res.status(400).json({
      received: false,
      error: 'Invalid order reference.'
    });
  }

  try {
    const sql = await getDatabase();

    // Confirm payment directly with Paystack.
    const transaction = await verifyTransaction(
      reference,
      secretKey
    );

    const amountPesewas = Number(transaction.amount);

    if (
      !Number.isInteger(amountPesewas) ||
      amountPesewas <= 0
    ) {
      return res.status(400).json({
        received: false,
        error: 'Invalid payment amount.'
      });
    }

    // Find the original order and compare its expected amount.
    const orders = await sql`
      SELECT
        reference,
        network,
        volume_gb,
        recipient,
        retail_price_pesewas,
        payment_status,
        payment_provider
      FROM public.guest_data_orders
      WHERE reference = ${reference}
        AND payment_provider = 'paystack'
      LIMIT 1
    `;

    if (!orders.length) {
      return res.status(404).json({
        received: false,
        error: 'Order not found.'
      });
    }

    const order = orders[0];

    if (Number(order.retail_price_pesewas) !== amountPesewas) {
      return res.status(400).json({
        received: false,
        error: 'Payment amount does not match the order.'
      });
    }

    // Do not process an order more than once.
    if (order.payment_status === 'paid') {
      return res.status(200).json({
        received: true,
        already_processed: true
      });
    }

    // Atomically claim this order as paid.
    const claimed = await sql`
      UPDATE public.guest_data_orders
      SET payment_status = 'paid',
          payment_provider_reference = ${reference},
          payment_response = ${JSON.stringify(transaction)}::jsonb,
          status = 'submitting',
          supplier_status = 'submitting',
          updated_at = now()
      WHERE reference = ${reference}
        AND payment_provider = 'paystack'
        AND payment_status = 'pending'
        AND status = 'awaiting_payment'
        AND retail_price_pesewas = ${amountPesewas}
      RETURNING reference, network, volume_gb, recipient
    `;

    if (!claimed.length) {
      return res.status(200).json({
        received: true,
        already_processed: true
      });
    }

    const paidOrder = claimed[0];

    // Test payments must NEVER trigger real data delivery.
    if (SITE_MODE === 'test') {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'test_payment_received',
            supplier_status = 'test_mode_no_delivery',
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        test_payment: true,
        delivery: 'disabled_in_test_mode'
      });
    }

    if (SITE_MODE !== 'live') {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        delivery: 'awaiting_configuration'
      });
    }

    const supplierKey = process.env.KINGFLEXY_API_KEY;

    if (!supplierKey) {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        delivery: 'awaiting_supplier_configuration'
      });
    }

    const supplierNetwork = NETWORK_MAP[paidOrder.network];

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
        delivery: 'network_requires_confirmation'
      });
    }

    // Submit the paid order to KingFlexy.
    const supplierResponse = await fetch(
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
          volume_gb: Number(paidOrder.volume_gb),
          recipient: paidOrder.recipient,
          reference: paidOrder.reference
        })
      }
    );

    let supplierResult;

    try {
      supplierResult = await supplierResponse.json();
    } catch {
      supplierResult = {};
    }

    if (!supplierResponse.ok) {
      await sql`
        UPDATE public.guest_data_orders
        SET status = 'processing',
            supplier_status = 'awaiting_confirmation',
            supplier_response = ${JSON.stringify(supplierResult)}::jsonb,
            updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(200).json({
        received: true,
        delivery: 'supplier_confirmation_pending'
      });
    }

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
      supplierResult?.data?.status ||
      supplierResult?.status ||
      'processing'
    ).toLowerCase();

    const supplierStatus = allowedStatuses.includes(returnedStatus)
      ? returnedStatus
      : 'processing';

    const supplierOrderId =
      supplierResult?.data?.order_id ||
      supplierResult?.data?.id ||
      supplierResult?.order_id ||
      null;

    await sql`
      UPDATE public.guest_data_orders
      SET status = ${supplierStatus},
          supplier_status = ${supplierStatus},
          supplier_order_id = ${supplierOrderId},
          supplier_response = ${JSON.stringify(supplierResult)}::jsonb,
          updated_at = now()
      WHERE reference = ${reference}
    `;

    return res.status(200).json({
      received: true,
      delivery: supplierStatus
    });

  } catch (error) {
    console.error(
      'Paystack callback processing error:',
      error.message
    );

    return res.status(500).json({
      received: false,
      error: 'Payment notification could not be processed.'
    });
  }
}
