
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

  const reference = `ADGH-${randomUUID()}`;

  try {
    const sql = await getDatabase();

    await sql`
      INSERT INTO public.wallet_transactions
        (user_id, amount_pesewas, status, provider, reference, currency)
      VALUES
        (${user.id}::uuid, ${amountPesewas}, 'pending',
         'moolre', ${reference}, 'GHS')
    `;

    const response = await fetch('https://api.moolre.com/embed/link', {
      method: 'POST',
      headers: {
        'X-API-USER': MOOLRE_API_USER,
        'X-API-PUBKEY': MOOLRE_PUBLIC_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 1,
        amount: (amountPesewas / 100).toFixed(2),
        email: 'samasumadu33@gmail.com',
        externalref: reference,
        reusable: '0',
        currency: 'GHS',
        accountnumber: MOOLRE_ACCOUNT_NUMBER,
        redirect: `https://airdata-gh.vercel.app/?page=deposit&reference=${encodeURIComponent(reference)}`,
        metadata: {
          user_id: user.id,
          purpose: 'AirData GH wallet deposit'
        }
      })
    });

    const result = await response.json();

    if (
      !response.ok ||
      Number(result.status) !== 1 ||
      !result.data?.authorization_url
    ) {
      await sql`
        UPDATE public.wallet_transactions
        SET status = 'failed', updated_at = now()
        WHERE reference = ${reference}
          AND status = 'pending'
      `;

      return res.status(502).json({
        error: result.message || 'Could not start Moolre checkout.'
      });
    }

    return res.status(200).json({
      authorization_url: result.data.authorization_url,
      reference
    });

  } catch (error) {
    console.error('Moolre deposit initialization failed:', error.message);

    return res.status(500).json({
      error: 'Could not initialize your deposit.'
    });
  }
}
