import React, { useEffect, useState } from 'react';
import InScopeAI from './InScopeAI';
import Admin from './Admin';

const WHATSAPP_NUMBER = '233548206175';

const networkBundles = {
  MTN: [
    ['1GB', '4.75'], ['2GB', '9.50'], ['3GB', '14.25'],
    ['4GB', '19.00'], ['5GB', '23.75'], ['6GB', '28.50'],
    ['8GB', '38.00'], ['10GB', '47.50'], ['15GB', '71.25'],
    ['20GB', '93.00'], ['25GB', '116.25'], ['30GB', '139.50'],
    ['40GB', '186.00'], ['50GB', '232.50']
  ],

  'AirtelTigo iShare': [
    ['1GB', '4.30'], ['2GB', '8.60'], ['3GB', '12.90'],
    ['4GB', '17.20'], ['5GB', '21.50'], ['6GB', '25.80'],
    ['7GB', '30.10'], ['8GB', '34.40'], ['10GB', '43.00'],
    ['15GB', '64.50'], ['20GB', '86.00']
  ],

  'AirtelTigo BigTime': [
    ['20GB', '74.00'], ['25GB', '79.00'], ['30GB', '84.00'],
    ['40GB', '99.00'], ['50GB', '109.00'], ['100GB', '179.00'],
    ['200GB', '323.00'], ['250GB', '416.00']
  ],

  Telecel: [
    ['10GB', '42.00'], ['15GB', '63.00'], ['20GB', '84.00'],
    ['25GB', '105.00'], ['30GB', '126.00'],
    ['40GB', '168.00'], ['50GB', '210.00']
  ]
};

