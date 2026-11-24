
import {
  createHmac,
  timingSafeEqual
} from 'node:crypto';

import { getDatabase } from '../_lib/wallet.js';

// Vercel must not parse the request body before signature verification.
export const config = {
  api: {
    bodyParser: false
  }
};

const NETWORK_MAP = {
  MTN: 'MTN',
  'AirtelTigo iShare': 'AT-iShare',
  'AirtelTigo BigTime': 'AT-BigTime',
  Telecel: 'Telecel'
};

const SITE_MODE = String(process.env.PAYSTACK_MODE || 'test')
  .trim()
  .toLowerCase();

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    total += buffer.length;

    if (total > 1024 * 1024) {
      throw new Error('Webhook request is too large.');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function safeCompare(expected, receivedHex) {
  if (
    typeof receivedHex !== 'string' ||
    !/^[0-9a-f]{128}$/i.test(receivedHex)
  ) {
    return false;
  }

  const received = Buffer.from(receivedHex, 'hex');

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

function verifyLegacySignature(rawBody, signature, secretKey) {
  if (
    typeof signature !== 'string' ||
    !/^[0-9a-f]{128}$/i.test(signature)
  ) {
    return false;
  }

  const expected = createHmac('sha512', secretKey)
    .update(rawBody)
    .digest();

  return safeCompare(expected, signature);
}

function verifyNewSignature(rawBody, header, webhookSecret) {
  if (
    typeof header !== 'string' ||
    !webhookSecret
  ) {
    return false;
  }

  let timestamp = null;
  const signatures = [];

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');

    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === 't') {
      if (
        timestamp !== null ||
        !/^\d+$/.test(value)
      ) {
        return false;
      }

      timestamp = Number(value);
    }

    if (key === 'v1') {
      const colon = value.indexOf(':');

      if (colon !== -1) {
        signatures.push(value.slice(colon + 1));
      }
    }
  }

  if (
    timestamp === null ||
    signatures.length === 0 ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300
  ) {
    return false;
  }

  const expected = createHmac('sha512', webhookSecret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();

  return signatures.some(signature =>
    safeCompare(expected, signature)
  );
}

function verifyPaystackSignature(req, rawBody, secretKey) {
  const newSignature = req.headers['paystack-signature'];

  // Prefer Paystack's newer signing-secret format when supplied.
  if (newSignature) {
    return verifyNewSignature(
      rawBody,
      newSignature,
      process.env.PAYSTACK_WEBHOOK_SECRET
    );
  }

  // Continue supporting the existing secret-key signature.
  return verifyLegacySignature(
    rawBody,
    req.headers['x-paystack-signature'],
    secretKey
  );
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
    return res.status(500).json({
      received: false,
      error: 'Payment configuration is incomplete.'
    });
  }

  if (
    (SITE_MODE === 'test' && !secretKey.startsWith('sk_test_')) ||
    (SITE_MODE === 'live' && !secretKey.startsWith('sk_live_')) ||
    !['test', 'live'].includes(SITE_MODE)
  ) {
    return res.status(500).json({
      received: false,
      error: 'Paystack payment mode configuration is invalid.'
    });
  }

  let rawBody;
  let event;

  try {
    rawBody = await readRawBody(req);

    if (!verifyPaystackSignature(req, rawBody, secretKey)) {
      return res.status(401).json({
        received: false,
        error: 'Invalid payment notification signature.'
      });
    }

    event = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Webhook request error:', error.message);

    return res.status(400).json({
      received: false,
      error: 'Invalid webhook request.'
    });
  }

  // Acknowledge other valid Paystack events without processing them.
  if (event?.event !== 'charge.success') {
    return res.status(200).json({
      received: true,
      ignored: true
    });
  }

  const reference = String(
    event?.data?.reference || ''
  ).trim();

  if (!/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)) {
    return res.status(400).json({
      received: false,
      error: 'Invalid order reference.'
    });
  }

  try {
    const sql = await getDatabase();

    // Verify the transaction directly with Paystack.
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

    // Find the original AirData GH order.
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

    if (
      Number(order.retail_price_pesewas) !== amountPesewas
    ) {
      return res.status(400).json({
        received: false,
        error: 'Payment amount does not match the order.'
      });
    }

    // Prevent duplicate processing.
    if (order.payment_status === 'paid') {
      return res.status(200).json({
        received: true,
        already_processed: true
      });
    }

    // Atomically claim the order after payment verification.
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

    // Test payments NEVER trigger real data delivery.
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

    // Submit paid orders to KingFlexy only in live mode.
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
if (supplierStatus === 'completed') {
  await creditAgentCommission(sql, reference);
}
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
