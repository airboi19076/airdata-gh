
import React, { useState } from 'react';
import { authClient } from './auth-client';
import './Admin.css';

const ADMIN_EMAIL = 'samasumadu33@gmail.com';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
            {['Dashboard', 'Users', 'Orders', 'Wallets', 'Deposits', 'Settings'].map((item) => (
              <button
                key={item}
                style={styles.card}
                onClick={() =>
                  window.alert(`${item} section is awaiting secure data connection.`)
                }
              >
                <h3>{item}</h3>
                <p>Open {item} management</p>
                <span>Explore section →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="admin-login-page">
      <div className="admin-background-glow glow-left" />
      <div className="admin-background-glow glow-right" />

      <div className="admin-container">

        <header className="admin-header">
          <div className="admin-brand">
            <div className="admin-logo">AD</div>
            <div className="admin-brand-text">
              AIRDATA <span>GH</span>
            </div>
          </div>
          <div className="admin-header-status">
            <span className="admin-status-dot" />
            ADMINISTRATOR PORTAL
          </div>
        </header>

        <section className="admin-intro">
          <div className="admin-label">
            <span className="admin-label-line" />
            YOUR MANAGEMENT SPACE
          </div>

          <h1>
            Control your
            <br />
            <span>business smarter.</span>
          </h1>

          <p>
            Welcome to the AirData GH command center.
            Manage your platform with clarity, confidence
            and secure administrator access.
          </p>

          <div className="admin-highlights">
            <div className="admin-highlight">
              <span className="highlight-icon">✦</span>
              <div>
                <strong>Smart Management</strong>
                <small>Your platform, one place</small>
              </div>
            </div>

            <div className="admin-highlight">
              <span className="highlight-icon">◇</span>
              <div>
                <strong>Secure Access</strong>
                <small>Protected administrator login</small>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-login-card">

          <div className="admin-card-header">
            <div className="admin-card-logo">AD</div>

            <div className="admin-secure-status">
              <span />
              SECURE CONNECTION
            </div>
          </div>

          <div className="admin-card-heading">
            <span className="admin-eyebrow">WELCOME BACK</span>
            <h2>Admin <span>Login</span></h2>
            <p>Sign in to access your management dashboard.</p>
          </div>

          <form onSubmit={handleLogin}>

            <label htmlFor="admin-email">
              Administrator Email
            </label>

            <div className="admin-input-box">
              <span className="admin-input-icon">✉</span>
              <input
                id="admin-email"
                type="email"
                placeholder="Enter your admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="admin-password">
              Password
            </label>

            <div className="admin-input-box">
              <span className="admin-input-icon">◆</span>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>

            {message && (
              <div className="admin-error">
                <span>!</span>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="admin-submit-button"
              disabled={loading}
            >
              <span>
                {loading ? 'VERIFYING ACCESS...' : 'SIGN IN TO ADMIN PORTAL'}
              </span>

              {loading ? (
                <span className="admin-spinner" />
              ) : (
                <span className="admin-arrow">→</span>
              )}
            </button>

          </form>

          <div className="admin-divider">
            <span />
            AUTHORIZED PERSONNEL ONLY
            <span />
          </div>

          <div className="admin-security-note">
            <span>◇</span>
            Your account is protected by secure authentication.
          </div>

        </section>

        <footer className="admin-footer">
          © {new Date().getFullYear()} AIRDATA GH
          <span>•</span>
          ALL RIGHTS RESERVED
        </footer>

      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '28px',
    background: '#071426',
    color: '#ffffff',
  },
  dashboard: {
    maxWidth: '1100px',
    margin: 'auto',
  },
  heading: {
    fontSize: '30px',
    marginBottom: '8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '18px',
    marginTop: '30px',
  },
  card: {
    textAlign: 'left',
    padding: '25px',
    borderRadius: '18px',
    border: '1px solid #24496b',
    background: '#10243b',
    color: '#ffffff',
    cursor: 'pointer',
  },
};
