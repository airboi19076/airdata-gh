
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
                onClick={() => window.alert(`${item} section is awaiting secure data connection.`)}
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
      <div className="login-background">
        <div className="login-glow glow-one"></div>
        <div className="login-glow glow-two"></div>
        <div className="login-grid"></div>
        <div className="floating-orb orb-one"></div>
        <div className="floating-orb orb-two"></div>
        <div className="floating-orb orb-three"></div>
      </div>

      <div className="login-layout">
        <section className="login-showcase">
          <div className="admin-brand">
            <div className="orbital-logo">
              <div className="orbit orbit-one"></div>
              <div className="orbit orbit-two"></div>
              <div className="orbit orbit-three"></div>
              <div className="orbit-core">AD</div>
              <span className="orbit-star">✦</span>
            </div>
            <span>AIRDATA <strong>GH</strong></span>
          </div>

          <div className="showcase-content">
            <span className="showcase-label">
              <span className="live-dot"></span>
              ADMIN CONTROL CENTER
            </span>

            <h1>
              Your platform.
              <br />
              <span>Your control.</span>
            </h1>

            <p>
              A smarter command center for managing your AirData GH
              platform with confidence, clarity and complete control.
            </p>

            <div className="showcase-features">
              <div className="feature-item">
                <span className="feature-icon">✦</span>
                <div>
                  <strong>Smart Management</strong>
                  <small>Everything in one place</small>
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">◈</span>
                <div>
                  <strong>Secure Access</strong>
                  <small>Administrator sign-in</small>
                </div>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            AIRDATA GH <span>•</span> MANAGEMENT SYSTEM
          </div>
        </section>

        <section className="login-form-side">
          <div className="login-card">
            <div className="login-card-top">
              <div className="login-mini-logo">AD</div>
              <span className="secure-label">
                <span className="live-dot"></span>
                SECURE PORTAL
              </span>
            </div>

            <div className="login-heading">
              <span className="eyebrow">WELCOME BACK</span>
              <h2>Admin <span>Login</span></h2>
              <p>Sign in to access your management dashboard.</p>
            </div>

            <form onSubmit={handleLogin}>
              <label htmlFor="admin-email">Administrator Email</label>
              <div className="login-input-wrap">
                <span className="input-icon">✉</span>
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

              <label htmlFor="admin-password">Password</label>
              <div className="login-input-wrap">
                <span className="input-icon">♙</span>
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
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {message && (
                <div className="login-error">
                  <span>!</span> {message}
                </div>
              )}

              <button
                className="admin-login-button"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'VERIFYING ACCESS...' : 'ACCESS ADMIN DASHBOARD'}</span>
                {!loading && <span className="button-arrow">→</span>}
                {loading && <span className="login-spinner"></span>}
              </button>
            </form>

            <div className="login-divider">
              <span></span>
              <small>AUTHORIZED PERSONNEL ONLY</small>
              <span></span>
            </div>

            <div className="login-security">
              <span>◈</span>
              Your session is protected by account authentication.
            </div>
          </div>

          <p className="login-copyright">
            © {new Date().getFullYear()} AirData GH. All rights reserved.
          </p>
        </section>
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
