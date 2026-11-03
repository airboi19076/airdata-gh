import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const sql = await getDatabase();

    await sql`
      INSERT INTO public.wallets (user_id, balance_pesewas)
      VALUES (${user.id}::uuid, 0)
      ON CONFLICT (user_id) DO NOTHING
    `;

    const [walletRows, transactions] = await Promise.all([
      sql`
        SELECT balance_pesewas
        FROM public.wallets
        WHERE user_id = ${user.id}::uuid
      `,
      sql`
        SELECT reference, amount_pesewas, currency, status, created_at
        FROM public.wallet_transactions
        WHERE user_id = ${user.id}::uuid
        ORDER BY created_at DESC
        LIMIT 50
      `
    ]);

    return res.status(200).json({
      balance: Number(walletRows[0]?.balance_pesewas || 0) / 100,
      transactions: transactions.map((item) => ({
        reference: item.reference,
        amount: Number(item.amount_pesewas) / 100,
        currency: item.currency,
        status: item.status,
        created_at: item.created_at
      }))
    });

  } catch (error) {
    console.error('Wallet balance error:', error.message);

    return res.status(500).json({
      error: 'Could not load your wallet.'
    });
  }
}
