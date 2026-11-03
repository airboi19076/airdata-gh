
import React, { useState } from 'react';
import { authClient } from './auth-client';

const ADMIN_EMAIL = 'samasumadu33@gmail.com';

const menu = [
  { id: 'overview', icon: '▦', name: 'Overview' },
  { id: 'users', icon: '♙', name: 'Customers' },
  { id: 'orders', icon: '▣', name: 'Orders' },
  { id: 'wallets', icon: '◈', name: 'Wallets' },
  { id: 'deposits', icon: '↗', name: 'Deposits' },
  { id: 'settings', icon: '⚙', name: 'Settings' },
];

const descriptions = {
  users: 'Manage customer accounts and registered users.',
  orders: 'Monitor data bundle orders and their status.',
  wallets: 'Review customer wallet accounts and balances.',
  deposits: 'Review customer deposits and payment records.',
  settings: 'Manage your AirData GH platform settings.',
};

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
      console.error(error);
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

  if (!loggedIn) {
    return (
      <div style={s.loginPage}>
        <div style={s.loginGlow} />
        <div style={s.loginCard}>
          <div style={s.brandMark}>AD</div>
          <div style={s.brandName}>AIRDATA <span>GH</span></div>
          <div style={s.loginTag}>ADMINISTRATION CONSOLE</div>

          <div style={s.loginDivider} />

          <h1 style={s.loginTitle}>Welcome back</h1>
          <p style={s.loginText}>Sign in to manage your platform.</p>

          <form onSubmit={handleLogin}>
            <label style={s.label}>Administrator email</label>
            <input
              style={s.loginInput}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />

            <label style={s.label}>Password</label>
            <input
              style={s.loginInput}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <button style={s.loginButton} disabled={loading}>
              {loading ? 'AUTHENTICATING...' : 'SIGN IN TO ADMIN PORTAL →'}
            </button>
          </form>

          {message && <div style={s.error}>{message}</div>}
          <p style={s.loginFooter}>SECURE MANAGEMENT ACCESS</p>
        </div>
      </div>
    );
  }

  const current = menu.find(item => item.id === activePage);

  return (
    <div style={s.app}>
      {sidebarOpen && (
        <div style={s.mobileOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <aside style={{
        ...s.sidebar,
        ...(sidebarOpen ? s.sidebarVisible : {}),
      }}>
        <div style={s.sidebarBrand}>
          <div style={s.smallLogo}>AD</div>
          <div>
            <div style={s.brandName}>AIRDATA <span>GH</span></div>
            <div style={s.sidebarCaption}>ADMIN CONSOLE</div>
          </div>
        </div>

        <div style={s.menuLabel}>MAIN MENU</div>

        <nav>
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              style={{
                ...s.navItem,
                ...(activePage === item.id ? s.navActive : {}),
              }}
            >
              <span style={s.navIcon}>{item.icon}</span>
              <span>{item.name}</span>
              {activePage === item.id && <span style={s.navArrow}>›</span>}
            </button>
          ))}
        </nav>

        <div style={s.sidebarBottom}>
          <div style={s.adminProfile}>
            <div style={s.avatar}>A</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.profileName}>Administrator</div>
              <div style={s.profileRole}>Platform owner</div>
            </div>
          </div>
          <button style={s.logout} onClick={handleLogout}>
            ↪ &nbsp; Sign out
          </button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.topbar}>
          <button style={s.menuToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div>
            <div style={s.breadcrumb}>AIRDATA GH / ADMIN</div>
            <div style={s.pageName}>{current?.name || 'Overview'}</div>
          </div>
          <div style={s.topRight}>
            <div style={s.onlineDot} />
            <span style={s.onlineText}>Admin portal</span>
          </div>
        </header>

        <div style={s.content}>
          {activePage === 'overview' ? (
            <>
              <div style={s.hero}>
                <div>
                  <div style={s.heroTag}>MANAGEMENT OVERVIEW</div>
                  <h1 style={s.heroTitle}>Welcome back, Admin.</h1>
                  <p style={s.heroText}>
                    Manage your AirData GH business from one place.
                  </p>
                </div>
                <div style={s.heroSymbol}>◈</div>
              </div>

              <div style={s.sectionTitle}>
                <div>
                  <h2 style={s.heading}>Platform Management</h2>
                  <p style={s.muted}>Choose a section to get started.</p>
                </div>
              </div>

              <div style={s.cards}>
                {menu.filter(item => item.id !== 'overview').map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    style={s.card}
                  >
                    <div style={s.cardTop}>
                      <div style={{
                        ...s.cardIcon,
                        background: [
                          '#102e46', '#20264a', '#123c3b',
                          '#3a2c1d', '#30254a'
                        ][index],
                      }}>{item.icon}</div>
                      <span style={s.cardArrow}>↗</span>
                    </div>
                    <h3 style={s.cardTitle}>{item.name}</h3>
                    <p style={s.cardDescription}>{descriptions[item.id]}</p>
                    <div style={s.cardLink}>OPEN SECTION <span>→</span></div>
                  </button>
                ))}
              </div>

              <div style={s.notice}>
                <span style={s.noticeIcon}>i</span>
                <div>
                  <strong>Dashboard setup</strong>
                  <p>
                    Live customer, wallet, order and deposit information
                    will appear when the secure admin data connection is completed.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div style={s.innerPage}>
              <button
                style={s.backButton}
                onClick={() => navigate('overview')}
              >
                ← Back to overview
              </button>

              <div style={s.innerHero}>
                <div style={s.innerIcon}>{current?.icon}</div>
                <div>
                  <div style={s.heroTag}>AIRDATA GH MANAGEMENT</div>
                  <h1 style={s.innerTitle}>{current?.name}</h1>
                  <p style={s.muted}>{descriptions[activePage]}</p>
                </div>
              </div>

              <div style={s.emptyPanel}>
                <div style={s.emptyIcon}>{current?.icon}</div>
                <h2>{current?.name} management</h2>
                <p>
                  This page has been created. Its live records and management
                  controls will be connected after secure administrator
                  authorization is configured.
                </p>
                <button
                  style={s.backButton}
                  onClick={() => navigate('overview')}
                >
                  Return to dashboard
                </button>
              </div>
            </div>
          )}

          <footer style={s.footer}>
            AIRDATA GH © 2026 · ADMINISTRATION CONSOLE
          </footer>
        </div>
      </main>
    </div>
  );
}

