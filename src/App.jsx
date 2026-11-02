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

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selected, setSelected] = useState(bundles[0]);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    authClient.getSession()
      .then(({ data, error }) => {
        if (!error) setAuthUser(data?.user ?? null);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const ghanaDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(currentTime);

  const ghanaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Accra',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(currentTime);

  function orderNow() {
    if (!/^0\d{9}$/.test(phone)) {
      alert('Enter a valid 10-digit Ghana phone number.');
      return;
    }

    const message = `Hello AirData GH, I want to order MTN ${selected[0]} for ${phone}. Price: GH₵${selected[1]}.`;

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

      {showSplash && (
        <div className="splashScreen">
          <div className="orbit orbitOne"></div>
          <div className="orbit orbitTwo"></div>
          <div className="orbit orbitThree"></div>

          <div className="adLogo">AD</div>
          <h1>AIRDATA GH</h1>
          <p>YOUR CONNECTION. OUR PRIORITY.</p>

          <button
            className="skipIntro"
            onClick={() => setShowSplash(false)}
          >
            Skip Intro →
          </button>
        </div>
      )}

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

            <div className="headerClock">
              <span>{ghanaDate}</span>
              <strong>{ghanaTime}</strong>
              <small>Ghana Time (GMT)</small>
            </div>
          </header>

          <div className="pageHeading">
            <h2>{pageTitles[currentPage] || 'Dashboard'}</h2>
          </div>

          {currentPage === 'dashboard' && (
            <>
              <section id="dashboard" className="hero">
                <p className="tag">FAST • AFFORDABLE • RELIABLE</p>
                <h2>Welcome to AirData GH!</h2>
                <p>Get affordable MTN data bundles delivered with ease.</p>
                <a href="/?page=buy-data">Buy Data Now →</a>
              </section>

              <section className="section">
                <h2>My Wallet</h2>
                <div className="order">
                  <h3>Available Balance</h3>
                  <h2>GH₵0.00</h2>
                  <small>
                    Your wallet balance will appear here when deposits are activated.
                  </small>
                  <p>
                    <a href="/?page=deposit">Go to Deposit →</a>
                  </p>
                </div>
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
                  <p className="trackingTag">AIRDATA GH • ORDER SUPPORT</p>
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

          {currentPage === 'deposit' && (
            <section className="section">
              <h2>Wallet Deposit</h2>
              <p className="sub">
                Add funds to your AirData GH wallet.
              </p>

              <div className="order">
                <h3>Deposit to Your Wallet</h3>

                <label htmlFor="depositAmount">Deposit Amount (GH₵)</label>
                <input
                  id="depositAmount"
                  type="number"
                  min="0.10"
                  step="0.01"
                  placeholder="Minimum deposit: GH₵0.10"
                />

                <p><strong>Minimum deposit: GH₵0.10</strong></p>

                <p>
                  Payment options are being prepared. Deposits are not
                  available yet.
                </p>

                <button className="orderButton" disabled>
                  Deposits Coming Soon
                </button>
              </div>
            </section>
          )}

          {currentPage === 'transactions' && (
            <section className="section">
              <h2>My Transactions</h2>
              <p className="sub">
                View your deposits and data purchase history.
              </p>

              <div className="order">
                <h3>Transaction History</h3>
                <p>No transactions to display yet.</p>
                <small>
                  Your transaction history will appear here when the
                  transaction system is connected.
                </small>
              </div>
            </section>
          )}

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

          {currentPage === 'support' && (
            <section className="section">
              <h2>Customer Support</h2>
              <p className="sub">
                Need help with your account or data order?
              </p>

              <div className="order">
                <h3>Contact AirData GH</h3>
                <p>Our support team is available on WhatsApp.</p>

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

          <footer>
            <h2>AirData GH</h2>
            <p>Affordable data. Reliable service.</p>
            <p>WhatsApp: 0548 206 175</p>
            <small>© 2026 AirData GH. All rights reserved.</small>
          </footer>
        </>
      )}
    </main>
  );
}
