
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
      error: 'Kingflexy API key is not configured.'
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

    const needsRefund =
      supplierStatus === 'failed' ||
      supplierStatus === 'refunded';

    if (needsRefund) {
      const refundResult = await sql`
        WITH ledger_refund AS (
          UPDATE public.wallet_transactions
          SET status = 'refunded',
              updated_at = now()
          WHERE reference = ${reference}
            AND user_id = ${user.id}::uuid
            AND provider = 'kingflexy'
            AND status = 'success'
          RETURNING user_id, amount_pesewas
        ),
        wallet_credit AS (
          INSERT INTO public.wallets (
            user_id,
            balance_pesewas
          )
          SELECT user_id, amount_pesewas
          FROM ledger_refund
          ON CONFLICT (user_id) DO UPDATE
          SET balance_pesewas =
            public.wallets.balance_pesewas + EXCLUDED.balance_pesewas,
            updated_at = now()
          RETURNING balance_pesewas
        ),
        order_update AS (
          UPDATE public.data_orders
          SET status = 'refunded',
              supplier_status = ${supplierStatus},
              supplier_order_id = COALESCE(
                ${data.order_id ? String(data.order_id) : null},
                supplier_order_id
              ),
              supplier_response = ${JSON.stringify(data)}::jsonb,
              updated_at = now()
          WHERE reference = ${reference}
            AND user_id = ${user.id}::uuid
            AND (
              EXISTS (SELECT 1 FROM ledger_refund)
              OR EXISTS (
                SELECT 1
                FROM public.wallet_transactions
                WHERE reference = ${reference}
                  AND user_id = ${user.id}::uuid
                  AND provider = 'kingflexy'
                  AND status = 'refunded'
              )
            )
          RETURNING reference
        )
        SELECT
          (SELECT COUNT(*) FROM order_update) AS order_updated,
          (SELECT balance_pesewas FROM wallet_credit LIMIT 1)
            AS credited_balance
      `;

      if (Number(refundResult[0]?.order_updated || 0) === 0) {
        return res.status(409).json({
          error: 'Refund could not be completed because the matching wallet transaction was not found. Please contact support.'
        });
      }
    } else {
      await sql`
        UPDATE public.data_orders
        SET status = ${supplierStatus},
            supplier_status = ${supplierStatus},
            supplier_order_id = COALESCE(
              ${data.order_id ? String(data.order_id) : null},
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
      LIMIT 1
    `;

    let message = 'Your order is being processed.';
    let displayStatus = supplierStatus;

    if (supplierStatus === 'completed') {
      message = 'Your data bundle has been delivered successfully.';
    } else if (needsRefund) {
      displayStatus = 'refunded';
      message = 'Your order failed or was refunded. Your wallet has been credited, or the previous refund was confirmed.';
    } else if (supplierStatus === 'blacklisted') {
      message = 'Your order is on hold with the supplier.';
    } else if (supplierStatus === 'queued') {
      message = 'Your order is queued and waiting for processing.';
    }

    return res.status(200).json({
      success: true,
      reference,
      status: displayStatus,
      supplier_status: supplierStatus,
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