const checkerServices = [
  { name: 'WASSCE Results Checker', price: 19 },
  { name: 'NOV/DEC Results Checker', price: 19 },
  { name: 'BECE Results Checker', price: 19 }
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [page, setPage] = useState(
    new URLSearchParams(window.location.search).get('page') || 'dashboard'
  );

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('airdata-theme') === 'dark'
  );

  const [network, setNetwork] = useState('MTN');
  const [selected, setSelected] = useState(networkBundles.MTN[0]);
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [reference, setReference] = useState('');

  const [digitalService, setDigitalService] = useState('afa');
  const [afaForm, setAfaForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    region: '',
    town: ''
  });

  const [checkerType, setCheckerType] = useState(
    checkerServices[0].name
  );
  const [checkerQuantity, setCheckerQuantity] = useState('1');
  const [checkerPhone, setCheckerPhone] = useState('');
  const [serviceMessage, setServiceMessage] = useState('');

  const bundles = networkBundles[network] || networkBundles.MTN;
  const activeBundle =
    bundles.find(item => item[0] === selected[0]) || bundles[0];

  const selectedChecker =
    checkerServices.find(item => item.name === checkerType) ||
    checkerServices[0];

  const checkerTotal =
    selectedChecker.price * Number(checkerQuantity);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('airdata-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Moolre return handling: recover the order reference from the URL.
  useEffect(() => {
    const syncPage = () => {
      const params = new URLSearchParams(window.location.search);
      const nextPage = params.get('page') || 'dashboard';
      const returnedReference = params.get('reference');

      setPage(nextPage);

      if (returnedReference) {
        setReference(returnedReference);
        setOrderStatus('processing');
        setMessage('Payment return received. Checking your order...');
      }
    };

    syncPage();

    window.addEventListener('popstate', syncPage);
    return () => window.removeEventListener('popstate', syncPage);
  }, []);

  // Check immediately and keep checking while payment/delivery is pending.
  useEffect(() => {
    if (
      !reference ||
      !['pending', 'processing', 'awaiting_payment'].includes(orderStatus)
    ) {
      return;
    }

    checkOrderStatus(true);

    const timer = setInterval(() => {
      checkOrderStatus(true);
    }, 15000);

    return () => clearInterval(timer);
  }, [reference, orderStatus]);

  function navigate(nextPage) {
    window.history.pushState(
      {},
      '',
      nextPage === 'dashboard' ? '/' : `/?page=${nextPage}`
    );
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeNetwork(value) {
    setNetwork(value);
    setSelected(networkBundles[value][0]);
    setPhone('');
    setMessage('');
    setReference('');
    setOrderStatus('');
  }

  async function orderNow() {
    if (loading) return;

    if (!/^0\d{9}$/.test(phone)) {
      setMessage('Enter a valid 10-digit Ghana phone number.');
      setOrderStatus('error');
      return;
    }

    setLoading(true);
    setMessage('Preparing your secure payment...');
    setOrderStatus('pending');

    try {
      const response = await fetch('/api/checkout/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          network,
          volume_gb: Number.parseInt(activeBundle[0], 10),
          recipient: phone
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Unable to initialize payment.'
        );
      }

      if (!result.payment_url || !result.reference) {
        throw new Error('Payment provider did not return a valid payment link.');
      }

      setReference(result.reference);
      setOrderStatus('awaiting_payment');
      setMessage('Your order has been created. Redirecting to payment...');

      window.location.href = result.payment_url;
    } catch (error) {
      setOrderStatus('error');
      setMessage(error.message || 'Payment could not be initialized.');
    } finally {
      setLoading(false);
    }
  }

  async function checkOrderStatus(silent = false) {
    if (!reference) return;

    if (!silent) {
      setLoading(true);
      setMessage('Checking your order status...');
    }

    try {
      const response = await fetch(
        `/api/checkout/status?reference=${encodeURIComponent(reference)}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to check order status.');
      }

      const status = String(result.status || 'pending').toLowerCase();

      setOrderStatus(status);
      setMessage(
        result.message ||
        (status === 'completed'
          ? 'Your data bundle has been delivered successfully.'
          : status === 'failed'
            ? 'Your order could not be completed. Please contact support.'
            : 'Your order is being processed. Please wait.')
      );
    } catch (error) {
      if (!silent) {
        setMessage(error.message || 'Unable to check order status.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function updateAfa(field, value) {
    setAfaForm(previous => ({
      ...previous,
      [field]: value
    }));
    setServiceMessage('');
  }

  function submitAfaRequest(event) {
    event.preventDefault();

    const { fullName, phone: afaPhone, dateOfBirth, region, town } = afaForm;

    if (
      !fullName.trim() ||
      !/^0\d{9}$/.test(afaPhone) ||
      !dateOfBirth ||
      !region ||
      !town.trim()
    ) {
      setServiceMessage('Please complete all fields correctly.');
      return;
    }

    const text = [
      'MTN AFA REGISTRATION REQUEST',
      `Name: ${fullName}`,
      `Phone: ${afaPhone}`,
      `Date of birth: ${dateOfBirth}`,
      `Region: ${region}`,
      `Town: ${town}`,
      'Price: GH₵15.00'
    ].join('\n');

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,
      '_blank'
    );

    setServiceMessage(
      'Your request is ready. Complete the conversation on WhatsApp. Registration is not confirmed until processed.'
    );
  }

  function submitCheckerRequest(event) {
    event.preventDefault();

    const quantity = Number(checkerQuantity);

    if (!/^0\d{9}$/.test(checkerPhone)) {
      setServiceMessage('Enter a valid 10-digit Ghana phone number.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      setServiceMessage('Choose a quantity between 1 and 20.');
      return;
    }

    const text = [
      'EXAMINATION RESULTS CHECKER ORDER',
      `Checker: ${checkerType}`,
      `Quantity: ${quantity}`,
      `Unit price: GH₵${selectedChecker.price.toFixed(2)}`,
      `Total: GH₵${checkerTotal.toFixed(2)}`,
      `Customer phone: ${checkerPhone}`
    ].join('\n');

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,
      '_blank'
    );

    setServiceMessage(
      'Your request is ready. Availability and payment will be confirmed on WhatsApp.'
    );
  }

  if (window.location.pathname === '/admin') {
    return <Admin />;
  }

  return (
    <main className={darkMode ? 'dark-mode' : 'light-mode'}>
    
<style>{`
  * { box-sizing: border-box; }

  :root {
    font-family: Inter, Arial, sans-serif;
    color-scheme: light;
  }

  body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background: #f3f7fc;
  }

  main {
    min-height: 100vh;
    background: #f4f7fc;
    color: #10213b;
    transition: background .3s, color .3s;
  }

  .dark-mode {
    background: #071426;
    color: #edf5ff;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    padding: 17px 6%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    flex-wrap: wrap;
    color: white;
    background: rgba(5, 20, 43, .96);
    border-bottom: 1px solid #ffffff15;
    box-shadow: 0 8px 30px #06152b20;
    backdrop-filter: blur(18px);
  }

  .brand {
    font-size: 23px;
    font-weight: 950;
    letter-spacing: -1px;
  }

  .brand span { color: #38c7ff; }

  .nav {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .nav button, .theme-button {
    padding: 10px 15px;
    border: 1px solid #ffffff24;
    border-radius: 12px;
    color: #dcecff;
    background: #ffffff0b;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
    transition: .25s;
  }

  .nav button:hover, .theme-button:hover {
    background: #087cff;
    border-color: #087cff;
    color: white;
    transform: translateY(-2px);
  }

  .hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 360px;
    padding: 75px 8%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: white;
    background:
      radial-gradient(circle at 15% 20%, #168bff55, transparent 30%),
      radial-gradient(circle at 85% 80%, #00d4ff35, transparent 35%),
      linear-gradient(125deg, #041329, #0b3970 55%, #087fc5);
  }

  .hero::before, .hero::after {
    content: "";
    position: absolute;
    z-index: -1;
    border: 1px solid #ffffff20;
    border-radius: 50%;
    pointer-events: none;
  }

  .hero::before {
    width: 340px;
    height: 340px;
    right: -100px;
    top: -180px;
    box-shadow: 0 0 0 35px #ffffff08, 0 0 0 75px #ffffff06;
  }

  .hero::after {
    width: 190px;
    height: 190px;
    left: -90px;
    bottom: -100px;
  }

  .hero h1 {
    max-width: 780px;
    margin: 0 0 16px;
    font-size: clamp(34px, 6vw, 58px);
    line-height: 1.1;
    letter-spacing: -2px;
    font-weight: 950;
  }

  .hero p {
    max-width: 550px;
    color: #d5eaff;
    font-size: 15px;
    line-height: 1.9;
  }

  .content {
    width: min(1100px, 100%);
    margin: 42px auto;
    padding: 0 22px;
  }

  .panel {
    position: relative;
    padding: 30px;
    margin-bottom: 24px;
    border: 1px solid #e2eaf5;
    border-radius: 23px;
    color: #14243d;
    background: white;
    box-shadow: 0 15px 45px rgba(18, 49, 88, .065);
  }

  .panel h2 {
    margin: 0 0 12px;
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -.8px;
  }

  .panel h3 { margin-top: 0; }

  label {
    display: block;
    margin: 19px 0 9px;
    font-size: 13px;
    font-weight: 800;
  }

  input, select, textarea {
    width: 100%;
    padding: 15px;
    border: 1px solid #d8e2ef;
    border-radius: 13px;
    outline: none;
    background: #f9fbff;
    color: #172b4d;
    font: inherit;
    transition: .2s;
  }

  input:focus, select:focus, textarea:focus {
    border-color: #168bff;
    box-shadow: 0 0 0 4px #168bff17;
    background: white;
  }

  .network-grid, .bundle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
    gap: 13px;
    margin: 19px 0;
  }

  .network-button, .bundle-button {
    min-height: 60px;
    padding: 15px 12px;
    border: 1px solid #dce6f2;
    border-radius: 15px;
    color: #18304f;
    background: #f8faff;
    font-weight: 850;
    cursor: pointer;
    transition: .23s;
  }

  .network-button:hover, .bundle-button:hover {
    border-color: #168bff;
    transform: translateY(-3px);
    box-shadow: 0 9px 23px #087cff17;
  }

  .network-button.active, .bundle-button.active {
    border: 2px solid #087cff;
    color: #0757bd;
    background: linear-gradient(140deg, #e9f4ff, #f5fbff);
    box-shadow: 0 7px 22px #087cff1c;
  }

  .bundle-button span {
    display: block;
    margin-top: 8px;
    color: #087cff;
    font-size: 13px;
    font-weight: 850;
  }

  .primary {
    width: 100%;
    padding: 16px 20px;
    margin-top: 17px;
    border: 0;
    border-radius: 14px;
    color: white;
    background: linear-gradient(110deg, #087cff, #0754c7);
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 9px 24px #087cff35;
    transition: .25s;
  }

  .primary:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px #087cff45;
  }

  .primary:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .status {
    padding: 17px;
    margin-top: 18px;
    border: 1px solid #cfe4ff;
    border-radius: 14px;
    color: #174b86;
    background: #edf6ff;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .muted {
    color: #71839b;
    line-height: 1.8;
  }

  .digital-tabs {
    display: flex;
    gap: 12px;
    margin: 20px 0;
  }

  .digital-tabs button {
    flex: 1;
    padding: 14px;
    border: 1px solid #dce6f2;
    border-radius: 13px;
    color: #18304f;
    background: #f8faff;
    font-weight: 850;
    cursor: pointer;
  }

  .digital-tabs button.active {
    color: white;
    background: #087cff;
    border-color: #087cff;
  }

  .price {
    padding: 18px;
    margin: 18px 0;
    border: 1px solid #cfe4ff;
    border-radius: 15px;
    color: #174b86;
    background: linear-gradient(135deg, #edf6ff, #f7fbff);
    line-height: 2;
  }

  footer {
    padding: 45px 20px;
    margin-top: 65px;
    text-align: center;
    color: white;
    background:
      radial-gradient(circle at 50% 0%, #10569a, transparent 55%),
      #041329;
  }

  footer h2 {
    font-size: 27px;
    font-weight: 950;
  }

  footer p { color: #c1d8f1; }

  .splash {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: white;
    background:
      radial-gradient(circle at 50% 40%, #14569a, transparent 48%),
      linear-gradient(145deg, #020817, #061a36);
  }

  .splash-logo {
    width: 108px;
    height: 108px;
    display: grid;
    place-items: center;
    border: 2px solid #38baff;
    border-radius: 30px;
    font-size: 45px;
    font-weight: 950;
    margin-bottom: 23px;
    box-shadow: 0 0 35px #1689e5, inset 0 0 25px #1689e555;
    animation: logoPulse 2s infinite alternate;
  }

  .splash h1 {
    letter-spacing: 5px;
    font-weight: 950;
  }

  .splash p {
    color: #9edcff;
    letter-spacing: 2px;
    font-size: 11px;
  }

  @keyframes logoPulse {
    from { transform: scale(.97); box-shadow: 0 0 20px #1689e5; }
    to { transform: scale(1.04); box-shadow: 0 0 45px #1689e5; }
  }

  .dark-mode .panel {
    color: #edf5ff;
    background: #10243c;
    border-color: #294766;
  }

  .dark-mode input, .dark-mode select, .dark-mode textarea {
    color: white;
    background: #091a2d;
    border-color: #34516f;
  }

  .dark-mode .network-button,
  .dark-mode .bundle-button,
  .dark-mode .digital-tabs button {
    color: #e5efff;
    background: #0c2037;
    border-color: #294766;
  }

  .dark-mode .network-button.active,
  .dark-mode .bundle-button.active,
  .dark-mode .digital-tabs button.active {
    color: white;
    background: #075db9;
    border-color: #38aaff;
  }

  .dark-mode .price,
  .dark-mode .status {
    color: #c7e2ff;
    background: #193755;
    border-color: #34516f;
  }

  .dark-mode .muted { color: #a9bbd0; }

  @media (max-width: 700px) {
    .topbar {
      padding: 15px 16px;
      justify-content: center;
      gap: 14px;
    }

    .brand { font-size: 21px; }

    .nav {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .nav button { min-height: 43px; }

    .hero {
      min-height: 330px;
      padding: 55px 22px;
    }

    .hero h1 { letter-spacing: -1.3px; }

    .hero p { font-size: 13px; }

    .content {
      margin: 25px auto;
      padding: 0 14px;
    }

    .panel {
      padding: 21px 17px;
      border-radius: 19px;
    }

    .panel h2 { font-size: 22px; }

    .network-grid, .bundle-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .network-button, .bundle-button {
      min-height: 65px;
      padding: 12px 7px;
    }

    .digital-tabs { flex-direction: column; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`}</style>


      {showSplash && (
        <div className="splash">
          <div className="splash-logo">AD</div>
          <h1>AIRDATA GH</h1>
          <p>YOUR CONNECTION. OUR PRIORITY.</p>
          <button onClick={() => setShowSplash(false)}>Skip Intro →</button>
        </div>
      )}

      {!showSplash && (
        <>
          <header className="topbar">
            <div className="brand">AIRDATA <span>GH</span></div>

            <nav className="nav">
              <button onClick={() => navigate('dashboard')}>Home</button>
              <button onClick={() => navigate('buy-data')}>Buy Data</button>
              <button onClick={() => navigate('digital-services')}>Digital Services</button>
              <button onClick={() => navigate('support')}>Support</button>
            </nav>

            <button
              className="theme-button"
              onClick={() => setDarkMode(value => !value)}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </header>

          {page === 'dashboard' && (
            <>
              <section className="hero">
                <h1>Welcome to AirData GH</h1>
                <p>Affordable data. Reliable service. Fast and secure checkout.</p>
                <button className="primary" style={{ maxWidth: 220 }}
                  onClick={() => navigate('buy-data')}>
                  Buy Data Now
                </button>
              </section>

              <div className="content">
                <section className="panel">
                  <h2>Choose your service</h2>
                  <p className="muted">
                    Buy data bundles for MTN, Telecel and AirtelTigo.
                    No account or wallet required.
                  </p>
                  <div className="network-grid">
                    {Object.keys(networkBundles).map(item => (
                      <button
                        key={item}
                        className="network-button"
                        onClick={() => {
                          changeNetwork(item);
                          navigate('buy-data');
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {page === 'buy-data' && (
            <div className="content">
              <section className="panel">
                <h2>Buy Data Bundles</h2>
                <p className="muted">
                  Select your network, choose a package and enter the
                  number that should receive the data.
                </p>

                <label>Select Network</label>
                <div className="network-grid">
                  {Object.keys(networkBundles).map(item => (
                    <button
                      key={item}
                      className={`network-button ${network === item ? 'active' : ''}`}
                      onClick={() => changeNetwork(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <label>Select Data Bundle</label>
                <div className="bundle-grid">
                  {bundles.map(bundle => (
                    <button
                      key={`${network}-${bundle[0]}`}
                      className={`bundle-button ${activeBundle[0] === bundle[0] ? 'active' : ''}`}
                      onClick={() => setSelected(bundle)}
                    >
                      {bundle[0]}
                      <span>GH₵{bundle[1]}</span>
                    </button>
                  ))}
                </div>

                <div className="price">
                  Network: <strong>{network}</strong><br />
                  Bundle: <strong>{activeBundle[0]}</strong><br />
                  Total payment: <strong>GH₵{activeBundle[1]}</strong>
                </div>

                <label htmlFor="recipient-phone">Recipient Phone Number</label>
                <input
                  id="recipient-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="e.g. 0241234567"
                  value={phone}
                  maxLength={10}
                  onChange={event => {
                    setPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                    setMessage('');
                  }}
                />

                <button
                  className="primary"
                  onClick={orderNow}
                  disabled={loading}
                >
                  {loading ? 'Please wait...' : `Pay GH₵${activeBundle[1]} and Buy Data`}
                </button>

                {message && (
                  <div className="status" role="status">
                    <strong>
                      {orderStatus === 'completed'
                        ? 'Order Delivered'
                        : orderStatus === 'failed'
                          ? 'Order Failed'
                          : orderStatus === 'error'
                            ? 'Unable to Continue'
                            : 'Order Update'}
                    </strong>
                    <p>{message}</p>

                    {reference && (
                      <>
                        <small>Order reference: {reference}</small>
                        <button
                          className="primary"
                          onClick={() => checkOrderStatus(false)}
                          disabled={loading}
                        >
                          Check Order Status
                        </button>
                      </>
                    )}
                  </div>
                )}

                <p className="muted">
                  Payments are handled through Moolre. Your data order
                  is sent to the supplier only after payment confirmation.
                  Delivery is shown only after supplier confirmation.
                </p>
              </section>
            </div>
          )}

          {page === 'digital-services' && (
            <div className="content">
              <section className="panel">
                <h2>Digital Services</h2>
                <p className="muted">
                  Request MTN AFA registration and examination results checkers.
                </p>

                <div className="digital-tabs">
                  <button
                    className={digitalService === 'afa' ? 'active' : ''}
                    onClick={() => {
                      setDigitalService('afa');
                      setServiceMessage('');
                    }}
                  >
                    MTN AFA
                  </button>
                  <button
                    className={digitalService === 'checkers' ? 'active' : ''}
                    onClick={() => {
                      setDigitalService('checkers');
                      setServiceMessage('');
                    }}
                  >
                    Results Checkers
                  </button>
                </div>

                {digitalService === 'afa' && (
                  <form onSubmit={submitAfaRequest}>
                    <h3>MTN AFA Registration</h3>
                    <div className="price">Registration request fee: <strong>GH₵15.00</strong></div>

                    <label>Full Name</label>
                    <input
                      value={afaForm.fullName}
                      onChange={event => updateAfa('fullName', event.target.value)}
                      required
                    />

                    <label>Phone Number</label>
                    <input
                      value={afaForm.phone}
                      maxLength={10}
                      onChange={event => updateAfa(
                        'phone',
                        event.target.value.replace(/\D/g, '').slice(0, 10)
                      )}
                      required
                    />

                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={afaForm.dateOfBirth}
                      onChange={event => updateAfa('dateOfBirth', event.target.value)}
                      required
                    />

                    <label>Region</label>
                    <select
                      value={afaForm.region}
                      onChange={event => updateAfa('region', event.target.value)}
                      required
                    >
                      <option value="">Select region</option>
                      {[
                        'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central',
                        'Eastern', 'Greater Accra', 'North East', 'Northern',
                        'Oti', 'Savannah', 'Upper East', 'Upper West',
                        'Volta', 'Western', 'Western North'
                      ].map(region => (
                        <option key={region}>{region}</option>
                      ))}
                    </select>

                    <label>Town / District</label>
                    <input
                      value={afaForm.town}
                      onChange={event => updateAfa('town', event.target.value)}
                      required
                    />

                    <button className="primary" type="submit">
                      Continue via WhatsApp
                    </button>
                  </form>
                )}

                {digitalService === 'checkers' && (
                  <form onSubmit={submitCheckerRequest}>
                    <h3>Results Checkers</h3>

                    <label>Checker Type</label>
                    <select
                      value={checkerType}
                      onChange={event => setCheckerType(event.target.value)}
                    >
                      {checkerServices.map(item => (
                        <option key={item.name}>{item.name}</option>
                      ))}
                    </select>

                    <label>Quantity</label>
                    <select
                      value={checkerQuantity}
                      onChange={event => setCheckerQuantity(event.target.value)}
                    >
                      {Array.from({ length: 20 }, (_, index) => index + 1).map(number => (
                        <option key={number} value={number}>{number}</option>
                      ))}
                    </select>

                    <label>Your Phone Number</label>
                    <input
                      value={checkerPhone}
                      maxLength={10}
                      onChange={event => setCheckerPhone(
                        event.target.value.replace(/\D/g, '').slice(0, 10)
                      )}
                      required
                    />

                    <div className="price">
                      Unit price: GH₵{selectedChecker.price.toFixed(2)}<br />
                      Total: <strong>GH₵{checkerTotal.toFixed(2)}</strong>
                    </div>

                    <button className="primary" type="submit">
                      Request via WhatsApp
                    </button>
                  </form>
                )}

                {serviceMessage && <div className="status">{serviceMessage}</div>}
              </section>
            </div>
          )}

          {page === 'support' && (
            <div className="content">
              <section className="panel">
                <h2>Customer Support</h2>
                <p>Need help with an order or payment? Contact AirData GH.</p>
                <a
                  className="primary"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello AirData GH, I need assistance.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat with Support on WhatsApp
                </a>
              </section>
            </div>
          )}

          {page === 'settings' && (
            <div className="content">
              <section className="panel">
                <h2>Settings</h2>
                <button className="primary" onClick={() => setDarkMode(value => !value)}>
                  {darkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                </button>
              </section>
            </div>
          )}

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
