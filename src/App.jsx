import InScopeAI from './InScopeAI';
import React, { useEffect, useState } from 'react';
import { authClient } from './auth-client';
import Admin from './Admin';
import DashboardMenu from './DashboardMenu';

const bundles = [
  ['1GB', '4.30'],
  ['2GB', '8.60'],
  ['3GB', '12.90'],
  ['4GB', '17.20'],
  ['5GB', '21.50'],
  ['6GB', '25.80'],
  ['7GB', '30.10'],
  ['8GB', '34.40'],
  ['9GB', '38.70'],
  ['10GB', '43.00'],
  ['12GB', '51.60'],
  ['15GB', '64.50'],
  ['20GB', '86.00'],
  ['25GB', '107.50'],
  ['30GB', '129.00'],
  ['40GB', '172.00'],
  ['50GB', '215.00'],
  ['100GB', '430.00'],
  ['300GB', '1290.00'],
  ['1TB', '4300.00']
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');
  const [authUser, setAuthUser] = useState(null);

  const [currentPage, setCurrentPage] = useState(
    new URLSearchParams(window.location.search).get('page') || 'dashboard'
  );

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('airdata-theme') === 'dark'
  );

  const [selected, setSelected] = useState(bundles[0]);
  const [phone, setPhone] = useState('');

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMessage, setWalletMessage] = useState('');

  useEffect(() => {
    authClient.getSession()
      .then(({ data, error }) => {
        if (!error) {
          setAuthUser(data?.user ?? null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    localStorage.setItem('airdata-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  async function getWalletToken() {
    const token = await authClient.getJWTToken();

    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    return token;
  }

  async function loadWallet() {
    setWalletLoading(true);
    setWalletMessage('');

    try {
      const token = await getWalletToken();

      const response = await fetch('/api/wallet/balance', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not load wallet.');
      }

      setWalletBalance(Number(result.balance || 0));
      setWalletTransactions(result.transactions || []);
    } catch (error) {
      setWalletMessage(error.message || 'Could not load wallet.');
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    if (authUser) {
      loadWallet();
    } else {
      setWalletBalance(0);
      setWalletTransactions([]);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');

    if (!reference) return;

    window.history.replaceState({}, '', '/?page=deposit');
    setCurrentPage('deposit');

    async function verifyPayment() {
      setWalletLoading(true);
      setWalletMessage('Verifying your payment with Paystack...');

      try {
        const token = await getWalletToken();

        const response = await fetch('/api/wallet/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reference })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || 'Payment verification was unsuccessful.'
          );
        }

        setWalletBalance(Number(result.balance || 0));

        setWalletMessage(
          result.already_credited
            ? 'This payment has already been added to your wallet.'
            : 'Payment successful! Your wallet has been credited.'
        );

        await loadWallet();
        setDepositAmount('');
      } catch (error) {
        setWalletMessage(
          error.message || 'We could not verify your payment.'
        );
      } finally {
        setWalletLoading(false);
      }
    }

    verifyPayment();
  }, [authUser]);

  async function startDeposit() {
    const amount = Number(depositAmount);

    if (!Number.isFinite(amount) || amount < 0.10 || amount > 10000) {
      setWalletMessage(
        'Enter an amount between GH₵0.10 and GH₵10,000.'
      );
      return;
    }

    setWalletLoading(true);
    setWalletMessage('Preparing your secure Paystack payment...');

    try {
      const token = await getWalletToken();

      const response = await fetch('/api/wallet/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      const result = await response.json();

      if (!response.ok || !result.authorization_url) {
        throw new Error(
          result.error || 'Could not start your payment.'
        );
      }

      window.location.assign(result.authorization_url);
    } catch (error) {
      setWalletMessage(
        error.message || 'Could not initialize your deposit.'
      );
      setWalletLoading(false);
    }
  }

  function orderNow() {
    if (!/^0\d{9}$/.test(phone)) {
      alert('Enter a valid 10-digit Ghana phone number.');
      return;
    }

    const message =
      `Hello AirData GH, I want to order MTN ${selected[0]} for ${phone}. Price: GH₵${selected[1]}.`;

    window.open(
      `https://wa.me/233548206175?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  }

  async function logout() {
    await authClient.signOut();

    setAuthUser(null);
    setAuthMode('login');
    setAuthMessage('You have logged out successfully.');

    window.history.replaceState({}, '', '/');
    setCurrentPage('dashboard');
  }

  if (window.location.pathname === '/admin') {
    return <Admin />;
  }

  // CUSTOMER NAME FOR PERSONALIZED DASHBOARD GREETING
  const customerName =
    authUser?.name?.trim() ||
    authUser?.email?.split('@')[0] ||
    'there';

  const pageTitles = {
    dashboard: 'Dashboard',
    deposit: 'Deposit',
    'buy-data': 'Buy Data',
    transactions: 'Transactions',
    profile: 'My Profile',
    support: 'Customer Support',
    settings: 'Settings'
  };

  return (
    <main className={darkMode ? 'dark-mode' : 'light-mode'}>

      <style>{`
        .wallet-section {
          max-width: 850px;
          margin: 28px auto;
          padding: 0 18px;
          color: #14233f;
        }

        .wallet-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }

        .wallet-eyebrow {
          display: block;
          color: #3979dc;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .wallet-section-heading h2 {
          margin: 0 0 5px;
          font-size: 25px;
          font-weight: 850;
        }

        .wallet-section-heading p {
          margin: 0;
          font-size: 13px;
          opacity: .7;
        }

        .wallet-secure-mark {
          padding: 9px 12px;
          border-radius: 30px;
          background: #e9f5ff;
          color: #1765bd;
          font-size: 11px;
          font-weight: 750;
        }

        .wallet-card {
          position: relative;
          overflow: hidden;
          min-height: 225px;
          padding: 25px;
          border-radius: 23px;
          color: white;
          background: linear-gradient(125deg, #071a3c 0%, #103b79 55%, #176bd0 100%);
          box-shadow: 0 16px 35px rgba(8, 45, 100, .22);
          isolation: isolate;
        }

        .wallet-card-glow {
          position: absolute;
          z-index: -1;
          width: 240px;
          height: 240px;
          right: -55px;
          top: -100px;
          border-radius: 50%;
          background: rgba(73, 171, 255, .25);
          filter: blur(12px);
        }

        .wallet-card-top,
        .wallet-card-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .wallet-card-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 850;
          letter-spacing: 1px;
        }

        .wallet-card-brand b {
          color: #6ec6ff;
        }

        .wallet-brand-icon {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 11px;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.25);
          font-size: 13px;
          font-weight: 900;
        }

        .wallet-card-label {
          font-size: 9px;
          letter-spacing: 1.5px;
          opacity: .8;
          font-weight: 800;
        }

        .wallet-balance-area {
          margin: 27px 0 24px;
        }

        .wallet-balance-caption {
          display: block;
          font-size: 12px;
          opacity: .8;
          margin-bottom: 5px;
        }

        .wallet-balance-value {
          font-size: clamp(32px, 8vw, 45px);
          font-weight: 850;
          letter-spacing: -1.5px;
          overflow-wrap: anywhere;
        }

        .wallet-balance-value span {
          font-size: 20px;
          margin-right: 7px;
          color: #a9d9ff;
          letter-spacing: 0;
        }

        .wallet-balance-footnote {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          opacity: .85;
          margin-top: 8px;
        }

        .wallet-balance-footnote i,
        .wallet-live-dot {
          width: 7px;
          height: 7px;
          display: inline-block;
          border-radius: 50%;
          background: #52e4a0;
          box-shadow: 0 0 9px rgba(82,228,160,.7);
        }

        .wallet-card-bottom {
          border-top: 1px solid rgba(255,255,255,.17);
          padding-top: 13px;
          font-size: 9px;
          letter-spacing: 1.4px;
          opacity: .8;
        }

        .wallet-card-chip {
          font-size: 23px;
          color: #9bd5ff;
        }

        .wallet-action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 15px;
        }

        .wallet-action {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 15px;
          border-radius: 15px;
          background: #fff;
          border: 1px solid #e4eaf3;
          color: #172b4d;
          text-decoration: none;
          box-shadow: 0 5px 15px rgba(20,45,80,.05);
          transition: transform .2s, box-shadow .2s;
        }

        .wallet-action:hover {
          transform: translateY(-3px);
          box-shadow: 0 9px 20px rgba(20,45,80,.1);
        }

        .wallet-action-primary {
          background: linear-gradient(120deg, #edf6ff, #fff);
          border-color: #c9e2ff;
        }

        .wallet-action-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 39px;
          height: 39px;
          border-radius: 12px;
          background: #e2f0ff;
          color: #176bd0;
          font-size: 24px;
          font-weight: 700;
        }

        .wallet-action b,
        .wallet-action small {
          display: block;
        }

        .wallet-action b {
          font-size: 13px;
          margin-bottom: 4px;
        }

        .wallet-action small {
          font-size: 10px;
          opacity: .65;
        }

        .wallet-action-arrow {
          margin-left: auto;
          color: #2879d2;
          font-size: 17px;
        }

        .wallet-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 17px;
          font-size: 11px;
          color: #52627a;
        }

        .wallet-footer-row > span {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .wallet-refresh {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 0;
          border-radius: 20px;
          padding: 9px 13px;
          background: #eaf3ff;
          color: #1765bd;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .wallet-refresh:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .wallet-refresh-icon {
          display: inline-block;
          font-size: 17px;
          line-height: 1;
        }

        .wallet-refresh-icon.spinning {
          animation: walletSpin .8s linear infinite;
        }

        @keyframes walletSpin {
          to { transform: rotate(360deg); }
        }

        .wallet-status-message {
          padding: 11px 13px;
          border-radius: 10px;
          background: #edf5ff;
          color: #17549b;
          font-size: 12px;
          line-height: 1.5;
        }

        .wallet-usage-note {
          margin: 12px 0 0;
          color: #78869a;
          font-size: 10px;
          text-align: center;
        }

        .dark-mode .wallet-section {
          color: #edf4ff;
        }

        .dark-mode .wallet-section-heading p {
          color: #b5c6dd;
        }

        .dark-mode .wallet-secure-mark {
          background: #152f4c;
          color: #8ecaff;
        }

        .dark-mode .wallet-action {
          background: #13243b;
          border-color: #29415e;
          color: #edf4ff;
        }

        .dark-mode .wallet-action-primary {
          background: linear-gradient(120deg, #142e4d, #192d47);
          border-color: #315d89;
        }

        .dark-mode .wallet-action-icon {
          background: #203f61;
          color: #9acfff;
        }

        .dark-mode .wallet-footer-row {
          color: #b7c7dc;
        }

        .dark-mode .wallet-refresh {
          background: #203e60;
          color: #b6dcff;
        }

        .dark-mode .wallet-status-message {
          background: #193755;
          color: #b9ddff;
        }

        .dark-mode .wallet-usage-note {
          color: #9aacc3;
        }

        @media (max-width: 520px) {
          .wallet-section {
            padding: 0 13px;
            margin: 22px auto;
          }

          .wallet-card {
            padding: 20px;
            min-height: 210px;
            border-radius: 19px;
          }

          .wallet-card-label {
            font-size: 8px;
          }

          .wallet-action-grid {
            gap: 9px;
          }

          .wallet-action {
            padding: 12px 9px;
            gap: 8px;
          }

          .wallet-action-icon {
            width: 33px;
            height: 33px;
            font-size: 20px;
          }

          .wallet-action b {
            font-size: 11px;
          }

          .wallet-action small {
            font-size: 9px;
          }

          .wallet-action-arrow {
            font-size: 13px;
          }

          .wallet-footer-row {
            font-size: 10px;
          }
        }
      `}</style>

      {/* PREMIUM AIRDATA GH SPLASH SCREEN */}
      {showSplash && (
        <div className="splashScreen">
          <div className="splash-background-glow"></div>

          <div className="splash-logo-stage">
            <div className="splash-orbit splash-orbit-one"></div>
            <div className="splash-orbit splash-orbit-two"></div>
            <div className="splash-orbit splash-orbit-three"></div>

            <div className="splash-logo">AD</div>
          </div>

          <h1>AIRDATA GH</h1>
          <p>YOUR CONNECTION. OUR PRIORITY.</p>

          <div className="splash-status">
            <span></span>
            CONNECTING YOU TO BETTER DATA
          </div>

          <button
            className="skipIntro"
            onClick={() => setShowSplash(false)}
          >
            Skip Intro →
          </button>
        </div>
      )}

      {/* LOGIN AND SIGNUP */}
      {!showSplash && !authUser && (
        <section className="authScreen">
          <div className="authCard">
            <div className="authLogo">AD</div>

            <h1>Welcome to AirData GH</h1>
            <p className="authSubtitle">
              Your connection. Our priority.
            </p>

            <div className="authTabs">
              <button
                className={authMode === 'login' ? 'authActive' : ''}
                onClick={() => {
                  setAuthMode('login');
                  setAuthMessage('');
                }}
              >
                Login
              </button>

              <button
                className={authMode === 'signup' ? 'authActive' : ''}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthMessage('');
                }}
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();

                const formData = new FormData(e.currentTarget);
                const email = String(formData.get('email') || '');
                const password = String(formData.get('password') || '');
                const name = String(formData.get('name') || '');

                setAuthMessage('Please wait...');

                try {
                  let result;

                  if (authMode === 'signup') {
                    result = await authClient.signUp.email({
                      name,
                      email,
                      password
                    });
                  } else {
                    result = await authClient.signIn.email({
                      email,
                      password
                    });
                  }

                  if (result.error) {
                    throw new Error(
                      result.error.message || 'Authentication failed.'
                    );
                  }

                  const sessionResult = await authClient.getSession();

                  setAuthUser(
                    result.data?.user ??
                    sessionResult.data?.user ??
                    null
                  );

                  setAuthMessage(
                    authMode === 'signup'
                      ? 'Your account has been created successfully!'
                      : 'Login successful! Welcome back.'
                  );
                } catch (error) {
                  setAuthMessage(
                    error.message || 'Something went wrong. Please try again.'
                  );
                }
              }}
            >
              {authMode === 'signup' && (
                <>
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    required
                  />

                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. 0241234567"
                    required
                  />
                </>
              )}

              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                autoComplete="email"
                required
              />

              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete={
                  authMode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                minLength={8}
                required
              />

              {authMode === 'login' && (
                <p className="forgotPassword">Forgot password?</p>
              )}

              <button className="authSubmit" type="submit">
                {authMode === 'login'
                  ? 'Login to Your Account'
                  : 'Create My Account'}
              </button>

              {authMessage && (
                <p className="authMessage">{authMessage}</p>
              )}
            </form>

            <p className="authFooter">
              Secure access to your AirData GH account.
            </p>
          </div>
        </section>
      )}

      {/* MAIN CUSTOMER DASHBOARD */}
      {!showSplash && authUser && (
        <>
          <DashboardMenu />

          <header>
            <div className="headerTop">
              <div>
                <h1>AirData <span>GH</span></h1>
                <p>Your connection. Our priority.</p>
              </div>

              <button
                className="themeToggle"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? '☀️ Day mode' : '🌙 Night mode'}
              </button>
            </div>
          </header>

          <div className="pageHeading">
            <h2>{pageTitles[currentPage] || 'Dashboard'}</h2>
          </div>

          {/* DASHBOARD */}
          {currentPage === 'dashboard' && (
            <>
              <section id="dashboard" className="hero">
                <p className="tag">FAST • AFFORDABLE • RELIABLE</p>

                {/* PERSONALIZED CUSTOMER GREETING */}
                <h2>Welcome to AirData GH, {customerName}!</h2>

                <p>
                  Get affordable MTN data bundles delivered with ease.
                </p>

                <a href="/?page=buy-data">Buy Data →</a>
              </section>

              {/* PREMIUM WALLET */}
              <section className="wallet-section">
                <div className="wallet-section-heading">
                  <div>
                    <span className="wallet-eyebrow">
                      YOUR MONEY, READY WHEN YOU ARE
                    </span>
                    <h2>My Wallet</h2>
                    <p>Manage your AirData GH funds in one place.</p>
                  </div>

                  <span className="wallet-secure-mark">
                    🔒 Secure wallet
                  </span>
                </div>

                <div className="wallet-card">
                  <div className="wallet-card-glow"></div>

                  <div className="wallet-card-top">
                    <div className="wallet-card-brand">
                      <span className="wallet-brand-icon">AD</span>
                      <span>AIRDATA <b>GH</b></span>
                    </div>

                    <span className="wallet-card-label">
                      WALLET BALANCE
                    </span>
                  </div>

                  <div className="wallet-balance-area">
                    <span className="wallet-balance-caption">
                      Available balance
                    </span>

                    <div className="wallet-balance-value">
                      <span>GH₵</span>{walletBalance.toFixed(2)}
                    </div>

                    <span className="wallet-balance-footnote">
                      <i></i> Ready to use for data bundles
                    </span>
                  </div>

                  <div className="wallet-card-bottom">
                    <span>YOUR CONNECTION. OUR PRIORITY.</span>
                    <span className="wallet-card-chip">✦</span>
                  </div>
                </div>

                <div className="wallet-action-grid">
                  <a
                    className="wallet-action wallet-action-primary"
                    href="/?page=deposit"
                  >
                    <span className="wallet-action-icon">＋</span>
                    <span>
                      <b>Add Money</b>
                      <small>Top up your wallet</small>
                    </span>
                    <span className="wallet-action-arrow">↗</span>
                  </a>

                  <a
                    className="wallet-action"
                    href="/?page=buy-data"
                  >
                    <span className="wallet-action-icon">⌁</span>
                    <span>
                      <b>Buy Data</b>
                      <small>Choose an MTN bundle</small>
                    </span>
                    <span className="wallet-action-arrow">↗</span>
                  </a>
                </div>

                <div className="wallet-footer-row">
                  <span>
                    <i className="wallet-live-dot"></i> Wallet balance
                  </span>

                  <button
                    className="wallet-refresh"
                    onClick={loadWallet}
                    disabled={walletLoading}
                  >
                    <span
                      className={
                        walletLoading
                          ? 'wallet-refresh-icon spinning'
                          : 'wallet-refresh-icon'
                      }
                    >
                      ↻
                    </span>

                    {walletLoading
                      ? 'Refreshing...'
                      : 'Refresh balance'}
                  </button>
                </div>

                {walletMessage && (
                  <p className="wallet-status-message" role="status">
                    {walletMessage}
                  </p>
                )}

                <p className="wallet-usage-note">
                  Your balance is available for eligible AirData GH purchases.
                </p>
              </section>

              <section className="section">
                <h2>Quick Actions</h2>

                <div className="serviceGrid">
                  <a href="/?page=buy-data">📱 Buy Data</a>
                  <a href="/?page=deposit">💳 Deposit</a>
                  <a href="/?page=transactions">📄 Transactions</a>
                  <a href="/?page=support">💬 Support</a>
                </div>
              </section>

              <section className="tracking">
                <div className="trackingCard">
                  <div className="trackingIcon">📦</div>
                  <p className="trackingTag">
                    AIRDATA GH • ORDER SUPPORT
                  </p>
                  <h2>Track Your Order</h2>
                  <p className="trackingText">
                    Need help with an order? Contact our support team.
                  </p>
                  <a
                    className="trackingButton"
                    href="/?page=support"
                  >
                    Get Order Support →
                  </a>
                </div>
              </section>
            </>
          )}

          {/* BUY DATA */}
          {currentPage === 'buy-data' && (
            <section id="bundles" className="section">
              <h2>MTN Data Bundles</h2>
              <p className="sub">
                Choose your preferred data package.
              </p>

              <div className="grid">
                {bundles.map((bundle) => (
                  <button
                    key={bundle[0]}
                    className={`bundle ${
                      selected[0] === bundle[0] ? 'active' : ''
                    }`}
                    onClick={() => setSelected(bundle)}
                  >
                    <strong>{bundle[0]}</strong>
                    <span>GH₵{bundle[1]}</span>
                  </button>
                ))}
              </div>

              <div className="order">
                <h3>Complete Your Order</h3>

                <p>
                  Selected: <strong>{selected[0]} — GH₵{selected[1]}</strong>
                </p>

                <label htmlFor="phone">Recipient phone number</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="e.g. 0241234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                <button className="orderButton" onClick={orderNow}>
                  Order via WhatsApp
                </button>

                <small>
                  You'll confirm your order with us on WhatsApp.
                </small>
              </div>
            </section>
          )}

          {/* WALLET DEPOSIT */}
          {currentPage === 'deposit' && (
            <section className="section">
              <h2>Wallet Deposit</h2>

              <p className="sub">
                Add funds to your AirData GH wallet securely.
              </p>

              <div className="order">
                <h3>Available Balance</h3>
                <h2>GH₵{walletBalance.toFixed(2)}</h2>
              </div>

              <div className="order">
                <h3>Deposit to Your Wallet</h3>

                <label htmlFor="depositAmount">
                  Deposit Amount (GH₵)
                </label>

                <input
                  id="depositAmount"
                  type="number"
                  min="0.10"
                  max="10000"
                  step="0.01"
                  placeholder="Enter amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={walletLoading}
                />

                <p>
                  <strong>
                    Minimum: GH₵0.10 | Maximum: GH₵10,000
                  </strong>
                </p>

                <button
                  className="orderButton"
                  onClick={startDeposit}
                  disabled={walletLoading}
                >
                  {walletLoading ? 'Please wait...' : 'Deposit Now'}
                </button>

                {walletMessage && (
                  <p className="authMessage" role="status">
                    {walletMessage}
                  </p>
                )}

                <small>
                  Payments are processed securely through Paystack.
                  Your wallet is credited only after payment verification.
                </small>
              </div>
            </section>
          )}

          {/* TRANSACTION HISTORY */}
          {currentPage === 'transactions' && (
            <section className="section">
              <h2>My Transactions</h2>

              <p className="sub">
                View your wallet deposit history.
              </p>

              <div className="order">
                <h3>Current Wallet Balance</h3>
                <h2>GH₵{walletBalance.toFixed(2)}</h2>

                <button
                  className="orderButton"
                  onClick={loadWallet}
                  disabled={walletLoading}
                >
                  {walletLoading ? 'Refreshing...' : 'Refresh History'}
                </button>
              </div>

              <div className="order">
                <h3>Transaction History</h3>

                {walletTransactions.length === 0 ? (
                  <p>No transactions to display yet.</p>
                ) : (
                  <div className="transactionList">
                    {walletTransactions.map((transaction) => (
                      <div
                        className="transactionItem"
                        key={transaction.reference}
                      >
                        <h4>Wallet Deposit</h4>

                        <p>
                          Amount: <strong>
                            GH₵{Number(transaction.amount).toFixed(2)}
                          </strong>
                        </p>

                        <p>
                          Status:{' '}
                          <strong>{transaction.status.toUpperCase()}</strong>
                        </p>

                        <small>
                          Reference: {transaction.reference}
                        </small>

                        <br />

                        <small>
                          {new Date(
                            transaction.created_at
                          ).toLocaleString()}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PROFILE */}
          {currentPage === 'profile' && (
            <section className="section">
              <h2>My Profile</h2>

              <p className="sub">
                Manage your AirData GH account.
              </p>

              <div className="order">
                <h3>Account Information</h3>

                <p>
                  Email: <strong>{authUser?.email || 'Not available'}</strong>
                </p>

                <p>
                  Name: <strong>{authUser?.name || 'Customer'}</strong>
                </p>

                <button className="orderButton" onClick={logout}>
                  Logout
                </button>
              </div>
            </section>
          )}

          {/* CUSTOMER SUPPORT */}
          {currentPage === 'support' && (
            <section className="section">
              <h2>Customer Support</h2>

              <p className="sub">
                Need help with your account or data order?
              </p>

              <div className="order">
                <h3>Contact AirData GH</h3>
                <p>
                  Our support team is available on WhatsApp.
                </p>

                <a
                  className="orderButton"
                  href="https://wa.me/233548206175?text=Hello%20AirData%20GH%2C%20I%20need%20assistance."
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    textDecoration: 'none'
                  }}
                >
                  Chat with Support on WhatsApp
                </a>
              </div>
            </section>
          )}

          {/* SETTINGS */}
          {currentPage === 'settings' && (
            <section className="section">
              <h2>Account Settings</h2>

              <p className="sub">
                Customize your AirData GH experience.
              </p>

              <div className="order">
                <h3>Appearance</h3>
                <p>Choose how your dashboard looks.</p>

                <button
                  className="orderButton"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode
                    ? '☀️ Switch to Day Mode'
                    : '🌙 Switch to Night Mode'}
                </button>
              </div>
            </section>
          )}

          {/* FOOTER */}
          <footer>
            <h2>AirData GH</h2>
            <p>Affordable data. Reliable service.</p>
            <p>WhatsApp: 0548 206 175</p>
            <small>© 2026 AirData GH. All rights reserved.</small>
          </footer>
        </>
      )}

      <InScopeAI />
    </main>
  );
                      }
