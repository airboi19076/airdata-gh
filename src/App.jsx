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
        body { margin: 0; font-family: Inter, Arial, sans-serif; }
        main {
          min-height: 100vh;
          background: #f3f7fc;
          color: #14243b;
          transition: .2s;
        }
        .dark-mode { background: #081526; color: #edf5ff; }
        .topbar {
          background: #071b35;
          color: white;
          padding: 16px 5%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .brand { font-size: 21px; font-weight: 900; letter-spacing: 1px; }
        .brand span { color: #39baff; }
        .nav {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .nav button, .theme-button {
          border: 1px solid #34516f;
          background: transparent;
          color: white;
          padding: 9px 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        .nav button:hover, .theme-button:hover { background: #176bd0; }
        .hero {
          padding: 35px 20px;
          text-align: center;
          color: white;
          background: linear-gradient(120deg,#071b35,#1266bd);
        }
        .hero h1 { font-size: clamp(28px,5vw,43px); margin: 0 0 10px; }
        .hero p { opacity: .9; line-height: 1.6; }
        .content { max-width: 900px; margin: 25px auto; padding: 0 16px; }
        .panel {
          background: white;
          color: #172b4d;
          border: 1px solid #dce6f1;
          border-radius: 17px;
          padding: 22px;
          margin-bottom: 18px;
          box-shadow: 0 8px 25px rgba(20,45,80,.05);
        }
        .dark-mode .panel { background: #13243b; color: #edf4ff; border-color: #29415e; }
        .panel h2, .panel h3 { margin-top: 0; }
        label { display: block; font-weight: 700; margin: 14px 0 7px; }
        input, select, textarea {
          width: 100%;
          padding: 13px;
          border: 1px solid #ccd8e6;
          border-radius: 9px;
          background: white;
          color: #172b4d;
          font: inherit;
        }
        .dark-mode input, .dark-mode select, .dark-mode textarea {
          background: #0d1c30;
          color: white;
          border-color: #39516e;
        }
        .network-grid, .bundle-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(125px,1fr));
          gap: 10px;
          margin: 15px 0;
        }
        .network-button, .bundle-button {
          padding: 14px 10px;
          border: 1px solid #d5e0ed;
          border-radius: 11px;
          background: white;
          color: #18304f;
          font-weight: 800;
          cursor: pointer;
        }
        .dark-mode .network-button, .dark-mode .bundle-button {
          background: #0d1c30; color: white; border-color: #39516e;
        }
        .network-button.active, .bundle-button.active {
          background: #176bd0; color: white; border-color: #176bd0;
        }
        .bundle-button span { display: block; margin-top: 7px; }
        .primary {
          width: 100%;
          border: 0;
          padding: 15px;
          border-radius: 10px;
          color: white;
          background: #0876df;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 15px;
        }
        .primary:disabled { opacity: .6; cursor: not-allowed; }
        .status {
          padding: 14px;
          margin-top: 15px;
          border-radius: 10px;
          background: #eaf3ff;
          color: #174b86;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
        .dark-mode .status { background: #193755; color: #c7e2ff; }
        .muted { color: #73849a; line-height: 1.6; }
        .dark-mode .muted { color: #a9bbd0; }
        .digital-tabs { display: flex; gap: 10px; margin: 15px 0; }
        .digital-tabs button {
          flex: 1; padding: 13px; border: 1px solid #d5e0ed;
          border-radius: 10px; background: white; cursor: pointer;
          font-weight: 800; color: #18304f;
        }
        .digital-tabs button.active { background: #176bd0; color: white; }
        .dark-mode .digital-tabs button { background: #0d1c30; color: white; border-color: #39516e; }
        .dark-mode .digital-tabs button.active { background: #176bd0; }
        .price {
          padding: 15px; margin: 15px 0; border-radius: 10px;
          background: #edf5ff; color: #174b86;
        }
        .dark-mode .price { background: #193755; color: #c7e2ff; }
        footer {
          text-align: center; padding: 28px 15px;
          background: #071b35; color: white; margin-top: 40px;
        }
        footer p { opacity: .8; }
        .splash {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          color: white; background: radial-gradient(circle,#124d86,#061326 70%);
        }
        .splash-logo {
          width: 100px; height: 100px; display: grid; place-items: center;
          border: 3px solid #38baff; border-radius: 28px;
          font-size: 42px; font-weight: 900; margin-bottom: 20px;
          box-shadow: 0 0 35px #1689e5;
        }
        .splash h1 { letter-spacing: 4px; }
        .splash p { color: #9edcff; }
        .splash button {
          margin-top: 25px; padding: 10px 20px; border-radius: 8px;
          border: 1px solid #5ebfff; color: white; background: transparent;
        }
        @media(max-width:600px) {
          .topbar { justify-content: center; }
          .nav { width: 100%; }
          .nav button { flex: 1; }
          .panel { padding: 17px; }
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
