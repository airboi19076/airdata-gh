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

const airtelTigoBundles = [
  ['1GB', '4.10'],
  ['2GB', '8.20'],
  ['3GB', '12.30'],
  ['4GB', '16.40'],
  ['5GB', '20.50'],
  ['6GB', '24.60'],
  ['8GB', '32.80'],
  ['10GB', '41.00'],
  ['15GB', '61.50'],
  ['20GB', '82.00']
];

const telecelBundles = [
  ['10GB', '41.00'],
  ['15GB', '57.00'],
  ['20GB', '73.00'],
  ['25GB', '89.00'],
  ['30GB', '105.00'],
  ['40GB', '137.00'],
  ['50GB', '169.00'],
  ['100GB', '329.00']
];

const networkBundles = {
  MTN: bundles,
  AirtelTigo: airtelTigoBundles,
  Telecel: telecelBundles
};

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

  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [selected, setSelected] = useState(bundles[0]);
  const [phone, setPhone] = useState('');

  const [orderMode, setOrderMode] = useState('single');
  const [bulkPhones, setBulkPhones] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

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

  function changeNetwork(network) {
    setSelectedNetwork(network);
    setSelected(networkBundles[network][0]);
    setPhone('');
    setBulkPhones('');
    setBulkMessage('');
    setOrderMode('single');
  }

  function orderNow() {
    if (!/^0\d{9}$/.test(phone)) {
      alert('Enter a valid 10-digit Ghana phone number.');
      return;
    }

    const message =
      `Hello AirData GH, I want to order ${selectedNetwork} ${selected[0]} for ${phone}. Price: GH₵${selected[1]}.`;

    window.open(
      `https://wa.me/233548206175?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  }

  function getBulkNumbers() {
    return bulkPhones
      .split(/[\s,;]+/)
      .map(number => number.trim())
      .filter(Boolean);
  }

  function orderBulk() {
    const numbers = getBulkNumbers();

    if (selectedNetwork !== 'MTN') {
      alert('Bulk ordering is currently available for MTN only.');
      return;
    }

    if (numbers.length === 0) {
      setBulkMessage('Enter at least one recipient phone number.');
      return;
    }

    if (numbers.length > 20) {
      setBulkMessage('You can enter a maximum of 20 numbers per request.');
      return;
    }

    const invalidNumbers = numbers.filter(
      number => !/^0\d{9}$/.test(number)
    );

    if (invalidNumbers.length > 0) {
      setBulkMessage(
        `Please check these invalid numbers: ${invalidNumbers.join(', ')}`
      );
      return;
    }

    const total = Number(selected[1]) * numbers.length;

    const message = [
      'Hello AirData GH, I want to make an MTN bulk data order.',
      '',
      `Bundle: ${selected[0]}`,
      `Price per recipient: GH₵${selected[1]}`,
      `Number of recipients: ${numbers.length}`,
      `Estimated total: GH₵${total.toFixed(2)}`,
      '',
      'Recipient numbers:',
      ...numbers.map((number, index) => `${index + 1}. ${number}`)
    ].join('\n');

    window.open(
      `https://wa.me/233548206175?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    setBulkMessage('');
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

  const bulkNumbers = getBulkNumbers();
  const validBulkNumbers = bulkNumbers.filter(
    number => /^0\d{9}$/.test(number)
  );
  const bulkTotal = Number(selected[1]) * validBulkNumbers.length;

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

        /* NETWORK SELECTOR */

        .network-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 22px 0;
        }

        .network-option {
          padding: 16px 8px;
          border: 2px solid #e1e8f0;
          border-radius: 14px;
          background: #fff;
          color: #182b48;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: .2s;
        }

        .network-option.active {
          border-color: #2476d2;
          background: #eaf4ff;
          color: #1765bd;
          box-shadow: 0 5px 15px rgba(36,118,210,.12);
        }

        .network-option span {
          display: block;
          font-size: 10px;
          font-weight: 600;
          margin-top: 5px;
          opacity: .7;
        }

        .order-mode-selector {
          display: flex;
          gap: 10px;
          margin: 20px 0;
        }

        .order-mode-selector button {
          flex: 1;
          padding: 12px;
          border: 1px solid #dce5f0;
          border-radius: 10px;
          background: #fff;
          color: #253b59;
          font-weight: 750;
          cursor: pointer;
        }

        .order-mode-selector button.active {
          background: #176bd0;
          color: #fff;
          border-color: #176bd0;
        }

        .bulk-input {
          width: 100%;
          min-height: 145px;
          box-sizing: border-box;
          padding: 14px;
          border: 1px solid #d7e0eb;
          border-radius: 12px;
          font: inherit;
          resize: vertical;
          margin: 10px 0;
        }

        .bulk-summary {
          padding: 15px;
          border-radius: 12px;
          background: #edf5ff;
          color: #174b86;
          margin: 14px 0;
          line-height: 1.8;
        }

        .bulk-summary strong {
          font-size: 19px;
        }

        .bulk-help {
          display: block;
          margin: 7px 0;
          font-size: 11px;
          opacity: .75;
          line-height: 1.6;
        }

        .bulk-error {
          color: #c0392b;
          font-size: 12px;
          margin: 10px 0;
        }

        .dark-mode .network-option,
        .dark-mode .order-mode-selector button {
          background: #13243b;
          border-color: #29415e;
          color: #edf4ff;
        }

        .dark-mode .network-option.active,
        .dark-mode .order-mode-selector button.active {
          background: #174d82;
          border-color: #4799e8;
          color: #fff;
        }

        .dark-mode .bulk-input {
          background: #13243b;
          color: #edf4ff;
          border-color: #39516e;
        }

        .dark-mode .bulk-summary {
          background: #193755;
          color: #c7e2ff;
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

          .network-selector {
            gap: 6px;
          }

          .network-option {
            padding: 13px 4px;
            font-size: 12px;
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
                const email = String(formData.get('email') || '').trim();
                const password = String(formData.get('password') || '');
                const name = String(formData.get('name') || '').trim();
                const signupPhone = String(
                  formData.get('phone') || ''
                ).trim();

                setAuthMessage('Please wait...');

                try {
                  let result;
                  let phoneSaved = true;

                  if (authMode === 'signup') {
                    if (!/^0\d{9}$/.test(signupPhone)) {
                      throw new Error(
                        'Enter a valid 10-digit Ghana phone number.'
                      );
                    }

                    result = await authClient.signUp.email({
                      name,
                      email,
                      password
                    });

                    if (result.error) {
                      throw new Error(
                        result.error.message || 'Account creation failed.'
                      );
                    }

                    try {
                      const token = await authClient.getJWTToken();

                      if (!token) {
                        phoneSaved = false;
                      } else {
                        const phoneResponse = await fetch(
                          '/api/customer/profile',
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              phone: signupPhone
                            })
                          }
                        );

                        const phoneResult = await phoneResponse.json();

                        if (!phoneResponse.ok) {
                          phoneSaved = false;
                          console.error(
                            'Phone number could not be saved:',
                            phoneResult.error
                          );
                        }
                      }
                    } catch (phoneError) {
                      phoneSaved = false;
                      console.error(
                        'Phone number saving error:',
                        phoneError
                      );
                    }
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

                  if (authMode === 'signup') {
                    setAuthMessage(
                      phoneSaved
                        ? 'Your account has been created successfully!'
                        : 'Your account was created, but your phone number could not be saved. Please contact support.'
                    );
                  } else {
                    setAuthMessage('Login successful! Welcome back.');
                  }
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
                    pattern="0[0-9]{9}"
                    maxLength={10}
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

                <h2>Welcome to AirData GH, {customerName}!</h2>

                <p>
                  Get affordable data bundles delivered with ease.
                </p>

                <a href="/?page=buy-data">Buy Data →</a>
              </section>

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
                      <small>Choose your network</small>
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
              <h2>Buy Data Bundles</h2>
              <p className="sub">
                Select your preferred network and data package.
              </p>

              {/* NETWORK CHOICES */}
              <div className="network-selector">
                <button
                  className={`network-option ${
                    selectedNetwork === 'MTN' ? 'active' : ''
                  }`}
                  onClick={() => changeNetwork('MTN')}
                >
                  MTN
                  <span>Data bundles</span>
                </button>

                <button
                  className={`network-option ${
                    selectedNetwork === 'Telecel' ? 'active' : ''
                  }`}
                  onClick={() => changeNetwork('Telecel')}
                >
                  Telecel
                  <span>Data bundles</span>
                </button>

                <button
                  className={`network-option ${
                    selectedNetwork === 'AirtelTigo' ? 'active' : ''
                  }`}
                  onClick={() => changeNetwork('AirtelTigo')}
                >
                  AirtelTigo
                  <span>Data bundles</span>
                </button>
              </div>

              <h3>{selectedNetwork} Data Packages</h3>

              <div className="grid">
                {networkBundles[selectedNetwork].map((bundle) => (
                  <button
                    key={bundle[0]}
                    className={`bundle ${
                      selected[0] === bundle[0] ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelected(bundle);
                      setBulkMessage('');
                    }}
                  >
                    <strong>{bundle[0]}</strong>
                    <span>GH₵{bundle[1]}</span>
                  </button>
                ))}
              </div>

              {/* MTN SINGLE AND BULK ORDER OPTIONS */}
              {selectedNetwork === 'MTN' && (
                <div className="order-mode-selector">
                  <button
                    className={orderMode === 'single' ? 'active' : ''}
                    onClick={() => {
                      setOrderMode('single');
                      setBulkMessage('');
                    }}
                  >
                    Single Order
                  </button>

                  <button
                    className={orderMode === 'bulk' ? 'active' : ''}
                    onClick={() => {
                      setOrderMode('bulk');
                      setBulkMessage('');
                    }}
                  >
                    Bulk Order
                  </button>
                </div>
              )}

              {/* SINGLE ORDER */}
              {(selectedNetwork !== 'MTN' || orderMode === 'single') && (
                <div className="order">
                  <h3>Complete Your Order</h3>

                  <p>
                    Network: <strong>{selectedNetwork}</strong>
                  </p>

                  <p>
                    Selected: <strong>
                      {selected[0]} — GH₵{selected[1]}
                    </strong>
                  </p>

                  <label htmlFor="phone">
                    Recipient phone number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    placeholder="e.g. 0241234567"
                    value={phone}
                    maxLength={10}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  <button className="orderButton" onClick={orderNow}>
                    Order via WhatsApp
                  </button>

                  <small>
                    You'll confirm your order with us on WhatsApp.
                  </small>
                </div>
              )}

              {/* MTN BULK ORDER */}
              {selectedNetwork === 'MTN' && orderMode === 'bulk' && (
                <div className="order">
                  <h3>MTN Bulk Data Order</h3>

                  <p>
                    Select one bundle and enter the phone numbers
                    of all recipients.
                  </p>

                  <p>
                    Bundle per recipient: <strong>
                      {selected[0]} — GH₵{selected[1]}
                    </strong>
                  </p>

                  <label htmlFor="bulkPhones">
                    Recipient phone numbers
                  </label>

                  <textarea
                    id="bulkPhones"
                    className="bulk-input"
                    placeholder={
                      'Enter one phone number per line:\n0241234567\n0551234567\n0201234567'
                    }
                    value={bulkPhones}
                    onChange={(e) => {
                      setBulkPhones(e.target.value);
                      setBulkMessage('');
                    }}
                  />

                  <small className="bulk-help">
                    Enter up to 20 Ghana phone numbers. You can put
                    each number on a new line or separate them with commas.
                  </small>

                  <div className="bulk-summary">
                    <div>
                      Recipients entered: <strong>
                        {bulkNumbers.length}
                      </strong>
                    </div>

                    <div>
                      Valid phone numbers: <strong>
                        {validBulkNumbers.length}
                      </strong>
                    </div>

                    <div>
                      Estimated total:
                      <strong>
                        {' '}GH₵{bulkTotal.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {bulkMessage && (
                    <p className="bulk-error" role="alert">
                      {bulkMessage}
                    </p>
                  )}

                  <button
                    className="orderButton"
                    onClick={orderBulk}
                  >
                    Submit Bulk Request via WhatsApp
                  </button>

                  <small>
                    Your bulk request will be sent to AirData GH
                    for confirmation. No wallet deduction or automatic
                    delivery happens through this form yet.
                  </small>
                </div>
              )}
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
