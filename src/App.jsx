
import InScopeAI from './InScopeAI';
import React, { useEffect, useState } from 'react';
import { authClient } from './auth-client';
import Admin from './Admin';
import DashboardMenu from './DashboardMenu';


const bundles = [
  ['1GB', '4.75'],
  ['2GB', '9.50'],
  ['3GB', '14.25'],
  ['4GB', '19.00'],
  ['5GB', '23.75'],
  ['6GB', '28.50'],
  ['8GB', '38.00'],
  ['10GB', '47.50'],
  ['15GB', '71.25'],
  ['20GB', '93.00'],
  ['25GB', '116.25'],
  ['30GB', '139.50'],
  ['40GB', '186.00'],
  ['50GB', '232.50']
];

const airtelTigoBundles = [
  ['1GB', '4.30'],
  ['2GB', '8.60'],
  ['3GB', '12.90'],
  ['4GB', '17.20'],
  ['5GB', '21.50'],
  ['6GB', '25.80'],
  ['7GB', '30.10'],
  ['8GB', '34.40'],
  ['10GB', '43.00'],
  ['15GB', '64.50'],
  ['20GB', '86.00']
];


const telecelBundles = [
  ['10GB', '42.00'],
  ['15GB', '63.00'],
  ['20GB', '84.00'],
  ['25GB', '105.00'],
  ['30GB', '126.00'],
  ['40GB', '168.00'],
  ['50GB', '210.00']
];

// AirtelTigo BigTime — GH₵6 profit per package
const airtelTigoBigTimeBundles = [
  ['20GB', '74.00'],
  ['25GB', '79.00'],
  ['30GB', '84.00'],
  ['40GB', '99.00'],
  ['50GB', '109.00'],
  ['100GB', '179.00'],
  ['200GB', '323.00'],
  ['250GB', '416.00']
];

const networkBundles = {
  MTN: bundles,
  Telecel: telecelBundles,
  'AirtelTigo iShare': airtelTigoBundles,
  'AirtelTigo BigTime': airtelTigoBigTimeBundles
};



const checkerServices = [
  { name: 'WASSCE Results Checker', price: 19 },
  { name: 'NOV/DEC Results Checker', price: 19 },
  { name: 'BECE Results Checker', price: 19 }
];

const WHATSAPP_NUMBER = '233548206175';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');
  const [authUser, setAuthUser] = useState(null);
const [authLoading, setAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(
    new URLSearchParams(window.location.search).get('page') || 'dashboard'
  );

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('airdata-theme') === 'dark'
  );

  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [selected, setSelected] = useState(bundles[0]);
  const [phone, setPhone] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
