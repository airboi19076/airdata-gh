import { randomUUID } from 'node:crypto';
import { requireUser, getDatabase } from '../_lib/wallet.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const amount = Number(req.body?.amount);
  const amountPesewas = Math.round(amount * 100);

  if (
    !Number.isFinite(amount) ||
    amountPesewas < 10 ||
    amountPesewas > 1000000
  ) {
    return res.status(400).json({
      error: 'Enter an amount between GH₵0.10 and GH₵10,000.'
    });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      error: 'Paystack is not configured yet.'
    });
  }

  const reference = `ADGH-${randomUUID()}`;

  try {
    const sql = await getDatabase();

    await sql`
      INSERT INTO public.wallet_transactions
        (user_id, amount_pesewas, status, provider, reference, currency)
      VALUES
        (${user.id}::uuid, ${amountPesewas}, 'pending',
         'paystack', ${reference}, 'GHS')
    `;

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          amount: amountPesewas,
          currency: 'GHS',
          reference,
          callback_url: 'https://airdata-gh.vercel.app/?page=deposit',
          metadata: {
            user_id: user.id,
            purpose: 'AirData GH wallet deposit'
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status || !result.data?.authorization_url) {
      await sql`
        UPDATE public.wallet_transactions
        SET status = 'failed', updated_at = now()
        WHERE reference = ${reference}
      `;

      return res.status(502).json({
        error: result.message || 'Could not start Paystack checkout.'
      });
    }

    return res.status(200).json({
      authorization_url: result.data.authorization_url,
      reference
    });

  } catch (error) {
    console.error('Deposit initialization failed:', error.message);

    return res.status(500).json({
      error: 'Could not initialize your deposit.'
    });
  }
    }
