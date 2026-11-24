export async function creditAgentCommission(sql, reference) {
  const result = await sql`
    WITH credited AS (
      INSERT INTO public.airdata_agent_commissions (
        agent_id,
        order_reference,
        amount_pesewas,
        status
      )
      SELECT
        agent_id,
        reference,
        agent_profit_pesewas,
        'earned'
      FROM public.guest_data_orders
      WHERE reference = ${reference}
        AND payment_status = 'paid'
        AND supplier_status = 'completed'
        AND agent_id IS NOT NULL
        AND agent_profit_pesewas > 0
      ON CONFLICT (order_reference) DO NOTHING
      RETURNING order_reference
    )
    UPDATE public.guest_data_orders
    SET agent_commission_status = 'earned',
        updated_at = now()
    WHERE reference IN (
      SELECT order_reference FROM credited
    )
    RETURNING reference
  `;

  return result.length > 0;
}