const [orderMessage, setOrderMessage] = useState('');
const [orderStatus, setOrderStatus] = useState('');
const [orderReference, setOrderReference] = useState('');

  const [orderMode, setOrderMode] = useState('single');
  const [bulkPhones, setBulkPhones] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletMessage, setWalletMessage] = useState('');

  const [digitalService, setDigitalService] = useState('afa');
  const [afaForm, setAfaForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    region: '',
    town: ''
  });

  const [checkerType, setCheckerType] = useState(checkerServices[0].name);
  const [checkerQuantity, setCheckerQuantity] = useState('1');
  const [checkerPhone, setCheckerPhone] = useState('');
  const [serviceMessage, setServiceMessage] = useState('');

  // Always use a bundle belonging to the currently selected network.
  const availableBundles = networkBundles[selectedNetwork] || bundles;
  const activeBundle =
    availableBundles.find(item => item[0] === selected[0]) ||
    availableBundles[0];

  useEffect(() => {
  let active = true;

  authClient.getSession()
    .then(({ data, error }) => {
      if (active && !error) setAuthUser(data?.user ?? null);
    })
    .catch(() => {})
    .finally(() => {
      if (active) setAuthLoading(false);
    });

  const syncPage = () => {
    const page = new URLSearchParams(window.location.search).get('page') || 'dashboard';
    setCurrentPage(page);
  };

  window.addEventListener('popstate', syncPage);

  return () => {
    active = false;
    window.removeEventListener('popstate', syncPage);
  };
}, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500);
    return () => clearTimeout(timer);
  }, []);

    useEffect(() => {
    localStorage.setItem('airdata-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Restore the customer's latest order after a page refresh.
  useEffect(() => {
    if (!authUser?.id) {
      setOrderReference('');
      return;
    }

    const savedReference = localStorage.getItem(
      `airdata-last-order-${authUser.id}`
    );

    if (savedReference) setOrderReference(savedReference);
  }, [authUser]);

  // Save the latest order reference on this device.
  useEffect(() => {
    if (authUser?.id && orderReference) {
      localStorage.setItem(
        `airdata-last-order-${authUser.id}`,
        orderReference
      );
    }
  }, [authUser, orderReference]);

  
  async function getWalletToken() {
  const tokenResult = await authClient.token();

  if (tokenResult?.error) {
    throw new Error(
      tokenResult.error.message ||
      'Neon could not refresh your login token. Please sign in again.'
    );
  }

  const token = tokenResult?.data?.token;

  if (
    typeof token !== 'string' ||
    token.split('.').length !== 3
  ) {
    throw new Error(
      'Your login session has expired. Please sign in again.'
    );
  }

  return token;
}

  async function loadWallet() {
    setWalletLoading(true);
    setWalletMessage('');

    try {
      const token = await getWalletToken();

      const response = await fetch('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` }
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
const reference = params.get('reference');

if (!reference || !reference.startsWith('ADGH-')) {
  if (params.has('trxref') || params.has('reference')) {
    window.history.replaceState({}, '', '/?page=deposit');
  }
  return;
}

    window.history.replaceState({}, '', '/?page=deposit');
    setCurrentPage('deposit');

    let cancelled = false;

    async function verifyPayment() {
      setWalletLoading(true);
      setWalletMessage('Waiting for Moolre to confirm your payment...');

      try {
        const token = await getWalletToken();

        for (let attempt = 0; attempt < 10; attempt++) {
          if (cancelled) return;

          const response = await fetch('/api/wallet/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reference })
          });

          const result = await response.json();

          if (response.ok && result.success) {
            setWalletBalance(Number(result.balance || 0));
            setWalletMessage('Payment successful! Your wallet has been credited.');
            await loadWallet();
            setDepositAmount('');
            return;
          }

          if (response.status === 402 || response.status === 404) {
            throw new Error(result.error || 'Payment could not be confirmed.');
          }

          if (!result.pending) {
            throw new Error(result.error || 'Could not verify your payment.');
          }

          setWalletMessage('Payment is still being confirmed. Please wait...');

          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        setWalletMessage(
          'Your payment is still pending. Please refresh your wallet shortly.'
        );

        await loadWallet();

      } catch (error) {
        setWalletMessage(error.message || 'We could not verify your payment.');
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    }

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [authUser]);


  async function startDeposit() {
    const amount = Number(depositAmount);

    if (!Number.isFinite(amount) || amount < 0.10 || amount > 10000) {
      setWalletMessage('Enter an amount between GH₵0.10 and GH₵10,000.');
      return;
    }

    setWalletLoading(true);
    setWalletMessage('Preparing your secure Moolre payment...');

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
        throw new Error(result.error || 'Could not start your payment.');
      }

      window.location.assign(result.authorization_url);
    } catch (error) {
      setWalletMessage(
        error.message || 'Could not initialize your deposit.'
      );
      setWalletLoading(false);
    }
  }

  // Switch network and reset the selected bundle to the first
  // available package on that network.
  function changeNetwork(network) {
    const nextBundles = networkBundles[network];

    if (!nextBundles || !nextBundles.length) return;

    setSelectedNetwork(network);
    setSelected(nextBundles[0]);
    setPhone('');
    setBulkPhones('');
    setBulkMessage('');
    setOrderMode('single');
  }

  
  async function orderNow() {
    if (orderLoading) return;

    if (!authUser) {
      setOrderMessage('Please sign in before placing a data order.');
      setOrderStatus('error');
      return;
    }

    if (!/^0\d{9}$/.test(phone)) {
      setOrderMessage('Enter a valid 10-digit Ghana phone number.');
      setOrderStatus('error');
      return;
    }

    setOrderLoading(true);
    setOrderMessage('Preparing your order...');
    setOrderStatus('pending');

    let requestStarted = false;

    try {
      const token = await getWalletToken();
      const reference = `ADGH-${crypto.randomUUID()}`;

      setOrderReference(reference);
      setOrderMessage('Submitting your data order securely...');

      requestStarted = true;

      const response = await fetch('/api/kingflexy/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          network: selectedNetwork,
          volume_gb: Number.parseInt(activeBundle[0], 10),
          recipient: phone,
          reference
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Your order could not be submitted.');
      }

      setOrderStatus(result.status || 'pending');
      setOrderMessage(
        result.message || 'Your order has been submitted. Check its status below.'
      );

      await loadWallet();
    } catch (error) {
      setOrderStatus(requestStarted ? 'pending' : 'error');
      setOrderMessage(
        requestStarted
          ? 'We could not confirm the response. Your order may already have been received. Use Check Order Status below and do not submit a second order.'
          : (error.message || 'Could not prepare your order. Please sign in again.')
      );
    } finally {
      setOrderLoading(false);
    }
  }

  async function checkOrderStatus() {
    if (!orderReference || orderLoading) return;

    setOrderLoading(true);
    setOrderMessage('Checking your order with KiNG FLEXY...');

    try {
      const token = await getWalletToken();

      const response = await fetch(
        `/api/kingflexy/status?reference=${encodeURIComponent(orderReference)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not check this order.');
      }

      setOrderStatus(result.status || 'pending');
      setOrderMessage(result.message || 'Order status updated.');
      await loadWallet();
    } catch (error) {
      setOrderMessage(
        error.message || 'Could not check your order. Please try again.'
      );
    } finally {
      setOrderLoading(false);
    }
  }
  // Automatically check supplier status every 15 seconds.
  useEffect(() => {
    if (!authUser || !orderReference || orderLoading) return;

    if (['completed', 'refunded'].includes(
      String(orderStatus).toLowerCase()
    )) return;

    const pollTimer = setInterval(() => {
      checkOrderStatus();
    }, 15000);

    return () => clearInterval(pollTimer);
  }, [authUser, orderReference, orderStatus, orderLoading]);

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

    if (!numbers.length) {
      setBulkMessage('Enter at least one recipient phone number.');
      return;
    }

    if (numbers.length > 20) {
      setBulkMessage('You can enter a maximum of 20 numbers per request.');
      return;
    }

    const invalid = numbers.filter(number => !/^0\d{9}$/.test(number));

    if (invalid.length) {
      setBulkMessage(
        `Please check these invalid numbers: ${invalid.join(', ')}`
      );
      return;
    }

    const total = Number(activeBundle[1]) * numbers.length;

    const message = [
      'Hello AirData GH, I want to make an MTN bulk data order.',
      `Bundle: ${activeBundle[0]}`,
      `Price per recipient: GH₵${activeBundle[1]}`,
      `Recipients: ${numbers.length}`,
      `Estimated total: GH₵${total.toFixed(2)}`,
      'Recipient numbers:',
      ...numbers.map((number, index) => `${index + 1}. ${number}`)
    ].join('\n');

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    setBulkMessage('');
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

    const { fullName, phone, dateOfBirth, region, town } = afaForm;

    if (
      !fullName.trim() ||
      !/^0\d{9}$/.test(phone) ||
      !dateOfBirth ||
      !region ||
      !town.trim()
    ) {
      setServiceMessage(
        'Please complete all fields and enter a valid Ghana phone number.'
      );
      return;
    }

    const message = [
      'MTN AFA REGISTRATION REQUEST',
      '',
      `Customer: ${fullName}`,
      `Phone number: ${phone}`,
      `Date of birth: ${dateOfBirth}`,
      `Region: ${region}`,
      `Town / District: ${town}`,
      'Service price: GH₵15.00',
      '',
      'Please confirm the registration requirements and processing.'
    ].join('\n');

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    setServiceMessage(
      'Your request has been prepared. Complete the conversation on WhatsApp. Registration is not confirmed until processed.'
    );
  }

  function submitCheckerRequest(event) {
    event.preventDefault();

    const quantity = Number(checkerQuantity);

    if (!/^0\d{9}$/.test(checkerPhone)) {
      setServiceMessage('Enter a valid 10-digit Ghana phone number.');
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      setServiceMessage('Choose a quantity between 1 and 20.');
      return;
    }

    const checker = checkerServices.find(
      item => item.name === checkerType
    );

    if (!checker) {
      setServiceMessage('Please select a valid checker service.');
      return;
    }

    const total = checker.price * quantity;

    const message = [
      'EXAMINATION RESULTS CHECKER ORDER',
      '',
      `Checker: ${checkerType}`,
      `Quantity: ${quantity}`,
      `Unit price: GH₵${checker.price.toFixed(2)}`,
      `Total: GH₵${total.toFixed(2)}`,
      `Customer phone: ${checkerPhone}`,
      '',
      'Please confirm availability and payment instructions.'
    ].join('\n');

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    setServiceMessage(
      'Your checker request has been prepared. Voucher PINs and serial numbers are not issued until the order is fulfilled.'
    );
  }

  function handleInternalNavigation(event) {
  const link = event.target.closest('a[href]');

  if (!link) return;

  const url = new URL(link.href, window.location.origin);

  if (url.origin !== window.location.origin || url.pathname !== '/') {
    return;
  }

  const page = url.searchParams.get('page');

  if (!page) return;

  event.preventDefault();

  window.history.pushState({}, '', `/?page=${encodeURIComponent(page)}`);
  setCurrentPage(page);
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
    'digital-services': 'Digital Services',
    transactions: 'Transactions',
    profile: 'My Profile',
    support: 'Customer Support',
    settings: 'Settings'
  };

  const bulkNumbers = getBulkNumbers();

  const validBulkNumbers = bulkNumbers.filter(
    number => /^0\d{9}$/.test(number)
  );

  const bulkTotal =
    Number(activeBundle[1]) * validBulkNumbers.length;

  const selectedChecker =
    checkerServices.find(item => item.name === checkerType) ||
    checkerServices[0];

  const checkerTotal =
    selectedChecker.price * Number(checkerQuantity || 0);

  return (
   <main
  className={darkMode ? 'dark-mode' : 'light-mode'}
  onClick={handleInternalNavigation}
>

      <style>{`
        .digital-services {
          max-width: 900px;
          margin: 25px auto;
          padding: 0 16px;
        }

        .digital-intro {
          padding: 24px;
          border-radius: 18px;
          color: white;
          background: linear-gradient(120deg,#09264e,#176bd0);
          margin-bottom: 20px;
        }

        .digital-intro h2 {
          margin: 0 0 8px;
        }

        .digital-intro p {
          margin: 0;
          opacity: .9;
          line-height: 1.6;
        }

        .digital-service-tabs {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .digital-service-tabs button {
          padding: 14px 10px;
          border: 1px solid #dce5f0;
          border-radius: 12px;
          background: white;
          color: #18304f;
          font-weight: 800;
          cursor: pointer;
        }

        .digital-service-tabs button.active {
          background: #176bd0;
          color: white;
          border-color: #176bd0;
        }

        .digital-form-card {
          background: white;
          color: #172b4d;
          padding: 22px;
          border: 1px solid #e0e8f1;
          border-radius: 17px;
          box-shadow: 0 8px 25px rgba(20,45,80,.06);
        }

        .digital-form-card h3 {
          margin-top: 0;
        }

        .digital-form-card label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin: 14px 0 6px;
        }

        .digital-form-card input,
        .digital-form-card select {
          width: 100%;
          box-sizing: border-box;
          padding: 13px;
          border: 1px solid #d5dfeb;
          border-radius: 9px;
          background: white;
          color: #172b4d;
          font: inherit;
        }

        .digital-price {
          margin: 17px 0;
          padding: 15px;
          border-radius: 11px;
          background: #edf5ff;
          color: #174b86;
          line-height: 1.7;
        }

        .digital-price strong {
          font-size: 23px;
        }

        .digital-note {
          display: block;
          margin-top: 13px;
          color: #718096;
          font-size: 11px;
          line-height: 1.6;
        }

        .digital-submit {
          width: 100%;
          padding: 14px;
          border: 0;
          border-radius: 10px;
          color: white;
          background: #176bd0;
          font-weight: 800;
          cursor: pointer;
          margin-top: 15px;
        }

        .digital-status {
          margin-top: 14px;
          padding: 12px;
          background: #edf5ff;
          color: #174b86;
          border-radius: 9px;
          font-size: 12px;
          line-height: 1.6;
        }

        .digital-shortcuts {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
        }

        .digital-shortcuts a {
          display: block;
          padding: 17px;
          border-radius: 13px;
          background: white;
          border: 1px solid #e0e8f1;
          color: #18304f;
          text-decoration: none;
          font-weight: 800;
        }

        .dark-mode .digital-form-card,
        .dark-mode .digital-service-tabs button,
        .dark-mode .digital-shortcuts a {
          background: #13243b;
          color: #edf4ff;
          border-color: #29415e;
        }

        .dark-mode .digital-service-tabs button.active {
          background: #174d82;
          color: white;
        }

        .dark-mode .digital-form-card input,
        .dark-mode .digital-form-card select {
          background: #0d1c30;
          color: white;
          border-color: #39516e;
        }

        .dark-mode .digital-price,
        .dark-mode .digital-status {
          background: #193755;
          color: #c7e2ff;
        }

        @media(max-width:520px) {
          .digital-service-tabs {
            grid-template-columns: 1fr 1fr;
          }

          .digital-form-card {
            padding: 16px;
          }
        }
      `}</style>

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
            <span></span> CONNECTING YOU TO BETTER DATA
          </div>

          <button
            className="skipIntro"
            onClick={() => setShowSplash(false)}
          >
            Skip Intro →
          </button>
        </div>
      )}

      {!showSplash && !authLoading && !authUser && (
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

            <form onSubmit={async event => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);
              const email = String(formData.get('email') || '').trim();
              const password = String(formData.get('password') || '');
              const name = String(formData.get('name') || '').trim();
              const signupPhone = String(formData.get('phone') || '').trim();

              setAuthMessage('Please wait...');

              try {
                let result;
                let phoneSaved = true;

                if (authMode === 'signup') {
                  if (!name) {
                    throw new Error('Enter your full name.');
                  }

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
                          body: JSON.stringify({ phone: signupPhone })
                        }
                      );

                      const phoneResult = await phoneResponse.json();

                      if (!phoneResponse.ok) {
                        phoneSaved = false;
                        console.error(phoneResult.error);
                      }
                    }
                  } catch {
                    phoneSaved = false;
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
                  result.data?.user ||
                  sessionResult.data?.user ||
                  null
                );

                setAuthMessage(
                  authMode === 'signup'
                    ? (
                      phoneSaved
                        ? 'Your account has been created successfully!'
                        : 'Your account was created, but your phone number could not be saved. Please contact support.'
                    )
                    : 'Login successful! Welcome back.'
                );
              } catch (error) {
                setAuthMessage(
                  error.message || 'Something went wrong. Please try again.'
                );
              }
            }}>

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

      {!showSplash && !authLoading && authUser && (
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

          {currentPage === 'dashboard' && (
            <>
              <section id="dashboard" className="hero">
                <p className="tag">
                  FAST • AFFORDABLE • RELIABLE
                </p>

                <h2>
                  Welcome to AirData GH, {customerName}!
                </h2>

                <p>
                  Get affordable data bundles and digital services with ease.
                </p>

                <a href="/?page=buy-data">Buy Data →</a>
              </section>

              <section className="section">
                <h2>Explore Our Services</h2>

                <div className="digital-shortcuts">
                  <a href="/?page=buy-data">
                    📱 Buy Data Bundles
                  </a>

                  <a href="/?page=digital-services">
                    🎓 Digital Services
                  </a>

                  <a href="/?page=digital-services">
                    📝 MTN AFA Registration
                  </a>

                  <a href="/?page=digital-services">
                    📚 Results Checkers
                  </a>
                </div>
              </section>

              <section className="wallet-section">
                <div className="wallet-section-heading">
                  <div>
                    <span className="wallet-eyebrow">
                      YOUR MONEY, READY WHEN YOU ARE
                    </span>

                    <h2>My Wallet</h2>

                    <p>
                      Manage your AirData GH funds in one place.
                    </p>
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
                      <span>GH₵</span>
                      {walletBalance.toFixed(2)}
                    </div>

                    <span className="wallet-balance-footnote">
                      <i></i> Ready to use for eligible purchases
                    </span>
                  </div>

                  <div className="wallet-card-bottom">
                    <span>
                      YOUR CONNECTION. OUR PRIORITY.
                    </span>
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
                    <i className="wallet-live-dot"></i>
                    Wallet balance
                  </span>

                  <button
                    className="wallet-refresh"
                    onClick={loadWallet}
                    disabled={walletLoading}
                  >
                    <span className={
                      walletLoading
                        ? 'wallet-refresh-icon spinning'
                        : 'wallet-refresh-icon'
                    }>
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
                  <a href="/?page=digital-services">🎓 Digital Services</a>
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

          {currentPage === 'buy-data' && (
            <section id="bundles" className="section">

              <p className="sub">
                Select your preferred network and data package.
              </p>

              <div className="network-selector">
                {Object.keys(networkBundles).map(network => (
                  <button
                    key={network}
                    type="button"
                    className={
                      `network-option ${
                        selectedNetwork === network ? 'active' : ''
                      }`
                    }
                    onClick={() => changeNetwork(network)}
                  >
                    {network}
                    <span>Data bundles</span>
                  </button>
                ))}
              </div>

              <h3>{selectedNetwork} Data Packages</h3>

              <div className="grid">
                {availableBundles.map(bundle => (
                  <button
                    type="button"
                    key={`${selectedNetwork}-${bundle[0]}`}
                    className={
                      `bundle ${
                        activeBundle[0] === bundle[0] ? 'active' : ''
                      }`
                    }
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

              {selectedNetwork === 'MTN' && (
                <div className="order-mode-selector">
                  <button
                    type="button"
                    className={orderMode === 'single' ? 'active' : ''}
                    onClick={() => {
                      setOrderMode('single');
                      setBulkMessage('');
                    }}
                  >
                    Single Order
                  </button>

                  <button
                    type="button"
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

              {(selectedNetwork !== 'MTN' ||
                orderMode === 'single') && (
                <div className="order">
                  <h3>Complete Your Order</h3>

                  <p>
                    Network: <strong>{selectedNetwork}</strong>
                  </p>

                  <p>
                    Selected:{' '}
                    <strong>
                      {activeBundle[0]} — GH₵{activeBundle[1]}
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
                    onChange={event => setPhone(
                      event.target.value.replace(/\D/g, '').slice(0, 10)
                    )}
                  />

                  
  <button
    className="orderButton"
    onClick={orderNow}
    disabled={orderLoading}
    type="button"
  >
    {orderLoading ? 'Processing Order...' : 'Buy Data Now'}
  </button>

  {orderMessage && (
    <div className="digital-status" role="status">
      <strong>
        {orderStatus === 'completed'
          ? 'Order Completed'
          : orderStatus === 'refunded'
            ? 'Order Refunded'
            : orderStatus === 'error'
              ? 'Order Not Submitted'
              : 'Order Update'}
      </strong>

      <p>{orderMessage}</p>

      {orderReference && (
        <>
          <small>Order reference: {orderReference}</small>

          <button
            className="orderButton"
            type="button"
            onClick={checkOrderStatus}
            disabled={orderLoading}
          >
            {orderLoading ? 'Checking...' : 'Check Order Status'}
          </button>
        </>
      )}
    </div>
  )}

  <small>
    Your wallet is charged when the order is submitted. If KiNG FLEXY confirms that it failed, the money is refunded to your AirData GH wallet.
  </small>
                </div>
              )}

              {selectedNetwork === 'MTN' &&
                orderMode === 'bulk' && (
                <div className="order">
                  <h3>MTN Bulk Data Order</h3>

                  <p>
                    Select one bundle and enter the phone numbers of all recipients.
                  </p>

                  <p>
                    Bundle per recipient:{' '}
                    <strong>
                      {activeBundle[0]} — GH₵{activeBundle[1]}
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
                    onChange={event => {
                      setBulkPhones(event.target.value);
                      setBulkMessage('');
                    }}
                  />

                  <small className="bulk-help">
                    Enter up to 20 Ghana phone numbers. Use new lines or commas.
                  </small>

                  <div className="bulk-summary">
                    <div>
                      Recipients entered:{' '}
                      <strong>{bulkNumbers.length}</strong>
                    </div>

                    <div>
                      Valid phone numbers:{' '}
                      <strong>{validBulkNumbers.length}</strong>
                    </div>

                    <div>
                      Estimated total:{' '}
                      <strong>GH₵{bulkTotal.toFixed(2)}</strong>
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
                    Your request will be sent for confirmation. This form does not automatically deliver data or deduct wallet funds.
                  </small>
                </div>
              )}
            </section>
          )}

          {currentPage === 'digital-services' && (
            <section className="digital-services">
              <div className="digital-intro">
                <h2>Digital Services</h2>
                <p>
                  Access MTN AFA registration and examination results checkers from AirData GH.
                </p>
              </div>

              <div className="digital-service-tabs">
                <button
                  className={digitalService === 'afa' ? 'active' : ''}
                  onClick={() => {
                    setDigitalService('afa');
                    setServiceMessage('');
                  }}
                >
                  📱 MTN AFA
                </button>

                <button
                  className={digitalService === 'checkers' ? 'active' : ''}
                  onClick={() => {
                    setDigitalService('checkers');
                    setServiceMessage('');
                  }}
                >
                  🎓 Results Checkers
                </button>
              </div>

              {digitalService === 'afa' && (
                <form
                  className="digital-form-card"
                  onSubmit={submitAfaRequest}
                >
                  <h3>MTN AFA Registration</h3>

                  <p>
                    Complete the applicant information to request MTN AFA registration.
                  </p>

                  <div className="digital-price">
                    Registration fee
                    <br />
                    <strong>GH₵15.00</strong>
                  </div>

                  <label>Applicant's full name</label>
                  <input
                    value={afaForm.fullName}
                    onChange={event => updateAfa(
                      'fullName',
                      event.target.value
                    )}
                    placeholder="Enter full name"
                    required
                  />

                  <label>Applicant's phone number</label>
                  <input
                    type="tel"
                    value={afaForm.phone}
                    maxLength={10}
                    onChange={event => updateAfa(
                      'phone',
                      event.target.value.replace(/\D/g, '').slice(0, 10)
                    )}
                    placeholder="0241234567"
                    required
                  />

                  <label>Date of birth</label>
                  <input
                    type="date"
                    value={afaForm.dateOfBirth}
                    onChange={event => updateAfa(
                      'dateOfBirth',
                      event.target.value
                    )}
                    required
                  />

                  <label>Region</label>
                  <select
                    value={afaForm.region}
                    onChange={event => updateAfa(
                      'region',
                      event.target.value
                    )}
                    required
                  >
                    <option value="">Select region</option>

                    {[
                      'Ahafo',
                      'Ashanti',
                      'Bono',
                      'Bono East',
                      'Central',
                      'Eastern',
                      'Greater Accra',
                      'North East',
                      'Northern',
                      'Oti',
                      'Savannah',
                      'Upper East',
                      'Upper West',
                      'Volta',
                      'Western',
                      'Western North'
                    ].map(region => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>

                  <label>Town / District</label>
                  <input
                    value={afaForm.town}
                    onChange={event => updateAfa(
                      'town',
                      event.target.value
                    )}
                    placeholder="Enter town or district"
                    required
                  />

                  <button
                    className="digital-submit"
                    type="submit"
                  >
                    Continue via WhatsApp — GH₵15
                  </button>

                  <small className="digital-note">
                    This is currently a registration request only. Registration is not completed until the supplier processes and confirms it. Do not send Ghana Card details through this temporary form.
                  </small>
                </form>
              )}

              {digitalService === 'checkers' && (
                <form
                  className="digital-form-card"
                  onSubmit={submitCheckerRequest}
                >
                  <h3>Examination Results Checkers</h3>

                  <p>
                    Select the examination checker you need.
                  </p>

                  <label>Checker type</label>
                  <select
                    value={checkerType}
                    onChange={event => {
                      setCheckerType(event.target.value);
                      setServiceMessage('');
                    }}
                  >
                    {checkerServices.map(item => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <label>Quantity</label>
                  <select
                    value={checkerQuantity}
                    onChange={event => setCheckerQuantity(
                      event.target.value
                    )}
                  >
                    {Array.from(
                      { length: 20 },
                      (_, index) => index + 1
                    ).map(number => (
                      <option key={number} value={number}>
                        {number}
                      </option>
                    ))}
                  </select>

                  <label>Your phone number</label>
                  <input
                    type="tel"
                    value={checkerPhone}
                    maxLength={10}
                    onChange={event => {
                      setCheckerPhone(
                        event.target.value.replace(/\D/g, '').slice(0, 10)
                      );
                      setServiceMessage('');
                    }}
                    placeholder="0241234567"
                    required
                  />

                  <div className="digital-price">
                    Price per checker: GH₵{selectedChecker.price.toFixed(2)}
                    <br />
                    Quantity: {checkerQuantity}
                    <br />
                    Total amount
                    <br />
                    <strong>GH₵{checkerTotal.toFixed(2)}</strong>
                  </div>

                  <button
                    className="digital-submit"
                    type="submit"
                  >
                    Request Checker via WhatsApp
                  </button>

                  <small className="digital-note">
                    Availability and payment will be confirmed before fulfilment. Voucher PINs and serial numbers are supplied only after a successful purchase.
                  </small>
                </form>
              )}

              {serviceMessage && (
                <p className="digital-status" role="status">
                  {serviceMessage}
                </p>
              )}
            </section>
          )}

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
                  onChange={event => setDepositAmount(
                    event.target.value
                  )}
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
                  Payments are processed securely through Moolre. Your wallet is credited only after payment verification.
                </small>
              </div>
            </section>
          )}

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
                    {walletTransactions.map(transaction => (
                      <div
                        className="transactionItem"
                        key={transaction.reference}
                      >
                        <h4>
  {transaction.provider === 'kingflexy'
    ? 'Data Purchase'
    : 'Wallet Deposit'}
</h4>

{transaction.description && (
  <p>{transaction.description}</p>
)}

                        <p>
                          Amount:{' '}
                          <strong>
                            GH₵{Number(transaction.amount).toFixed(2)}
                          </strong>
                        </p>

                        <p>
                          Status:{' '}
                          <strong>
                            {transaction.status.toUpperCase()}
                          </strong>
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

          {currentPage === 'profile' && (
            <section className="section">
              <h2>My Profile</h2>

              <p className="sub">
                Manage your AirData GH account.
              </p>

              <div className="order">
                <h3>Account Information</h3>

                <p>
                  Email:{' '}
                  <strong>
                    {authUser?.email || 'Not available'}
                  </strong>
                </p>

                <p>
                  Name:{' '}
                  <strong>
                    {authUser?.name || 'Customer'}
                  </strong>
                </p>

                <button
                  className="orderButton"
                  onClick={logout}
                >
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

                <p>
                  Our support team is available on WhatsApp.
                </p>

                <a
                  className="orderButton"
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%20AirData%20GH%2C%20I%20need%20assistance.`}
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

                <p>
                  Choose how your dashboard looks.
                </p>

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

      <InScopeAI />
    </main>
  );
}
