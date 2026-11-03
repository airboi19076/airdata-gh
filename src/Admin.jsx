
import React, { useState } from 'react';
import { authClient } from './auth-client';

const ADMIN_EMAIL = 'samasumadu33@gmail.com';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
        throw new Error('Access denied. Administrator email required.');
      }

      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setLoggedIn(true);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loggedIn) {
    return (
      <div style={styles.page}>
        <div style={styles.dashboard}>
          <h1 style={styles.heading}>AirData GH Admin</h1>
          <p>Welcome, Administrator.</p>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3>Dashboard</h3>
              <p>Manage your AirData GH platform.</p>
            </div>

            <div style={styles.card}>
              <h3>Users</h3>
              <p>User management section.</p>
            </div>

            <div style={styles.card}>
              <h3>Orders</h3>
              <p>Bundle orders management section.</p>
            </div>

            <div style={styles.card}>
              <h3>Wallets</h3>
              <p>Wallet management section.</p>
            </div>

            <div style={styles.card}>
              <h3>Deposits</h3>
              <p>Deposit records section.</p>
            </div>

            <div style={styles.card}>
              <h3>Settings</h3>
              <p>Platform settings section.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.login}>
        <h1 style={styles.heading}>AD</h1>
        <h2>Admin Portal</h2>
        <p>AirData GH Management System</p>

        <form onSubmit={handleLogin}>
          <label>Administrator Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter administrator email"
            required
          />

          <label>Administrator Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          <button style={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Secure Admin Login'}
          </button>
        </form>

        {message && <p style={styles.error}>{message}</p>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#080d18',
    color: '#ffffff',
    padding: '25px',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
  },
  login: {
    maxWidth: '420px',
    margin: '70px auto',
    padding: '30px',
    background: '#111b2d',
    borderRadius: '16px',
    border: '1px solid #263750',
  },
  dashboard: {
    maxWidth: '1000px',
    margin: '30px auto',
  },
  heading: {
    color: '#38bdf8',
    textAlign: 'center',
  },
  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px',
    margin: '10px 0 20px',
    borderRadius: '8px',
    border: '1px solid #334155',
    background: '#080d18',
    color: '#ffffff',
  },
  button: {
    width: '100%',
    padding: '15px',
    border: 'none',
    borderRadius: '8px',
    background: '#0284c7',
    color: '#ffffff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '18px',
    marginTop: '30px',
  },
  card: {
    background: '#111b2d',
    border: '1px solid #263750',
    borderRadius: '12px',
    padding: '22px',
  },
};
