
import { requireUser, getDatabase } from '../_lib/wallet.js';

function moneyToPesewas(value) {
  const text = String(value ?? '');

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [cedis, pesewas = ''] = text.split('.');
  return Number(cedis) * 100 + Number(pesewas.padEnd(2, '0'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const reference = String(req.body?.reference || '').trim();

  if (!reference.startsWith('ADGH-')) {
    return res.status(400).json({
      error: 'Invalid payment reference.'
    });
  }

  const {
    MOOLRE_API_USER,
    MOOLRE_PUBLIC_KEY,
    MOOLRE_ACCOUNT_NUMBER
  } = process.env;

  if (!MOOLRE_API_USER || !MOOLRE_PUBLIC_KEY || !MOOLRE_ACCOUNT_NUMBER) {
    return res.status(500).json({
      error: 'Moolre payment settings are incomplete.'
    });
  }

  try {
    const sql = await getDatabase();

    const rows = await sql`
      SELECT reference, amount_pesewas, currency, status, provider
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

    // Already credited: never credit this transaction again.
    if (transaction.status === 'success') {
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
    }

    // Independently ask Moolre for the actual payment status.
    const response = await fetch(
      'https://api.moolre.com/open/transact/status',
      {
        method: 'POST',
        headers: {
          'X-API-USER': MOOLRE_API_USER,
          'X-API-PUBKEY': MOOLRE_PUBLIC_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 1,
          idtype: 1,
          id: reference,
          accountnumber: MOOLRE_ACCOUNT_NUMBER
        })
      }
    );

    const result = await response.json();
    const payment = result.data;

    if (
      !response.ok ||
      Number(result.status) !== 1 ||
      result.code !== 'SS01' ||
      !payment
    ) {
      return res.status(202).json({
        success: false,
        pending: true,
        error: 'Moolre has not confirmed this payment yet. Please wait.'
      });
    }

    const confirmedAmount = moneyToPesewas(payment.amount);

    if (
      Number(payment.txstatus) !== 1 ||
      String(payment.externalref || '') !== reference ||
      String(payment.accountnumber || '').trim() !==
        String(MOOLRE_ACCOUNT_NUMBER).trim() ||
      confirmedAmount !== Number(transaction.amount_pesewas) ||
      !payment.transactionid
    ) {
      return res.status(202).json({
        success: false,
        pending: true,
        error: 'Payment details are not yet fully confirmed.'
      });
    }

    // Atomically mark the deposit successful and credit it once.
    const credited = await sql`
      WITH marked AS (
        UPDATE public.wallet_transactions
        SET status = 'success',
            provider_reference = ${String(payment.transactionid)},
            updated_at = now()
        WHERE reference = ${reference}
          AND user_id = ${user.id}::uuid
          AND provider = 'moolre'
          AND currency = 'GHS'
          AND status = 'pending'
          AND amount_pesewas = ${confirmedAmount}
        RETURNING user_id, amount_pesewas
      ),
      wallet AS (
        INSERT INTO public.wallets (user_id, balance_pesewas)
        SELECT user_id, amount_pesewas
        FROM marked
        ON CONFLICT (user_id) DO UPDATE
        SET balance_pesewas =
          public.wallets.balance_pesewas + EXCLUDED.balance_pesewas,
          updated_at = now()
        RETURNING balance_pesewas
      )
      SELECT balance_pesewas FROM wallet
    `;

    if (credited.length > 0) {
      return res.status(200).json({
        success: true,
        balance: Number(credited[0].balance_pesewas) / 100,
        message: 'Payment confirmed and wallet credited successfully.'
      });
    }

    // A callback may have credited it at the same time.
    const wallet = await sql`
      SELECT balance_pesewas
      FROM public.wallets
      WHERE user_id = ${user.id}::uuid
      LIMIT 1
    `;

    const latest = await sql`
      SELECT status
      FROM public.wallet_transactions
      WHERE reference = ${reference}
        AND user_id = ${user.id}::uuid
      LIMIT 1
    `;

    if (latest[0]?.status === 'success') {
      return res.status(200).json({
        success: true,
        already_credited: true,
        balance: Number(wallet[0]?.balance_pesewas || 0) / 100
      });
    }

    return res.status(202).json({
      success: false,
      pending: true,
      error: 'Payment is still being processed. Please wait.'
    });

  } catch (error) {
    console.error('Moolre verification failed:', error.message);

    return res.status(500).json({
      error: 'Could not verify your payment right now.'
    });
  }
}
