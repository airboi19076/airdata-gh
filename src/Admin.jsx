
import React, { useState } from 'react';
import { authClient } from './auth-client';
import './Admin.css';

const ADMIN_EMAIL = 'samasumadu33@gmail.com';

const sections = [
  { id: 'overview', icon: '▦', title: 'Overview', subtitle: 'Your business at a glance' },
  { id: 'users', icon: '♙', title: 'Customers', subtitle: 'Manage customer accounts' },
  { id: 'orders', icon: '▣', title: 'Orders', subtitle: 'Manage bundle orders' },
  { id: 'wallets', icon: '◈', title: 'Wallets', subtitle: 'Customer wallet accounts' },
  { id: 'deposits', icon: '↗', title: 'Deposits', subtitle: 'Payment and deposit records' },
  { id: 'settings', icon: '⚙', title: 'Settings', subtitle: 'Configure your platform' },
];

const pageDescriptions = {
  users: 'View and manage registered AirData GH customers.',
  orders: 'Monitor data bundle purchases and order records.',
  wallets: 'Review customer wallet accounts and balances.',
  deposits: 'Review payment records and deposit transactions.',
  settings: 'Manage your platform preferences and configuration.',
};

function OrbitalLogo({ small = false }) {
  return (
    <div className={`orbital-logo ${small ? 'orbital-logo-small' : ''}`}>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit orbit-three" />
      <div className="orbit-core">AD</div>
      <span className="orbit-star star-one" />
      <span className="orbit-star star-two" />
    </div>
  );
}

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      setActivePage('overview');
      setPassword('');
    } catch (error) {
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }

    setLoggedIn(false);
    setActivePage('overview');
    setEmail('');
    setPassword('');
  };

  const navigate = (id) => {
    setActivePage(id);
    setSidebarOpen(false);
  };

  const current = sections.find((item) => item.id === activePage);

  if (!loggedIn) {
    return (
      <div className="admin-login-page">
        <div className="login-grid-bg" />
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />

        <div className="login-layout">
          <section className="login-showcase">
            <div className="showcase-brand">
              <OrbitalLogo />
              <div>
                <div className="showcase-brand-name">AIRDATA <span>GH</span></div>
                <div className="showcase-brand-caption">DIGITAL SERVICES PLATFORM</div>
              </div>
            </div>

            <div className="showcase-content">
              <div className="showcase-pill">
                <span className="pulse-dot" />
                PRIVATE ADMINISTRATION SYSTEM
              </div>

              <h1>
                Your business.
                <br />
                <span>Your command.</span>
              </h1>

              <p>
                One powerful control centre to manage your customers,
                transactions and the future of AirData GH.
              </p>

              <div className="showcase-features">
                <div><span>✦</span> Complete platform control</div>
                <div><span>✦</span> Customer and order management</div>
                <div><span>✦</span> Secure administrator access</div>
              </div>
            </div>

            <div className="showcase-footer">
              AIRDATA GH <span>•</span> BUILT FOR GROWTH
            </div>
          </section>

          <section className="login-form-side">
            <div className="login-card">
              <div className="login-card-logo">
                <OrbitalLogo small />
              </div>

              <div className="login-eyebrow">ADMINISTRATOR ACCESS</div>
              <h2>Welcome back.</h2>
              <p className="login-description">
                Sign in with your administrator account to continue.
              </p>

              <form onSubmit={handleLogin}>
                <label className="admin-label">Email address</label>
                <div className="admin-input-wrap">
                  <span>✉</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Administrator email"
                    autoComplete="username"
                    required
                  />
                </div>

                <label className="admin-label">Password</label>
                <div className="admin-input-wrap">
                  <span>⌑</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button className="admin-signin-button" disabled={loading}>
                  {loading ? 'AUTHENTICATING...' : 'ENTER ADMIN PORTAL'}
                  {!loading && <span>→</span>}
                </button>
              </form>

              {message && <div className="admin-error">{message}</div>}

              <div className="login-security">
                <span>◈</span>
                PRIVATE ADMINISTRATOR AREA
              </div>
            </div>

            <div className="login-bottom-note">
              © 2026 AirData GH. All rights reserved.
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {sidebarOpen && (
        <button
          className="admin-mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <OrbitalLogo small />
          <div>
            <div className="sidebar-brand-name">AIRDATA <span>GH</span></div>
            <div className="sidebar-brand-caption">ADMIN CONTROL</div>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="admin-navigation">
          {sections.map((item) => (
            <button
              key={item.id}
              className={`admin-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.title}</span>
              {activePage === item.id && <span className="nav-active-arrow">›</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <div className="account-avatar">A</div>
            <div>
              <strong>Administrator</strong>
              <small>Platform owner</small>
            </div>
            <span className="account-status" />
          </div>

          <button className="admin-logout-button" onClick={handleLogout}>
            <span>↪</span> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-menu-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <div className="topbar-heading">
            <div className="topbar-breadcrumb">AIRDATA GH <span>/</span> ADMIN</div>
            <h2>{current?.title || 'Overview'}</h2>
          </div>

          <div className="topbar-right">
            <div className="admin-status">
              <span className="pulse-dot" />
              ADMIN PORTAL
            </div>
            <div className="topbar-avatar">A</div>
          </div>
        </header>

        <div className="admin-content">
          {activePage === 'overview' ? (
            <>
              <section className="admin-welcome-banner">
                <div className="welcome-banner-content">
                  <div className="welcome-overline">YOUR MANAGEMENT CENTRE</div>
                  <h1>Welcome back, <span>Admin.</span></h1>
                  <p>
                    Everything you need to manage and grow AirData GH,
                    all in one place.
                  </p>
                  <div className="welcome-live-label">
                    <span className="pulse-dot" /> ADMIN WORKSPACE
                  </div>
                </div>
                <div className="welcome-orbit-art">
                  <OrbitalLogo />
                </div>
                <div className="welcome-decoration" />
              </section>

              <div className="admin-section-heading">
                <div>
                  <div className="section-overline">CONTROL CENTRE</div>
                  <h2>Manage your platform</h2>
                  <p>Choose a management area to continue.</p>
                </div>
                <div className="section-count">06 <span>SECTIONS</span></div>
              </div>

              <div className="admin-module-grid">
                {sections.filter((item) => item.id !== 'overview').map((item, index) => (
                  <button
                    key={item.id}
                    className={`admin-module-card module-${index + 1}`}
                    onClick={() => navigate(item.id)}
                  >
                    <div className="module-card-top">
                      <div className="module-icon">{item.icon}</div>
                      <span className="module-open">↗</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                    <div className="module-card-bottom">
                      <span>OPEN MANAGEMENT</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="admin-setup-notice">
                <div className="notice-symbol">i</div>
                <div>
                  <strong>Platform data connection</strong>
                  <p>
                    Your management pages are ready for their secure data
                    connection. Customer records, orders and payment
                    information will appear once server-side admin
                    authorization is configured.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <section className="admin-detail-page">
              <button
                className="admin-back-button"
                onClick={() => navigate('overview')}
              >
                <span>←</span> Back to overview
              </button>

              <div className="detail-hero">
                <div className="detail-icon">{current?.icon}</div>
                <div>
                  <div className="section-overline">AIRDATA GH MANAGEMENT</div>
                  <h1>{current?.title}</h1>
                  <p>{pageDescriptions[activePage]}</p>
                </div>
              </div>

              <div className="detail-placeholder">
                <div className="placeholder-orbit">
                  <OrbitalLogo small />
                </div>
                <div className="placeholder-label">MANAGEMENT MODULE</div>
                <h2>{current?.title}</h2>
                <p>
                  This management page has been created. Live records and
                  controls will be enabled after the secure administrator
                  data connection is completed.
                </p>
                <button
                  className="admin-back-button"
                  onClick={() => navigate('overview')}
                >
                  Return to overview →
                </button>
              </div>
            </section>
          )}

          <footer className="admin-footer">
            <span>AIRDATA GH</span> · ADMINISTRATION CONSOLE · © 2026
          </footer>
        </div>
      </main>
    </div>
  );
}
