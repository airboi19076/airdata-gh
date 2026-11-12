import { getDatabase } from '../_lib/wallet.js';

const ALLOWED_STATUSES = [
  'pending',
  'queued',
  'blacklisted',
  'processing',
  'completed',
  'failed',
  'refunded'
];

function getMessage(status) {
  const messages = {
    awaiting_payment: 'Waiting for your payment confirmation.',
    payment_failed: 'Your payment was not successful. No data order was submitted.',
    submitting: 'Payment confirmed. Submitting your data order.',
    pending: 'Your order has been received and is awaiting processing.',
    queued: 'Your order is queued and waiting for processing.',
    blacklisted: 'Your order is on hold with the supplier. Please contact support.',
    processing: 'Your data bundle is being processed.',
    completed: 'Your data bundle has been delivered successfully.',
    failed: 'The supplier could not complete your order. Please contact support.',
    refunded: 'The supplier marked this order as refunded. Please contact support if the payment has not been returned.'
  };

  return messages[status] || 'Your order is being checked.';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const reference = String(req.query?.reference || '').trim();

  if (!/^ADGH-[a-f0-9-]{20,50}$/i.test(reference)) {
    return res.status(400).json({
      error: 'Invalid order reference.'
    });
  }

  try {
    const sql = await getDatabase();

    const orders = await sql`
      SELECT
        reference,
        payment_status,
        payment_provider,
        status,
        supplier_status,
        supplier_order_id,
        supplier_response
      FROM public.guest_data_orders
      WHERE reference = ${reference}
      LIMIT 1
    `;

    if (!orders.length) {
      return res.status(404).json({
        error: 'Order not found.'
      });
    }

    const order = orders[0];

    if (order.payment_provider !== 'moolre') {
      return res.status(400).json({
        error: 'Invalid payment provider for this order.'
      });
    }

    // Never check or submit a supplier order before payment is confirmed.
    if (order.payment_status !== 'paid') {
      const currentStatus = String(order.status || 'awaiting_payment')
        .toLowerCase();

      return res.status(200).json({
        success: true,
        reference,
        payment_status: order.payment_status,
        status: currentStatus,
        message: getMessage(currentStatus)
      });
    }

    const apiKey = (process.env.KINGFLEXY_API_KEY || '')
      .replace(/\s+/g, '');

    if (!apiKey) {
      return res.status(200).json({
        success: true,
        reference,
        payment_status: 'paid',
        status: 'processing',
        message: 'Payment confirmed. Your order is awaiting supplier confirmation.'
      });
    }

    // Do not repeatedly query orders that are already in a final state.
    const savedStatus = String(
      order.supplier_status || order.status || ''
    ).toLowerCase();

    if (['completed', 'failed', 'refunded'].includes(savedStatus)) {
      const finalStatus =
        savedStatus === 'refunded' ? 'refunded' : savedStatus;

      return res.status(200).json({
        success: true,
        reference,
        payment_status: 'paid',
        status: finalStatus,
        supplier_status: savedStatus,
        message: getMessage(finalStatus)
      });
    }

    // Ask KiNG FLEXY for the latest status using the order reference.
    let supplierResponse;

    try {
      supplierResponse = await fetch(
        `https://api.kingflexygh.com/api/v2/orders/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: apiKey,
            Accept: 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Supplier status request failed:', error.message);

      return res.status(200).json({
        success: true,
        reference,
        payment_status: 'paid',
        status: 'processing',
        message: 'Payment confirmed. We are waiting for the supplier status update.'
      });
    }

    let supplierResult;

    try {
      supplierResult = await supplierResponse.json();
    } catch {
      supplierResult = null;
    }

    if (
      !supplierResponse.ok ||
      supplierResult?.success !== true ||
      !supplierResult?.data
    ) {
      return res.status(200).json({
        success: true,
        reference,
        payment_status: 'paid',
        status: 'processing',
        message: 'Payment confirmed. Your data order is awaiting supplier confirmation.'
      });
    }

    const data = supplierResult.data;
    const supplierStatus = String(data.status || '').toLowerCase();

    if (!ALLOWED_STATUSES.includes(supplierStatus)) {
      return res.status(200).json({
        success: true,
        reference,
        payment_status: 'paid',
        status: 'processing',
        message: 'Payment confirmed. The supplier status is being checked.'
      });
    }

    const displayStatus =
      supplierStatus === 'refunded' ? 'refunded' : supplierStatus;

    await sql`
      UPDATE public.guest_data_orders
      SET status = ${displayStatus},
          supplier_status = ${supplierStatus},
          supplier_order_id = COALESCE(
            ${data.order_id ? String(data.order_id) : null},
            supplier_order_id
          ),
          supplier_response = ${JSON.stringify(data)}::jsonb,
          updated_at = now()
      WHERE reference = ${reference}
        AND payment_status = 'paid'
    `;

    return res.status(200).json({
      success: true,
      reference,
      payment_status: 'paid',
      status: displayStatus,
      supplier_status: supplierStatus,
      message: getMessage(displayStatus)
    });

  } catch (error) {
    console.error('Checkout status check failed:', error.message);

    return res.status(500).json({
      error: 'Could not check this order. Please try again.'
    });
  }
}
