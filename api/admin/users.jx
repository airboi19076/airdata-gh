
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const adminEmail = String(
    process.env.ADMIN_EMAIL || ''
  ).trim().toLowerCase();

  if (!adminEmail) {
    return res.status(500).json({
      error: 'Admin access is not configured.'
    });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (user.email !== adminEmail) {
    return res.status(403).json({
      error: 'Administrator access required.'
    });
  }

  try {
    const sql = await getDatabase();

    const users = await sql`
      SELECT
        id,
        name,
        email,
        "emailVerified",
        "createdAt",
        COALESCE(banned, false) AS banned
      FROM neon_auth."user"
      ORDER BY "createdAt" DESC
      LIMIT 200
    `;

    return res.status(200).json({ users });

  } catch (error) {
    console.error('Admin users lookup failed:', error);

    return res.status(500).json({
      error: 'Could not load registered users.'
    });
  }
}