const s = {
  loginPage: {
    minHeight: '100vh',
    background: '#07111f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '22px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    color: '#f8fafc',
  },
  loginGlow: {
    position: 'absolute',
    width: '320px',
    height: '320px',
    background: '#087dbb',
    filter: 'blur(150px)',
    opacity: 0.22,
    top: '10%',
    left: '20%',
  },
  loginCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '430px',
    padding: '36px 30px',
    borderRadius: '20px',
    background: '#101d30',
    border: '1px solid #243b56',
    boxShadow: '0 25px 80px #0008',
    boxSizing: 'border-box',
  },
  brandMark: {
    width: '55px',
    height: '55px',
    borderRadius: '15px',
    background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '22px',
    fontWeight: '900',
    marginBottom: '15px',
  },
  brandName: {
    fontWeight: '900',
    letterSpacing: '2px',
    fontSize: '19px',
    color: '#f8fafc',
  },
  loginTag: {
    color: '#38bdf8',
    fontSize: '10px',
    letterSpacing: '2px',
    marginTop: '7px',
  },
  loginDivider: {
    height: '1px',
    background: '#263b54',
    margin: '27px 0',
  },
  loginTitle: { fontSize: '28px', margin: '0 0 8px' },
  loginText: { color: '#94a3b8', marginBottom: '28px' },
  label: {
    display: 'block',
    color: '#cbd5e1',
    fontSize: '13px',
    margin: '18px 0 8px',
  },
  loginInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '15px',
    borderRadius: '9px',
    border: '1px solid #344b65',
    background: '#091525',
    color: '#fff',
    outline: 'none',
    fontSize: '14px',
  },
  loginButton: {
    width: '100%',
    marginTop: '25px',
    padding: '16px',
    border: 'none',
    borderRadius: '9px',
    background: 'linear-gradient(100deg,#0284c7,#2563eb)',
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: '1px',
    cursor: 'pointer',
  },
  error: {
    color: '#fca5a5',
    background: '#451a1a',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '15px',
    fontSize: '13px',
  },
  loginFooter: {
    textAlign: 'center',
    fontSize: '10px',
    color: '#64748b',
    letterSpacing: '2px',
    marginTop: '28px',
  },
  app: {
    minHeight: '100vh',
    display: 'flex',
    background: '#080f1c',
    color: '#f1f5f9',
    fontFamily: 'Arial, sans-serif',
  },
  sidebar: {
    width: '245px',
    flexShrink: 0,
    minHeight: '100vh',
    background: '#0c1727',
    borderRight: '1px solid #1d3048',
    padding: '24px 15px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 5,
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    padding: '4px 8px 32px',
  },
  smallLogo: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: '900',
  },
  sidebarCaption: {
    color: '#38bdf8',
    fontSize: '9px',
    letterSpacing: '1.5px',
    marginTop: '5px',
  },
  menuLabel: {
    color: '#64748b',
    fontSize: '10px',
    letterSpacing: '2px',
    padding: '8px 12px 15px',
  },
  navItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
    padding: '14px 13px',
    marginBottom: '6px',
    border: '1px solid transparent',
    borderRadius: '9px',
    background: 'transparent',
    color: '#9aabc0',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  navActive: {
    background: '#12324c',
    border: '1px solid #1c5277',
    color: '#7dd3fc',
  },
  navIcon: { fontSize: '19px', width: '22px', textAlign: 'center' },
  navArrow: { marginLeft: 'auto', fontSize: '21px' },
  sidebarBottom: { marginTop: 'auto', paddingTop: '30px' },
  adminProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    borderTop: '1px solid #23364b',
    padding: '20px 5px',
  },
  avatar: {
    width: '37px',
    height: '37px',
    borderRadius: '50%',
    background: '#164e72',
    color: '#7dd3fc',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 'bold',
  },
  profileName: { fontSize: '13px', fontWeight: 'bold' },
  profileRole: { fontSize: '11px', color: '#8293a8', marginTop: '4px' },
  logout: {
    width: '100%',
    background: '#281b27',
    border: '1px solid #573044',
    color: '#fda4af',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  main: { flex: 1, minWidth: 0 },
  topbar: {
    minHeight: '76px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '12px 28px',
    borderBottom: '1px solid #1d3048',
    background: '#0c1727',
    boxSizing: 'border-box',
  },
  breadcrumb: {
    color: '#64748b',
    fontSize: '9px',
    letterSpacing: '1.5px',
    marginBottom: '6px',
  },
  pageName: { fontWeight: 'bold', fontSize: '17px' },
  topRight: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' },
  onlineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#38bdf8',
  },
  onlineText: { color: '#94a3b8', fontSize: '11px' },
  menuToggle: { display: 'none' },
  content: { maxWidth: '1200px', padding: '30px', margin: '0 auto' },
  hero: {
    background: 'linear-gradient(115deg,#103552,#102444 65%,#14203b)',
    border: '1px solid #225078',
    borderRadius: '16px',
    padding: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroTag: {
    color: '#38bdf8',
    fontSize: '10px',
    letterSpacing: '2px',
    fontWeight: 'bold',
  },
  heroTitle: { fontSize: '28px', margin: '14px 0 8px' },
  heroText: { color: '#a9bed2', fontSize: '14px', margin: 0 },
  heroSymbol: { fontSize: '85px', color: '#38bdf8', opacity: 0.5, padding: '0 15px' },
  sectionTitle: { margin: '35px 0 20px' },
  heading: { fontSize: '19px', margin: '0 0 7px' },
  muted: { color: '#8495aa', fontSize: '13px', lineHeight: 1.6 },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: '16px',
  },
  card: {
    minHeight: '190px',
    padding: '21px',
    borderRadius: '13px',
    background: '#101d30',
    border: '1px solid #243950',
    color: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '23px',
    color: '#7dd3fc',
  },
  cardArrow: { color: '#38bdf8', fontSize: '21px' },
  cardTitle: { fontSize: '17px', margin: '19px 0 8px' },
  cardDescription: { color: '#94a3b8', fontSize: '12px', lineHeight: 1.6, minHeight: '38px' },
  cardLink: {
    color: '#38bdf8',
    fontSize: '10px',
    letterSpacing: '1px',
    fontWeight: 'bold',
    marginTop: '17px',
  },
  notice: {
    display: 'flex',
    gap: '13px',
    alignItems: 'flex-start',
    marginTop: '25px',
    padding: '18px',
    background: '#102337',
    border: '1px solid #1d4864',
    borderRadius: '11px',
  },
  noticeIcon: {
    width: '23px',
    height: '23px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: '#164e72',
    color: '#7dd3fc',
    flexShrink: 0,
  },
  notice p: { color: '#9fb2c8', fontSize: '12px', lineHeight: 1.6, margin: '6px 0 0' },
  innerPage: { minHeight: '65vh' },
  backButton: {
    background: '#14243a',
    border: '1px solid #2b4560',
    color: '#7dd3fc',
    borderRadius: '8px',
    padding: '12px 16px',
    cursor: 'pointer',
    marginBottom: '25px',
  },
  innerHero: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    padding: '25px 0',
  },
  innerIcon: {
    width: '65px',
    height: '65px',
    borderRadius: '15px',
    display: 'grid',
    placeItems: 'center',
    background: '#12324c',
    color: '#7dd3fc',
    fontSize: '30px',
  },
  innerTitle: { fontSize: '26px', margin: '8px 0' },
  emptyPanel: {
    textAlign: 'center',
    padding: '55px 25px',
    borderRadius: '15px',
    background: '#101d30',
    border: '1px solid #243950',
    marginTop: '15px',
  },
  emptyIcon: { fontSize: '40px', color: '#38bdf8' },
  footer: {
    borderTop: '1px solid #1d3048',
    marginTop: '45px',
    padding: '20px 0',
    textAlign: 'center',
    color: '#52657b',
    fontSize: '10px',
    letterSpacing: '1px',
  },
  mobileOverlay: { display: 'none' },
};

if (typeof window !== 'undefined' && window.innerWidth <= 760) {
  s.sidebar = {
    ...s.sidebar,
    position: 'fixed',
    left: '-260px',
    top: 0,
    bottom: 0,
    height: '100vh',
    transition: 'left 0.25s ease',
  };
  s.sidebarVisible = { left: 0 };
  s.menuToggle = {
    display: 'block',
    background: '#14243a',
    border: '1px solid #2b4560',
    color: '#fff',
    borderRadius: '7px',
    padding: '9px 12px',
    fontSize: '19px',
  };
  s.mobileOverlay = {
    display: 'block',
    position: 'fixed',
    inset: 0,
    background: '#0009',
    zIndex: 4,
  };
  s.content = { ...s.content, padding: '18px' };
  s.hero = { ...s.hero, padding: '23px 18px' };
  s.heroTitle = { ...s.heroTitle, fontSize: '23px' };
  s.heroSymbol = { ...s.heroSymbol, fontSize: '52px' };
}
