import React, { useEffect, useState } from 'react';

const NETWORKS = [
  'MTN',
  'AirtelTigo iShare',
  'AirtelTigo BigTime',
  'Telecel'
];

const MOMO_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

async function getToken() {
  const response = await fetch(
    'https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth/token',
    {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    }
  );

  const data = await response.json();

  if (!response.ok || typeof data?.token !== 'string') {
    throw new Error('Please sign in again.');
  }

  return data.token;
}

function money(value) {
  return (Number(value || 0) / 100).toFixed(2);
}

export default function AgentShop() {
  const [agent, setAgent] = useState(null);
  const [margins, setMargins] = useState({
    MTN: '0.25',
    'AirtelTigo iShare': '0.25',
    'AirtelTigo BigTime': '0.25',
    Telecel: '0.25'
  });
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [withdrawal, setWithdrawal] = useState({
    recipient_name: '',
    recipient_phone: '',
    recipient_network: 'MTN',
    amount: '10.00'
  });

  async function loadAgent() {
    try {
      const token = await getToken();

      const response = await fetch('/api/agent/shop', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setAgent(result);

      if (result.agent) {
        setName(result.agent.display_name || '');

        setMargins(Object.fromEntries(
          NETWORKS.map(network => [
            network,
            (
              Number(result.agent.margins_pesewas?.[network] || 0) /
              100
            ).toFixed(2)
          ])
        ));
      }
    } catch (error) {
      setMessage(error.message || 'Could not load Agent Shop.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgent();
  }, []);

  async function saveAgent(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const token = await getToken();
      const margins_pesewas = {};

      for (const network of NETWORKS) {
        const value = Number(margins[network]);

        if (!Number.isFinite(value) || value < 0 || value > 50) {
          throw new Error(
            'Profit per GB must be between GH₵0.00 and GH₵50.00.'
          );
        }

        margins_pesewas[network] = Math.round(value * 100);
      }

      const response = await fetch('/api/agent/shop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          display_name: name,
          margins_pesewas
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setMessage('Your Agent Shop and pricing have been saved.');
      await loadAgent();

    } catch (error) {
      setMessage(error.message || 'Could not save Agent Shop.');
    } finally {
      setSaving(false);
    }
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    setMessage('');

    try {
      const token = await getToken();

      const response = await fetch('/api/agent/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...withdrawal,
          amount_pesewas: Math.round(
            Number(withdrawal.amount) * 100
          )
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setMessage(result.message);
      await loadAgent();

    } catch (error) {
      setMessage(error.message || 'Withdrawal request failed.');
    }
  }

  if (loading) {
    return (
      <div className="content">
        <section className="panel">Loading Agent Shop...</section>
      </div>
    );
  }

  const available = Number(agent?.available_pesewas || 0);
  const eligible = available >= 1000;

  return (
    <div className="content">
      <section className="panel">
        <h2>Agent Shop</h2>
        <p className="muted">
          Create your personal data shop and earn profit whenever
          customers buy through your shopping link.
        </p>

        <form onSubmit={saveAgent}>
          <label>Agent / Shop Name</label>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Enter your shop name"
            required
          />

          <h3 style={{ marginTop: 25 }}>Your profit per GB</h3>
          <p className="muted">
            Set a separate profit for each network. Your profit is
            added to AirData GH's standard retail price.
          </p>

          {NETWORKS.map(network => (
            <div key={network}>
              <label>{network} — Profit per GB (GH₵)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.01"
                value={margins[network]}
                onChange={event =>
                  setMargins(previous => ({
                    ...previous,
                    [network]: event.target.value
                  }))
                }
                required
              />
            </div>
          ))}

          <button className="primary" disabled={saving}>
            {saving
              ? 'Saving...'
              : agent?.agent
                ? 'Save Agent Shop'
                : 'Create My Agent Shop'}
          </button>
        </form>

        {message && <div className="status">{message}</div>}
      </section>

      {agent?.agent && (
        <>
          <section className="panel">
            <h2>Your Personal Shopping Link</h2>
            <p className="price" style={{ overflowWrap: 'anywhere' }}>
              {agent.shop_url}
            </p>

            <button
              className="primary"
              onClick={() =>
                navigator.clipboard.writeText(agent.shop_url)
              }
            >
              Copy My Shopping Link
            </button>
          </section>

          <section className="panel">
            <h2>My Agent Earnings</h2>

            <div className="orders-summary">
              <div>
                <strong>GH₵{money(agent.total_earned_pesewas)}</strong>
                <span>Total earned</span>
              </div>

              <div>
                <strong>GH₵{money(agent.available_pesewas)}</strong>
                <span>Available profit</span>
              </div>

              <div>
                <strong>{agent.sales_count || 0}</strong>
                <span>Paid sales</span>
              </div>
            </div>

            <form onSubmit={submitWithdrawal}>
              <h3>Withdraw Agent Profit</h3>
              <p className="muted">
                Minimum withdrawal: GH₵10.00.
              </p>

              <label>Recipient Full Name</label>
              <input
                value={withdrawal.recipient_name}
                onChange={event =>
                  setWithdrawal(p => ({
                    ...p,
                    recipient_name: event.target.value
                  }))
                }
                required
              />

              <label>Mobile Money Number</label>
              <input
                value={withdrawal.recipient_phone}
                maxLength={10}
                placeholder="0241234567"
                onChange={event =>
                  setWithdrawal(p => ({
                    ...p,
                    recipient_phone: event.target.value
                      .replace(/\D/g, '')
                      .slice(0, 10)
                  }))
                }
                required
              />

              <label>Mobile Money Network</label>
              <select
                value={withdrawal.recipient_network}
                onChange={event =>
                  setWithdrawal(p => ({
                    ...p,
                    recipient_network: event.target.value
                  }))
                }
              >
                {MOMO_NETWORKS.map(network => (
                  <option key={network}>{network}</option>
                ))}
              </select>

              <label>Withdrawal Amount (GH₵)</label>
              <input
                type="number"
                min="10"
                step="0.01"
                value={withdrawal.amount}
                onChange={event =>
                  setWithdrawal(p => ({
                    ...p,
                    amount: event.target.value
                  }))
                }
                required
              />

              <button
                className="primary"
                disabled={
                  !eligible ||
                  Number(withdrawal.amount) * 100 > available
                }
                style={{
                  opacity: eligible ? 1 : 0.45,
                  cursor: eligible ? 'pointer' : 'not-allowed'
                }}
              >
                Request Withdrawal
              </button>

              {!eligible && (
                <p className="muted">
                  Your withdrawal button activates when your
                  available profit reaches GH₵10.00.
                </p>
              )}
            </form>

            <p className="orders-footnote">
              Mobile money transfers will be enabled after Paystack
              live disbursement approval.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
