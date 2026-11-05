
import React, { useState, useEffect, useCallback } from 'react';
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

  const [activeSection, setActiveSection] = useState('Dashboard');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');

    try {
      const token = await authClient.getJWTToken();

      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load registered users.');
      }

      setUsers(data.users || []);
    } catch (error) {
      setUsersError(error.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadUsers();
    }
  }, [loggedIn, loadUsers]);

  
const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setMessage('');

  let stage = 'Checking administrator email';

  try {
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Administrator email required.');
    }

    stage = 'Signing in through Neon Auth';

    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    stage = 'Reading authentication token';

    const token = await authClient.getJWTToken();

if (!token) {
  throw new Error('No access token was returned. Please log in again.');
}

    stage = 'Verifying administrator access';

    const verification = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const verificationData = await verification.json();

    if (!verification.ok || !verificationData.authorised) {
      throw new Error(
        `Verification API returned ${verification.status}: ${
          verificationData.error || 'Access denied'
        }`
      );
    }

    setLoggedIn(true);
  } catch (error) {
    setMessage(`${stage}: ${error.message || 'Login failed.'}`);
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
    setUsers([]);
    setPassword('');
    setActiveSection('Dashboard');
  };

  const menuItems = [
    'Dashboard',
    'Users',
    'Orders',
    'Wallets',
    'Deposits',
    'Settings',
  ];

  if (loggedIn) {
    return (
      <div style={styles.page}>
        <div style={styles.dashboard}>
          <header style={styles.topbar}>
            <div>
              <h1 style={styles.heading}>AIRDATA <span style={{color:'#27d9ff'}}>GH</span></h1>
              <p style={styles.subheading}>Administrator Control Center</p>
            </div>

            <button style={styles.logout} onClick={handleLogout}>
              Logout
            </button>
          </header>

          <nav style={styles.navigation}>
            {menuItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                style={{
                  ...styles.navButton,
                  ...(activeSection === item ? styles.activeNav : {}),
                }}
              >
                {item}
              </button>
            ))}
          </nav>

          {activeSection === 'Dashboard' && (
            <section>
              <h2 style={styles.sectionTitle}>Dashboard Overview</h2>
              <p style={styles.subheading}>
                Welcome back, Administrator. Here is your website activity.
              </p>

              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>REGISTERED USERS</span>
                  <h2 style={styles.statNumber}>
                    {usersLoading ? '...' : users.length}
                  </h2>
                  <button
                    style={styles.smallButton}
                    onClick={() => setActiveSection('Users')}
                  >
                    View Customers →
                  </button>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>ORDERS</span>
                  <h2 style={styles.statNumber}>—</h2>
                  <span style={styles.statNote}>Connection pending</span>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>WALLETS</span>
                  <h2 style={styles.statNumber}>—</h2>
                  <span style={styles.statNote}>Connection pending</span>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>DEPOSITS</span>
                  <h2 style={styles.statNumber}>—</h2>
                  <span style={styles.statNote}>Connection pending</span>
                </div>
              </div>

              {usersError && (
                <p style={styles.error}>{usersError}</p>
              )}

              <button style={styles.refreshButton} onClick={loadUsers}>
                {usersLoading ? 'Refreshing...' : '↻ Refresh Dashboard'}
              </button>
            </section>
          )}

          {activeSection === 'Users' && (
            <section>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Registered Customers</h2>
                  <p style={styles.subheading}>
                    Customers who have created an AirData GH account.
                  </p>
                </div>

                <button
                  style={styles.refreshButton}
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? 'Loading...' : '↻ Refresh'}
                </button>
              </div>

              <div style={styles.userSummary}>
                Total registered accounts: <strong>{users.length}</strong>
              </div>

              {usersError && (
                <p style={styles.error}>{usersError}</p>
              )}

              {usersLoading ? (
                <p style={styles.empty}>Loading customer accounts...</p>
              ) : users.length === 0 && !usersError ? (
                <p style={styles.empty}>No registered customers found yet.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Customer</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Verification</th>
                        <th style={styles.th}>Registration Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td style={styles.td}>{user.name || 'Customer'}</td>
                          <td style={styles.td}>{user.email}</td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.status,
                                background: user.emailVerified
                                  ? '#123f32'
                                  : '#49351b',
                                color: user.emailVerified
                                  ? '#64e6ac'
                                  : '#ffd27b',
                              }}
                            >
                              {user.emailVerified ? 'Verified' : 'Not verified'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection !== 'Dashboard' && activeSection !== 'Users' && (
            <section style={styles.placeholder}>
              <h2 style={styles.sectionTitle}>{activeSection}</h2>
              <p style={styles.subheading}>
                This section will be connected to the live website in our next steps.
              </p>
            </section>
          )}

          <footer style={styles.footer}>
            AIRDATA GH ADMINISTRATION
          </footer>
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
            <label htmlFor="admin-email">Administrator Email</label>

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

            <label htmlFor="admin-password">Password</label>

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
    padding: '24px',
    background: '#071426',
    color: '#ffffff',
    boxSizing: 'border-box',
  },
  dashboard: {
    maxWidth: '1200px',
    margin: 'auto',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    marginBottom: '28px',
  },
  heading: {
    fontSize: '27px',
    margin: 0,
    fontWeight: 900,
  },
  subheading: {
    color: '#91a9c3',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  logout: {
    background: '#e74755',
    color: '#fff',
    border: 0,
    borderRadius: '10px',
    padding: '12px 20px',
    cursor: 'pointer',
  },
  navigation: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '9px',
    marginBottom: '35px',
    borderBottom: '1px solid #203a55',
    paddingBottom: '18px',
  },
  navButton: {
    padding: '12px 17px',
    background: '#10243b',
    color: '#c3d5e9',
    border: '1px solid #24496b',
    borderRadius: '9px',
    cursor: 'pointer',
  },
  activeNav: {
    background: '#087eac',
    color: '#ffffff',
    borderColor: '#27d9ff',
  },
  sectionTitle: {
    fontSize: '23px',
    marginBottom: '8px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '17px',
    marginTop: '25px',
  },
  statCard: {
    background: '#10243b',
    border: '1px solid #24496b',
    borderRadius: '16px',
    padding: '22px',
  },
  statLabel: {
    color: '#92b4d2',
    fontSize: '11px',
    letterSpacing: '1px',
  },
  statNumber: {
    fontSize: '36px',
    margin: '15px 0',
    color: '#27d9ff',
  },
  statNote: {
    color: '#91a9c3',
    fontSize: '12px',
  },
  smallButton: {
    border: 0,
    background: 'transparent',
    color: '#27d9ff',
    cursor: 'pointer',
    padding: 0,
  },
  refreshButton: {
    background: '#087eac',
    color: '#ffffff',
    border: 0,
    padding: '11px 17px',
    borderRadius: '9px',
    cursor: 'pointer',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
  },
  userSummary: {
    padding: '15px',
    background: '#10243b',
    borderRadius: '10px',
    margin: '20px 0',
    color: '#c3d5e9',
  },
  tableWrapper: {
    overflowX: 'auto',
    background: '#10243b',
    borderRadius: '12px',
    border: '1px solid #24496b',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '650px',
    textAlign: 'left',
  },
  th: {
    padding: '15px',
    color: '#27d9ff',
    borderBottom: '1px solid #24496b',
    fontSize: '13px',
  },
  td: {
    padding: '15px',
    borderBottom: '1px solid #203a55',
    color: '#e2edf8',
    fontSize: '13px',
  },
  status: {
    padding: '6px 9px',
    borderRadius: '20px',
    fontSize: '11px',
  },
  empty: {
    padding: '25px',
    color: '#91a9c3',
    textAlign: 'center',
  },
  error: {
    color: '#ff8585',
    background: '#3d2029',
    padding: '12px',
    borderRadius: '9px',
  },
  placeholder: {
    padding: '30px',
    background: '#10243b',
    borderRadius: '15px',
  },
  footer: {
    marginTop: '55px',
    paddingTop: '20px',
    borderTop: '1px solid #203a55',
    color: '#66819e',
    fontSize: '11px',
    textAlign: 'center',
    letterSpacing: '1px',
  },
};
