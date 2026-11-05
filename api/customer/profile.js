
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const phone = String(req.body?.phone || '').trim();

  if (!/^0\d{9}$/.test(phone)) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit Ghana phone number.'
    });
  }

  try {
    const sql = await getDatabase();

    await sql`
      INSERT INTO public.airdata_customer_profiles
        (user_id, phone, updated_at)
      VALUES
        (${user.id}::uuid, ${phone}, now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        phone = EXCLUDED.phone,
        updated_at = now()
    `;

    return res.status(200).json({
      success: true,
      message: 'Phone number saved.'
    });
  } catch (error) {
    console.error('Saving customer phone failed:', error);
    return res.status(500).json({
      error: 'Could not save phone number.'
    });
  }
}
