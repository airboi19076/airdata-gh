import { randomBytes } from 'node:crypto';
import { getDatabase, requireUser } from './wallet.js';

const NETWORKS = [
  'MTN',
  'AirtelTigo iShare',
  'AirtelTigo BigTime',
  'Telecel'
];

function validateMargins(input) {
  const result = {};

  for (const network of NETWORKS) {
    const amount = Number(input?.[network] ?? 0);

    if (!Number.isInteger(amount) || amount < 0 || amount > 5000) {
      throw new Error(
        'Profit per GB must be between GH₵0.00 and GH₵50.00.'
      );
    }

    result[network] = amount;
  }

  return result;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const sql = await getDatabase();

    // Public lookup used by customers opening an agent link.
    if (req.method === 'GET' && req.query?.code) {
      const code = String(req.query.code).trim().toUpperCase();

      if (!/^[A-F0-9]{12}$/.test(code)) {
        return res.status(400).json({ error: 'Invalid agent link.' });
      }

      const agents = await sql`
        SELECT agent_code, display_name, margins_pesewas
        FROM public.airdata_agents
        WHERE agent_code = ${code}
          AND status = 'active'
        LIMIT 1
      `;

      if (!agents.length) {
        return res.status(404).json({
          error: 'This agent shop is not available.'
        });
      }

      return res.status(200).json({
        success: true,
        agent: agents[0]
      });
    }

    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method === 'POST') {
      let margins;

      try {
        margins = validateMargins(req.body?.margins_pesewas);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const displayName = String(
        req.body?.display_name || user.email || 'AirData Agent'
      ).trim().slice(0, 80);

      const existing = await sql`
        SELECT agent_code
        FROM public.airdata_agents
        WHERE user_id = ${user.id}
        LIMIT 1
      `;

      const code = existing[0]?.agent_code ||
        randomBytes(6).toString('hex').toUpperCase();

      const saved = await sql`
        INSERT INTO public.airdata_agents
          (user_id, agent_code, display_name, margins_pesewas, status)
        VALUES (
          ${user.id},
          ${code},
          ${displayName},
          ${JSON.stringify(margins)}::jsonb,
          'active'
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          margins_pesewas = EXCLUDED.margins_pesewas,
          updated_at = now()
        RETURNING agent_code, display_name, margins_pesewas, status
      `;

      return res.status(200).json({
        success: true,
        agent: saved[0],
        shop_url:
          `https://airdata-gh.vercel.app/?agent=${saved[0].agent_code}`
      });
    }

    const agents = await sql`
      SELECT id, agent_code, display_name, margins_pesewas, status
      FROM public.airdata_agents
      WHERE user_id = ${user.id}
      LIMIT 1
    `;

    if (!agents.length) {
      return res.status(200).json({
        success: true,
        agent: null
      });
    }

    const agent = agents[0];

    const totals = await sql`
      SELECT
        COALESCE((
          SELECT SUM(amount_pesewas)
          FROM public.airdata_agent_commissions
          WHERE agent_id = ${agent.id}
            AND status = 'earned'
        ), 0)::bigint AS total_earned,

        COALESCE((
          SELECT SUM(amount_pesewas)
          FROM public.airdata_agent_withdrawals
          WHERE agent_id = ${agent.id}
            AND status IN ('requested', 'processing', 'paid')
        ), 0)::bigint AS reserved,

        (
          SELECT COUNT(*)
          FROM public.guest_data_orders
          WHERE agent_id = ${agent.id}
            AND payment_status = 'paid'
        )::int AS sales_count
    `;

    const withdrawals = await sql`
      SELECT id, amount_pesewas, recipient_name,
        recipient_phone, recipient_network, status, created_at
      FROM public.airdata_agent_withdrawals
      WHERE agent_id = ${agent.id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const earned = Number(totals[0].total_earned || 0);
    const reserved = Number(totals[0].reserved || 0);

    return res.status(200).json({
      success: true,
      agent,
      shop_url:
        `https://airdata-gh.vercel.app/?agent=${agent.agent_code}`,
      total_earned_pesewas: earned,
      reserved_pesewas: reserved,
      available_pesewas: Math.max(0, earned - reserved),
      sales_count: Number(totals[0].sales_count || 0),
      withdrawals
    });

  } catch (error) {
    console.error('Agent shop error:', error.message);
    return res.status(500).json({
      error: 'Could not load your Agent Shop.'
    });
  }
}
