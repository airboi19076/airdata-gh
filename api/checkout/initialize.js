import { randomUUID } from 'node:crypto';
import { getDatabase, requireUser } from '../_lib/wallet.js';

const RETAIL_PRICES = {
  MTN: {
    1: 495, 2: 990, 3: 1485, 4: 1980, 5: 2475,
    6: 2970, 8: 3960, 10: 4950, 15: 7425,
    20: 9900, 25: 12375, 30: 14850, 40: 19800,
    50: 24750
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
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  let customerUser = null;

  if (req.headers.authorization) {
    customerUser = await requireUser(req, res);
    if (!customerUser) return;
  }

  const network = String(req.body?.network || '').trim();
  const volume = Number(req.body?.volume_gb);
  const recipient = String(req.body?.recipient || '').trim();
  const agentCode = String(req.body?.agent_code || '')
    .trim()
    .toUpperCase();

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

  if (!Number.isInteger(volume) || !RETAIL_PRICES[network][volume]) {
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

  if (!['test', 'live'].includes(mode)) {
    return res.status(500).json({
      error: 'Invalid Paystack payment mode.'
    });
  }

  const basePricePesewas = RETAIL_PRICES[network][volume];
  let agent = null;
  let marginPerGbPesewas = 0;
  let agentProfitPesewas = 0;

  try {
    const sql = await getDatabase();

    if (agentCode) {
      if (!/^[A-F0-9]{12}$/.test(agentCode)) {
        return res.status(400).json({
          error: 'Invalid agent shopping link.'
        });
      }

      const agents = await sql`
        SELECT id, agent_code, margins_pesewas
        FROM public.airdata_agents
        WHERE agent_code = ${agentCode}
          AND status = 'active'
        LIMIT 1
      `;

      if (!agents.length) {
        return res.status(400).json({
          error: 'This agent shop is no longer available.'
        });
      }

      agent = agents[0];

      const margins = agent.margins_pesewas || {};
      marginPerGbPesewas = Number(margins[network] || 0);

      if (
        !Number.isInteger(marginPerGbPesewas) ||
        marginPerGbPesewas < 0 ||
        marginPerGbPesewas > 5000
      ) {
        return res.status(400).json({
          error: 'The agent price configuration is invalid.'
        });
      }

      agentProfitPesewas = marginPerGbPesewas * volume;
    }

    const amountPesewas = basePricePesewas + agentProfitPesewas;
    const reference = `ADGH-${randomUUID()}`;

    await sql`
      INSERT INTO public.guest_data_orders (
        reference,
        network,
        volume_gb,
        recipient,
        retail_price_pesewas,
        payment_status,
        payment_provider,
        status,
        customer_user_id,
        agent_id,
        agent_code,
        base_price_pesewas,
        agent_margin_per_gb_pesewas,
        agent_profit_pesewas,
        agent_commission_status
      )
      VALUES (
        ${reference},
        ${network},
        ${volume},
        ${recipient},
        ${amountPesewas},
        'pending',
        'paystack',
        'awaiting_payment',
        ${customerUser?.id || null},
        ${agent?.id || null},
        ${agent?.agent_code || null},
        ${basePricePesewas},
        ${marginPerGbPesewas},
        ${agentProfitPesewas},
        ${agent ? 'pending' : null}
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
            recipient,
            agent_code: agent?.agent_code || null
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
        error: result?.message ||
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
