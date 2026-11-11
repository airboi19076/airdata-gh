
import { timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../_lib/wallet.js';

function moneyToPesewas(value) {
  const text = String(value ?? '');

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [cedis, pesewas = ''] = text.split('.');
  return Number(cedis) * 100 + Number(pesewas.padEnd(2, '0'));
}

function validSecret(received, expected) {
  if (typeof received !== 'string' || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;

  if (!expectedSecret) {
    console.error('Moolre callback secret is not configured.');
    return res.status(500).json({ error: 'Callback is not configured.' });
  }

  const payload = req.body;
  const data = payload?.data;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid callback payload.' });
  }

  if (!validSecret(data.secret, expectedSecret)) {
    return res.status(401).json({ error: 'Invalid callback secret.' });
  }

  const reference = String(data.externalref || '').trim();
  const accountNumber = String(data.accountnumber || '').trim();

  if (
    !reference ||
    accountNumber !== String(process.env.MOOLRE_ACCOUNT_NUMBER || '').trim()
  ) {
    return res.status(400).json({
      error: 'Payment reference or account number is invalid.'
    });
  }

  try {
    const sql = await getDatabase();

    const rows = await sql`
      SELECT user_id, amount_pesewas, currency, status, provider
      FROM public.wallet_transactions
      WHERE reference = ${reference}
      LIMIT 1
    `;

    const transaction = rows[0];

    if (!transaction || transaction.provider !== 'moolre') {
      return res.status(404).json({
        error: 'Matching Moolre payment was not found.'
      });
    }

    if (transaction.currency !== 'GHS') {
      return res.status(400).json({
        error: 'Transaction currency does not match.'
      });
    }

    // Failed payment: record failure, never credit the wallet.
    if (
      Number(payload.status) === 0 &&
      payload.code === 'P02' &&
      Number(data.txstatus) === 2
    ) {
      if (transaction.status === 'success') {
        return res.status(200).json({
          received: true,
          message: 'Payment was already completed.'
        });
      }

      await sql`
        UPDATE public.wallet_transactions
        SET status = 'failed',
            updated_at = now()
        WHERE reference = ${reference}
          AND provider = 'moolre'
          AND status = 'pending'
      `;

      return res.status(200).json({
        received: true,
        message: 'Failed payment recorded.'
      });
    }

    // Only a confirmed successful payment can credit the wallet.
    if (
      Number(payload.status) !== 1 ||
      payload.code !== 'P01' ||
      Number(data.txstatus) !== 1
    ) {
      return res.status(200).json({
        received: true,
        message: 'No successful payment action taken.'
      });
    }

    const callbackAmount = moneyToPesewas(data.amount);

    if (
      callbackAmount === null ||
      callbackAmount !== Number(transaction.amount_pesewas)
    ) {
      return res.status(400).json({
        error: 'Payment amount does not match. Wallet not credited.'
      });
    }

    if (transaction.status === 'success') {
      return res.status(200).json({
        received: true,
        already_credited: true
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(409).json({
        error: 'Transaction is not pending.'
      });
    }

    if (!data.transactionid) {
      return res.status(400).json({
        error: 'Successful payment is missing its transaction ID.'
      });
    }

    const credited = await sql`
      WITH marked AS (
        UPDATE public.wallet_transactions
        SET status = 'success',
            provider_reference = ${String(data.transactionid)},
            updated_at = now()
        WHERE reference = ${reference}
          AND provider = 'moolre'
          AND status = 'pending'
          AND amount_pesewas = ${callbackAmount}
          AND currency = 'GHS'
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
        received: true,
        success: true,
        message: 'Wallet credited successfully.'
      });
    }

    return res.status(200).json({
      received: true,
      message: 'Payment was already processed or is no longer pending.'
    });

  } catch (error) {
    console.error('Moolre callback processing failed:', error.message);

    return res.status(500).json({
      error: 'Could not process payment notification.'
    });
  }
}
