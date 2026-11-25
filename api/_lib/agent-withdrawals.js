import { getDatabase, requireUser } from './wallet.js';

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const name = String(req.body?.recipient_name || '').trim();
  const phone = String(req.body?.recipient_phone || '').trim();
  const network = String(req.body?.recipient_network || '').trim();
  const amount = Number(req.body?.amount_pesewas);

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: 'Enter the recipient’s full name.'
    });
  }

  if (!/^0\d{9}$/.test(phone)) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit Ghana phone number.'
    });
  }

  if (!NETWORKS.includes(network)) {
    return res.status(400).json({
      error: 'Select a valid mobile money network.'
    });
  }

  if (!Number.isInteger(amount) || amount < 1000) {
    return res.status(400).json({
      error: 'Minimum withdrawal is GH₵10.00.'
    });
  }

  try {
    const sql = await getDatabase();

    const agents = await sql`
      SELECT id
      FROM public.airdata_agents
      WHERE user_id = ${user.id}
        AND status = 'active'
      LIMIT 1
    `;

    if (!agents.length) {
      return res.status(404).json({
        error: 'Create your Agent Shop first.'
      });
    }

    const agentId = agents[0].id;

    const created = await sql`
      WITH totals AS (
        SELECT
          COALESCE((
            SELECT SUM(amount_pesewas)
            FROM public.airdata_agent_commissions
            WHERE agent_id = ${agentId}
              AND status = 'earned'
          ), 0)
          -
          COALESCE((
            SELECT SUM(amount_pesewas)
            FROM public.airdata_agent_withdrawals
            WHERE agent_id = ${agentId}
              AND status IN ('requested', 'processing', 'paid')
          ), 0) AS available
      )
      INSERT INTO public.airdata_agent_withdrawals (
        agent_id,
        amount_pesewas,
        recipient_name,
        recipient_phone,
        recipient_network,
        status
      )
      SELECT
        ${agentId},
        ${amount},
        ${name},
        ${phone},
        ${network},
        'requested'
      FROM totals
      WHERE available >= ${amount}
      RETURNING id, amount_pesewas, status, created_at
    `;

    if (!created.length) {
      return res.status(400).json({
        error: 'Your available agent profit is insufficient.'
      });
    }

    return res.status(201).json({
      success: true,
      message:
        'Your withdrawal request has been recorded. Mobile money payment will be processed when Paystack live disbursements are enabled.',
      withdrawal: created[0]
    });

  } catch (error) {
    console.error('Agent withdrawal error:', error.message);
    return res.status(500).json({
      error: 'Could not submit your withdrawal request.'
    });
  }
}
