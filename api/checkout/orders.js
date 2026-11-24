
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

    return res.status(200).json({
      success: true,
      orders
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
