
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();

  const admin = await requireUser(req, res);
  if (!admin) return;

  if (!adminEmail || admin.email !== adminEmail) {
    return res.status(403).json({
      error: 'Administrator access required.'
    });
  }

  try {
    const sql = await getDatabase();

    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u."emailVerified",
        u."createdAt",
        COALESCE(u.banned, false) AS banned,
        p.phone
      FROM neon_auth."user" u
      LEFT JOIN public.airdata_customer_profiles p
        ON p.user_id = u.id
      ORDER BY u."createdAt" DESC
      LIMIT 500
    `;

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Admin users lookup failed:', error);

    return res.status(500).json({
      error: 'Could not load registered users.'
    });
  }
}
