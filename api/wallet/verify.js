import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const reference = String(req.body?.reference || '').trim();

  if (!reference) {
    return res.status(400).json({ error: 'Payment reference is required.' });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: 'Paystack is not configured.' });
  }

  try {
    const sql = await getDatabase();

    const rows = await sql`
      SELECT reference, amount_pesewas, currency, status
      FROM public.wallet_transactions
      WHERE reference = ${reference}
        AND user_id = ${user.id}::uuid
      LIMIT 1
    `;

    const transaction = rows[0];

    if (!transaction) {
      return res.status(404).json({
        error: 'Payment reference not found in your account.'
      });
    }

    if (transaction.status === 'success') {
      const wallet = await sql`
        SELECT balance_pesewas
        FROM public.wallets
        WHERE user_id = ${user.id}::uuid
      `;

      return res.status(200).json({
        success: true,
        already_credited: true,
        balance: Number(wallet[0]?.balance_pesewas || 0) / 100
      });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const result = await response.json();
    const payment = result.data;

    if (!response.ok || !result.status || payment?.status !== 'success') {
      return res.status(402).json({
        error: 'Paystack has not confirmed successful payment.'
      });
    }

    if (
      payment.reference !== reference ||
      payment.currency !== 'GHS' ||
      Number(payment.amount) !== Number(transaction.amount_pesewas) ||
      transaction.currency !== 'GHS'
    ) {
      return res.status(400).json({
        error: 'Payment details do not match. Wallet not credited.'
      });
    }

    const credited = await sql`
      WITH marked AS (
        UPDATE public.wallet_transactions
        SET status = 'success',
            provider_reference = ${String(payment.id)},
            updated_at = now()
        WHERE reference = ${reference}
          AND user_id = ${user.id}::uuid
          AND status = 'pending'
        RETURNING user_id, amount_pesewas
      ),
      wallet AS (
        INSERT INTO public.wallets (user_id, balance_pesewas)
        SELECT user_id, amount_pesewas FROM marked
        ON CONFLICT (user_id) DO UPDATE
        SET balance_pesewas =
          public.wallets.balance_pesewas + EXCLUDED.balance_pesewas,
          updated_at = now()
        RETURNING balance_pesewas
      )
      SELECT balance_pesewas FROM wallet
    `;

    if (credited[0]) {
      return res.status(200).json({
        success: true,
        already_credited: false,
        balance: Number(credited[0].balance_pesewas) / 100
      });
    }

    return res.status(409).json({
      error: 'This payment is already being processed. Refresh your wallet.'
    });

  } catch (error) {
    console.error('Payment verification failed:', error.message);

    return res.status(500).json({
      error: 'Could not verify your payment right now.'
    });
  }
}
