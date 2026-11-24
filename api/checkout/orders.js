
import { getDatabase, requireUser } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const customer = await requireUser(req, res);
  if (!customer) return;

  try {
    const sql = await getDatabase();

    const orders = await sql`
      SELECT
        reference,
        network,
        volume_gb,
        recipient,
        retail_price_pesewas,
        payment_status,
        status,
        supplier_status,
        replacement_reference,
        replacement_status,
        created_at,
        updated_at
      FROM public.guest_data_orders
      WHERE customer_user_id = ${customer.id}
      ORDER BY created_at DESC
      LIMIT 100
    `;

        const paystackMode = String(process.env.PAYSTACK_MODE || 'test')
      .trim()
      .toLowerCase();

    // Test payments are not real data purchases.
    const spendingRows = paystackMode === 'live'
      ? await sql`
          SELECT COALESCE(SUM(retail_price_pesewas), 0)::bigint AS total_spent_pesewas
          FROM public.guest_data_orders
          WHERE customer_user_id = ${customer.id}
            AND payment_provider = 'paystack'
            AND payment_status = 'paid'
            AND COALESCE(status, '') NOT IN (
              'failed', 'refunded', 'payment_failed', 'awaiting_payment'
            )
            AND COALESCE(supplier_status, '') NOT IN ('failed', 'refunded')
        `
      : [{ total_spent_pesewas: 0 }];

    return res.status(200).json({
      success: true,
      orders,
      totalSpentPesewas: Number(
        spendingRows[0]?.total_spent_pesewas || 0
      )
    });
  } catch (error) {
    console.error(
      'Customer orders lookup failed:',
      error?.message || error
    );

    return res.status(500).json({
      error: 'Could not load your orders right now.'
    });
  }
}
