
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../_lib/wallet.js';

const RETAIL_PRICES = {
  MTN: {
    1: 475, 2: 950, 3: 1425, 4: 1900, 5: 2375,
    6: 2850, 8: 3800, 10: 4750, 15: 7125,
    20: 9300, 25: 11625, 30: 13950, 40: 18600,
    50: 23250
  },

  'AirtelTigo iShare': {
    1: 430, 2: 860, 3: 1290, 4: 1720, 5: 2150,
    6: 2580, 7: 3010, 8: 3440, 10: 4300,
    15: 6450, 20: 8600
  },

  'AirtelTigo BigTime': {
    20: 7400, 25: 7900, 30: 8400, 40: 9900,
    50: 10900, 100: 17900, 200: 32300, 250: 41600
  },

  Telecel: {
    10: 4200, 15: 6300, 20: 8400, 25: 10500,
    30: 12600, 40: 16800, 50: 21000
  }
};

const SITE_URL = 'https://airdata-gh.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const network = String(req.body?.network || '').trim();
  const volume = Number(req.body?.volume_gb);
  const recipient = String(req.body?.recipient || '').trim();

  // Paystack requires an email address.
  // The frontend can supply the customer's email.
  const email = String(
    req.body?.email ||
    process.env.PAYSTACK_CUSTOMER_EMAIL ||
    'samasumadu33@gmail.com'
  ).trim();

  if (!RETAIL_PRICES[network]) {
    return res.status(400).json({
      error: 'Please select a valid network.'
    });
  }

  if (
    !Number.isInteger(volume) ||
    !RETAIL_PRICES[network][volume]
  ) {
    return res.status(400).json({
      error: 'The selected data bundle is not available.'
    });
  }

  if (!/^0\d{9}$/.test(recipient)) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit Ghana phone number.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'A valid email address is required for payment.'
    });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const mode = String(process.env.PAYSTACK_MODE || 'test')
    .trim()
    .toLowerCase();

  if (!secretKey) {
    return res.status(500).json({
      error: 'Paystack secret key is missing.'
    });
  }

  if (
    (mode === 'test' && !secretKey.startsWith('sk_test_')) ||
    (mode === 'live' && !secretKey.startsWith('sk_live_'))
  ) {
    return res.status(500).json({
      error: 'Your Paystack key does not match the configured payment mode.'
    });
  }

  if (mode !== 'test' && mode !== 'live') {
    return res.status(500).json({
      error: 'Invalid Paystack payment mode.'
    });
  }

  const amountPesewas = RETAIL_PRICES[network][volume];
  const reference = `ADGH-${randomUUID()}`;

  try {
    const sql = await getDatabase();

    // Save the order before starting payment.
    await sql`
      INSERT INTO public.guest_data_orders (
        reference,
        network,
        volume_gb,
        recipient,
        retail_price_pesewas,
        payment_status,
        payment_provider,
        status
      )
      VALUES (
        ${reference},
        ${network},
        ${volume},
        ${recipient},
        ${amountPesewas},
        'pending',
        'paystack',
        'awaiting_payment'
      )
    `;

    const paymentResponse = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: amountPesewas,
          currency: 'GHS',
          reference,
          callback_url:
            `${SITE_URL}/?page=buy-data&reference=${encodeURIComponent(reference)}`,
          metadata: {
            purpose: 'AirData GH data bundle purchase',
            order_reference: reference,
            network,
            volume_gb: volume,
            recipient
          }
        })
      }
    );

    let result;

    try {
      result = await paymentResponse.json();
    } catch {
      result = null;
    }

    if (
      !paymentResponse.ok ||
      result?.status !== true ||
      !result?.data?.authorization_url
    ) {
      await sql`
        UPDATE public.guest_data_orders
        SET payment_status = 'failed',
            status = 'payment_failed',
            payment_response = ${JSON.stringify(result || {})}::jsonb,
            updated_at = now()
        WHERE reference = ${reference}
          AND payment_status = 'pending'
      `;

      return res.status(502).json({
        error:
          result?.message ||
          'Could not start Paystack checkout. Please try again.'
      });
    }

    await sql`
      UPDATE public.guest_data_orders
      SET payment_provider_reference = ${reference},
          payment_response = ${JSON.stringify(result)}::jsonb,
          updated_at = now()
      WHERE reference = ${reference}
    `;

    return res.status(200).json({
      success: true,
      payment_url: result.data.authorization_url,
      reference,
      amount: (amountPesewas / 100).toFixed(2),
      currency: 'GHS'
    });

  } catch (error) {
    console.error(
      'Paystack checkout initialization failed:',
      error.message
    );

    return res.status(500).json({
      error: 'Could not initialize your data order. Please try again.'
    });
  }
}
