
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

  const userId = String(req.body?.userId || '').trim();

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.status(400).json({ error: 'Invalid customer ID.' });
  }

  if (userId === admin.id) {
    return res.status(403).json({
      error: 'You cannot delete the administrator account.'
    });
  }

  try {
    const sql = await getDatabase();

    const deleted = await sql`
      DELETE FROM neon_auth."user"
      WHERE id = ${userId}::uuid
        AND lower(email) <> ${adminEmail}
      RETURNING id
    `;

    if (!deleted.length) {
      return res.status(404).json({
        error: 'Customer account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer account deleted.'
    });
  } catch (error) {
    console.error('Customer deletion failed:', error);
    return res.status(500).json({
      error: 'Could not delete customer account.'
    });
  }
}
