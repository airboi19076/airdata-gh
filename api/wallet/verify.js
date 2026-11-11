
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const reference = String(req.body?.reference || '').trim();

  if (!reference) {
    return res.status(400).json({
      error: 'Payment reference is required.'
    });
  }

  try {
    const sql = await getDatabase();

    const rows = await sql`
      SELECT reference, currency, status, provider
      FROM public.wallet_transactions
      WHERE reference = ${reference}
        AND user_id = ${user.id}::uuid
      LIMIT 1
    `;

    const transaction = rows[0];

    if (!transaction || transaction.provider !== 'moolre') {
      return res.status(404).json({
        error: 'Moolre payment reference was not found.'
      });
    }

    if (transaction.currency !== 'GHS') {
      return res.status(400).json({
        error: 'Transaction currency does not match.'
      });
    }

    if (transaction.status === 'failed') {
      return res.status(402).json({
        error: 'This payment failed. Your wallet was not credited.'
      });
    }

    if (transaction.status !== 'success') {
      return res.status(202).json({
        success: false,
        pending: true,
        error: 'Payment is still being confirmed. Please wait a moment.'
      });
    }

    const wallet = await sql`
      SELECT balance_pesewas
      FROM public.wallets
      WHERE user_id = ${user.id}::uuid
      LIMIT 1
    `;

    return res.status(200).json({
      success: true,
      already_credited: true,
      balance: Number(wallet[0]?.balance_pesewas || 0) / 100
    });

  } catch (error) {
    console.error('Moolre verification failed:', error.message);

    return res.status(500).json({
      error: 'Could not check your payment right now.'
    });
  }
}
