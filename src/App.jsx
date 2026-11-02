import React, { useEffect, useState } from 'react';
import { authClient } from './auth-client';
import Admin from './Admin';

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

useEffect(() => {
  const splashTimer = setTimeout(() => {
    setShowSplash(false);
  }, 3500);

  return () => clearTimeout(splashTimer);
}, []);
    const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('airdata-theme') === 'dark'
  );

  const [currentTime, setCurrentTime] = useState(new Date());

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
  const [selected, setSelected] = useState(bundles[0]);
  const [phone, setPhone] = useState('');

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
if (window.location.pathname === '/admin') {
  return <Admin />;
            }

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
      <header>
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
          password,
        });
      } else {
        result = await authClient.signIn.email({
          email,
          password,
        });
      }

      if (result.error) {
        throw new Error(result.error.message || 'Authentication failed.');
      }
      const sessionResult = await authClient.getSession();
setAuthUser(
  result.data?.user ?? sessionResult.data?.user ?? null
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
    <p className="forgotPassword">
      Forgot password?
    </p>
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

      <section className="hero">
        <p className="tag">FAST • AFFORDABLE • RELIABLE</p>
        <h2>Stay connected for less.</h2>
        <p>Get affordable MTN data bundles delivered with ease.</p>
        <a href="#bundles">Explore bundles ↓</a>
      </section>

      <section id="bundles" className="section">
        <h2>MTN Data Bundles</h2>
        <p className="sub">Choose your preferred data package.</p>

        <div className="grid">
          {bundles.map((bundle) => (
            <button
              key={bundle[0]}
              className={`bundle ${selected[0] === bundle[0] ? 'active' : ''}`}
              onClick={() => setSelected(bundle)}
            >
              <strong>{bundle[0]}</strong>
              <span>GH₵{bundle[1]}</span>
            </button>
          ))}
        </div>

        <div className="order">
          <h3>Complete Your Order</h3>
          <p>Selected: <strong>{selected[0]} — GH₵{selected[1]}</strong></p>
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
          <small>You'll confirm your order with us on WhatsApp.</small>
        </div>
      </section>

      <section className="services">
        <h2>More Services Coming Soon</h2>
        <div className="serviceGrid">
          <div>Telecel Data</div>
          <div>AirtelTigo Data</div>
          <div>Airtime Top-up</div>
          <div>DStv Subscription</div>
        </div>
      </section>

                 <section className="tracking">
        <div className="trackingCard">
          <div className="trackingIcon">📦</div>
          <p className="trackingTag">AIRDATA GH • ORDER SUPPORT</p>
          <h2>Track Your Order</h2>
          <p className="trackingText">
            Waiting for your data bundle? Check your order progress using your order reference.
          </p>

          <div className="trackingForm">
            <input
              type="text"
              placeholder="Enter your order reference"
              id="trackingReference"
            />
            <button
              className="trackingButton"
              onClick={() => alert('Live order tracking will be available after payment system activation. Please contact AirData GH on WhatsApp for assistance.')}
            >
              Check Order Status →
            </button>
          </div>

          <p className="trackingNote">
            Need help? Our support team is here for you.
          </p>
        </div>
      </section>
      <footer>
        <h2>AirData GH</h2>
        <p>Affordable data. Reliable service.</p>
        <p>WhatsApp: 0548 206 175</p>
        <small>© 2026 AirData GH. All rights reserved.</small>
      </footer>
    </main>
  );
}
