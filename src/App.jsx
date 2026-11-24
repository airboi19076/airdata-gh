
import React, { useEffect, useState } from 'react';
import InScopeAI from './InScopeAI';
import Admin from './Admin';
import { authClient } from './auth-client';

const WHATSAPP_NUMBER = '233548206175';

const networkBundles = {
  MTN: [
  ['1GB', '4.95'], ['2GB', '9.90'], ['3GB', '14.85'],
  ['4GB', '19.80'], ['5GB', '24.75'], ['6GB', '29.70'],
  ['8GB', '39.60'], ['10GB', '49.50'], ['15GB', '74.25'],
  ['20GB', '99.00'], ['25GB', '123.75'], ['30GB', '148.50'],
  ['40GB', '198.00'], ['50GB', '247.50']
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

const navigation = [
  { page: 'dashboard', icon: '⌂', label: 'Home' },
  { page: 'buy-data', icon: '▤', label: 'Buy Data' },
  { page: 'digital-services', icon: '✦', label: 'Services' },
  { page: 'support', icon: '◉', label: 'Support' },
  { page: 'settings', icon: '⚙', label: 'Settings' }
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [customerUser, setCustomerUser] = useState(null);
  const [page, setPage] = useState(
    new URLSearchParams(window.location.search).get('page') || 'dashboard'
  );

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('airdata-theme') === 'dark'
  );

  const [network, setNetwork] = useState('MTN');
  const [selected, setSelected] = useState(networkBundles.MTN[0]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [reference, setReference] = useState('');
  const [replacementStatus, setReplacementStatus] = useState('');

    const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [replacementBusyRef, setReplacementBusyRef] = useState('');
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

  const bundles = networkBundles[network] || networkBundles.MTN;
  const activeBundle =
    bundles.find(item => item[0] === selected[0]) || bundles[0];

  const selectedChecker =
    checkerServices.find(item => item.name === checkerType) ||
    checkerServices[0];

  const checkerTotal = selectedChecker.price * Number(checkerQuantity);

useEffect(() => {
  let active = true;

  async function loadCustomerAccount() {
    try {
      const result = await authClient.getSession();

      if (!active || result.error) return;

      setCustomerUser(
        result.data?.user ||
        result.data?.session?.user ||
        null
      );
    } catch {
      if (active) setCustomerUser(null);
    }
  }

  loadCustomerAccount();

  return () => {
    active = false;
  };
}, []);

  
async function getCustomerAccessToken() {
  const response = await fetch(
    'https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth/token',
    {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    }
  );

  const data = await response.json();
  const token = data?.token;

  if (
    !response.ok ||
    typeof token !== 'string' ||
    token.split('.').length !== 3
  ) {
    throw new Error('Please sign in again to view your orders.');
  }

  return token;
}

async function loadCustomerOrders() {
  if (!customerUser) {
    setCustomerOrders([]);
    setOrdersError('Sign in to view your orders.');
    return;
  }

  setOrdersLoading(true);
  setOrdersError('');

  try {
    const token = await getCustomerAccessToken();

    const response = await fetch('/api/checkout/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not load your orders.');
    }

    setCustomerOrders(
      Array.isArray(result.orders) ? result.orders : []
    );
  } catch (error) {
    setOrdersError(error.message || 'Could not load your orders.');
  } finally {
    setOrdersLoading(false);
  }
}

useEffect(() => {
  if (page === 'orders' && customerUser) {
    loadCustomerOrders();
  }
}, [page, customerUser?.id]);

const visibleOrders = customerOrders.filter(order => {
  const status = String(
    order.supplier_status || order.status || ''
  ).toLowerCase();

  if (ordersFilter === 'processing') {
    return !['completed', 'failed', 'refunded'].includes(status);
  }

  if (ordersFilter === 'delivered') {
    return status === 'completed';
  }

  if (ordersFilter === 'failed') {
    return ['failed', 'refunded'].includes(status);
  }

  return true;
});

function maskRecipient(value) {
  const digits = String(value || '');

  return digits.length >= 10
    ? `${digits.slice(0, 3)}••••${digits.slice(-3)}`
    : 'Not available';
}

async function requestOrderReplacement(orderReference) {
  if (!customerUser || replacementBusyRef) return;

  setReplacementBusyRef(orderReference);
  setOrdersError('');

  try {
    const token = await getCustomerAccessToken();

    const response = await fetch('/api/checkout/replace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reference: orderReference })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Replacement request failed.');
    }

    await loadCustomerOrders();
  } catch (error) {
    setOrdersError(
      error.message || 'Unable to request a free replacement.'
    );
  } finally {
    setReplacementBusyRef('');
  }
}

const visibleNavigation = customerUser
  ? [
      navigation[0],
      navigation[1],
      { page: 'orders', icon: '▣', label: 'Orders' },
      navigation[3],
      navigation[4]
    ]
  : navigation;

const customerFirstName =
  String(customerUser?.name || '').trim().split(/\s+/)[0] || 'there';
  
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('airdata-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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

  useEffect(() => {
    if (
      !reference ||
      !['pending', 'processing', 'awaiting_payment', 'submitting'].includes(orderStatus)
    ) return;

    checkOrderStatus(true);
    const timer = setInterval(() => checkOrderStatus(true), 15000);
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Enter a valid email address for your Paystack payment.');
      setOrderStatus('error');
      return;
    }

    setLoading(true);
    setMessage('Preparing your secure payment...');
    setOrderStatus('pending');

    try {
            const checkoutHeaders = {
        'Content-Type': 'application/json'
      };

      if (customerUser) {
        checkoutHeaders.Authorization =
          `Bearer ${await getCustomerAccessToken()}`;
      }

      const response = await fetch('/api/checkout/initialize', {
        method: 'POST',
        headers: checkoutHeaders,
        body: JSON.stringify({
          network,
          volume_gb: Number.parseInt(selected[0], 10),
          recipient: phone,
          email: email.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to initialize payment.');
      }

      if (!result.payment_url || !result.reference) {
        throw new Error('Payment provider did not return a valid payment link.');
      }

      setReference(result.reference);
            setOrderStatus('awaiting_payment');
      setMessage('Your order has been created. Redirecting to payment...');
      setShowOrderModal(false);
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
      setReplacementStatus(result.replacement_status || '');

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
        setMessage(error.message || 'Unable to check your order status.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

    
    async function requestReplacement() {
      if (!reference || loading) return;

      if (!customerUser) {
        setMessage('Please sign in to request a free replacement.');
        setOrderStatus('error');
        return;
      }

      setLoading(true);
      setMessage('Submitting your free replacement request...');

      try {
        const token = await getCustomerAccessToken();

        if (!token) {
          throw new Error('Please sign in again to continue.');
        }

        const response = await fetch('/api/checkout/replace', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reference })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Replacement request failed.');
        }

        setMessage(data.message || 'Your replacement request was submitted successfully.');
        setOrderStatus('success');
      } catch (error) {
        setMessage(error.message || 'Unable to submit replacement request.');
        setOrderStatus('error');
      } finally {
        setLoading(false);
      }
    }


  function updateAfa(field, value) {
    setAfaForm(previous => ({ ...previous, [field]: value }));
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
          padding-bottom: 105px;
          background: #f4f7fc;
          color: #10213b;
          transition: background .3s, color .3s;
        }

        .dark-mode {
          background: #071426;
          color: #edf5ff;
        }

        .topbar {
          position: relative;
          z-index: 10;
          min-height: 72px;
          padding: 17px 6%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          color: white;
          background: rgba(5, 20, 43, .97);
          border-bottom: 1px solid #ffffff15;
          box-shadow: 0 8px 30px #06152b20;
        }

        .brand {
          font-size: 23px;
          font-weight: 950;
          letter-spacing: -1px;
        }

        .brand span { color: #38c7ff; }

        .theme-button {
          width: 42px;
          height: 42px;
          border: 1px solid #ffffff24;
          border-radius: 13px;
          color: white;
          background: #ffffff10;
          font-size: 18px;
          cursor: pointer;
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

        .bundle-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
          gap: 13px;
          margin: 18px 0;
        }

        .bundle-card {
          padding: 17px 13px;
          border: 1px solid #dce6f2;
          border-radius: 17px;
          text-align: center;
          background: #f8faff;
        }

        .bundle-card strong {
          display: block;
          font-size: 22px;
          color: #14243d;
        }

        .bundle-card-price {
          display: block;
          margin: 8px 0 13px;
          color: #087cff;
          font-weight: 900;
        }

        .bundle-card button {
          width: 100%;
          padding: 11px 8px;
          border: 0;
          border-radius: 11px;
          color: white;
          background: linear-gradient(110deg, #087cff, #0754c7);
          font-weight: 850;
          cursor: pointer;
        }

        .network-mark {
          display: inline-grid;
          place-items: center;
          min-width: 34px;
          height: 27px;
          padding: 0 7px;
          margin-right: 8px;
          border-radius: 7px;
          color: #10213b;
          background: #ffd500;
          font-size: 11px;
          font-weight: 950;
        }

        .network-logo {
  width: 75px;
  height: 42px;
  object-fit: contain;
  display: block;
  margin: 0 auto 8px;
}

        .order-overlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: #031126c9;
        }

        .order-modal {
          width: min(470px, 100%);
          max-height: 90vh;
          overflow: auto;
          padding: 25px;
          border-radius: 22px;
          background: white;
          color: #14243d;
          box-shadow: 0 25px 80px #0005;
        }

        .order-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .order-close {
          border: 0;
          background: #edf3fa;
          border-radius: 10px;
          padding: 9px 13px;
          font-size: 18px;
        }

        .dark-mode .bundle-card {
          background: #10233b;
          border-color: #294766;
        }

        .dark-mode .bundle-card strong {
          color: #edf5ff;
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


        .orders-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .orders-eyebrow {
          margin: 0 0 7px;
          color: #168bff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .orders-refresh {
          border: 1px solid #cbd9eb;
          border-radius: 11px;
          padding: 10px 13px;
          color: #1269c8;
          background: #f4f8ff;
          font-weight: 800;
        }

        .orders-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 22px 0;
        }

        .orders-summary div {
          padding: 15px 10px;
          border: 1px solid #dce6f2;
          border-radius: 14px;
          background: #f7faff;
          text-align: center;
        }

        .orders-summary strong,
        .orders-summary span {
          display: block;
        }

        .orders-summary strong {
          font-size: 23px;
          color: #087cff;
        }

        .orders-summary span {
          margin-top: 4px;
          color: #71839b;
          font-size: 11px;
          font-weight: 750;
        }

        .orders-filters {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 3px 0 13px;
        }

        .orders-filters button {
          flex: 0 0 auto;
          border: 1px solid #dce6f2;
          border-radius: 20px;
          padding: 9px 14px;
          background: #f8faff;
          color: #526780;
          font-weight: 800;
        }

        .orders-filters button.active {
          background: #087cff;
          border-color: #087cff;
          color: white;
        }

        .orders-empty {
          padding: 28px 12px;
          text-align: center;
          color: #71839b;
        }

        .orders-list {
          display: grid;
          gap: 13px;
        }

        .customer-order-card {
          padding: 18px;
          border: 1px solid #dce6f2;
          border-radius: 17px;
          background: #fbfdff;
        }

        .customer-order-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .customer-order-top strong,
        .customer-order-top span {
          display: block;
        }

        .customer-order-top strong {
          color: #14243d;
          font-size: 16px;
        }

        .customer-order-top div span {
          margin-top: 5px;
          color: #71839b;
          font-size: 13px;
        }

        .order-status-pill {
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 900;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .order-status-pill.delivered {
          background: #e3f8ed;
          color: #167346;
        }

        .order-status-pill.failed {
          background: #ffeded;
          color: #b42318;
        }

        .order-status-pill.processing {
          background: #eaf3ff;
          color: #1765b7;
        }

        .customer-order-amount {
          margin: 15px 0;
          color: #087cff;
          font-size: 22px;
          font-weight: 950;
        }

        .customer-order-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .customer-order-details span {
          color: #71839b;
          font-size: 11px;
        }

        .customer-order-details strong {
          display: block;
          margin-top: 4px;
          color: #263c58;
          font-size: 12px;
          overflow-wrap: anywhere;
          text-transform: capitalize;
        }

        .replacement-note {
          color: #167346;
          font-size: 12px;
          font-weight: 800;
        }

        .replacement-button {
          width: 100%;
          margin-top: 15px;
          padding: 13px;
          border: 0;
          border-radius: 12px;
          color: white;
          background: linear-gradient(110deg, #087cff, #0754c7);
          font-weight: 900;
        }

        .replacement-button:disabled,
        .orders-refresh:disabled {
          opacity: .6;
        }

        .orders-footnote {
          margin-top: 18px;
          color: #8392a6;
          font-size: 11px;
          line-height: 1.6;
        }

        .dark-mode .orders-summary div,
        .dark-mode .customer-order-card {
          background: #10233b;
          border-color: #294766;
        }

        .dark-mode .customer-order-top strong,
        .dark-mode .customer-order-details strong {
          color: #edf5ff;
        }

        .dark-mode .orders-filters button {
          background: #10233b;
          border-color: #294766;
          color: #b9cce2;
        }

        .dark-mode .orders-filters button.active {
          background: #087cff;
          color: white;
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

        .dashboard {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 34px 24px 60px;
        }

        .dash-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 28px;
        }

        .dash-eyebrow {
          color: #168bff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .dash-heading h1 {
          margin: 8px 0;
          font-size: clamp(27px, 4vw, 39px);
          letter-spacing: -1.5px;
          font-weight: 950;
        }

        .dash-heading p {
          margin: 0;
          color: #8292a8;
          font-size: 14px;
        }

       
        .dash-hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  align-items: center;
  gap: 28px;
  min-height: 340px;
  padding: 42px;
  border: 1px solid #238bdb55;
  border-radius: 30px;
  color: white;
  background:
    radial-gradient(circle at 80% 30%, #22c5ff45, transparent 35%),
    radial-gradient(circle at 10% 100%, #0878d955, transparent 40%),
    linear-gradient(125deg, #041126, #073d79 65%, #087fc5);
  box-shadow: 0 24px 65px #0755a533;
  overflow: hidden;
}

.dash-hero-copy {
  position: relative;
  z-index: 2;
}

.dash-hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid #8edcff45;
  border-radius: 30px;
  color: #a9e7ff;
  background: #ffffff12;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.dash-hero h2 {
  max-width: 520px;
  margin: 20px 0 13px;
  font-size: clamp(32px, 4.5vw, 49px);
  line-height: 1.08;
  letter-spacing: -2px;
  font-weight: 950;
}

.dash-hero p {
  max-width: 440px;
  color: #d5eaff;
  line-height: 1.8;
  font-size: 14px;
}

.dash-hero .primary {
  width: auto;
  min-width: 185px;
  margin-top: 12px;
  padding: 16px 24px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(110deg, #ffffff, #c9efff);
  color: #0755a5;
  font-weight: 900;
  box-shadow: 0 10px 30px #00152d55;
}

.dash-hero-visual {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 245px;
}

.dash-visual-orbit {
  position: absolute;
  width: 230px;
  height: 230px;
  border: 1px solid #8edcff55;
  border-radius: 50%;
  box-shadow: 0 0 45px #20bfff22;
}

.dash-visual-orbit::before,
.dash-visual-orbit::after {
  content: "";
  position: absolute;
  border: 1px solid #8edcff35;
  border-radius: 50%;
}

.dash-visual-orbit::before {
  inset: 20px;
}

.dash-visual-orbit::after {
  inset: 42px;
}

.dash-visual-card {
  position: relative;
  z-index: 1;
  width: min(245px, 100%);
  padding: 23px;
  border: 1px solid #ffffff45;
  border-radius: 23px;
  background: linear-gradient(145deg, #ffffff2b, #ffffff0c);
  box-shadow: 0 20px 50px #00152d66;
  backdrop-filter: blur(15px);
  transform: rotate(-5deg);
}

.dash-visual-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #bceaff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.dash-visual-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  margin: 22px 0 13px;
  border-radius: 14px;
  color: white;
  background: linear-gradient(135deg, #18bfff, #0873db);
  font-size: 23px;
  box-shadow: 0 8px 25px #00aaff55;
}

.dash-visual-number {
  color: white;
  font-size: 32px;
  font-weight: 950;
  letter-spacing: -1px;
}

.dash-visual-caption {
  margin-top: 4px;
  color: #c9eaff;
  font-size: 12px;
}

.dash-visual-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px solid #ffffff35;
  color: #bceaff;
  font-size: 11px;
  font-weight: 800;
}

        .dash-highlight strong {
          display: block;
          margin-bottom: 5px;
          font-size: 14px;
        }

        .dash-highlight span {
          color: #d1e8ff;
          font-size: 12px;
        }

        .dash-section { margin-top: 35px; }

        .dash-section-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 12px;
          margin-bottom: 17px;
        }

        .dash-section-head h2 {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -.7px;
        }

        .dash-section-head p {
          margin: 0;
          color: #8292a8;
          font-size: 13px;
        }

        .dash-networks {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

               .dash-network {
          position: relative;
          min-height: 165px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          text-align: left;
          border: 1px solid #e3ebf6;
          border-radius: 22px;
          background: linear-gradient(145deg, #ffffff, #f4f8ff);
          color: #14243d;
          cursor: pointer;
          overflow: hidden;
          transition: all .28s ease;
          box-shadow: 0 8px 24px rgba(20, 50, 90, .07);
        }

        .dash-network::after {
          content: '';
          position: absolute;
          width: 110px;
          height: 110px;
          right: -45px;
          top: -45px;
          border-radius: 50%;
          background: rgba(22, 139, 255, .06);
        }

        .dash-network:hover {
          transform: translateY(-6px);
          border-color: #168bff;
          box-shadow: 0 16px 34px rgba(22, 139, 255, .15);
        }

        .dash-network-logo-wrap {
          width: 112px;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          padding: 7px 12px;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(20, 50, 90, .07);
          z-index: 1;
        }

        .dash-network-logo-wrap.mtn-logo-bg {
          background: #ffcc00;
        }

        .dash-network-logo {
          display: block;
          max-width: 100%;
          max-height: 42px;
          width: auto;
          height: auto;
          object-fit: contain;
        }

        .dash-network strong,
        .dash-network span {
          display: block;
          z-index: 1;
        }

        .dash-network strong {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.3px;
        }

        .dash-network span {
          margin-top: 6px;
          color: #8292a8;
          font-size: 12px;
        }

        .dash-shortcuts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .dash-shortcut {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 19px;
          text-align: left;
          border: 1px solid #e1eaf5;
          border-radius: 18px;
          background: white;
          color: #14243d;
          cursor: pointer;
        }

        .dash-shortcut-icon {
          flex-shrink: 0;
          margin: 0;
        }

        .dash-shortcut strong, .dash-shortcut span {
          display: block;
        }

        .dash-shortcut span {
          margin-top: 6px;
          color: #8292a8;
          font-size: 12px;
          line-height: 1.5;
        }

        .bottom-nav {
          position: fixed;
          z-index: 100;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          width: min(570px, calc(100% - 28px));
          min-height: 70px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
          padding: 8px 7px;
          border: 1px solid #dce7f5;
          border-radius: 22px;
          background: rgba(255, 255, 255, .96);
          box-shadow: 0 12px 40px rgba(4, 25, 55, .19);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .bottom-nav button {
          min-width: 0;
          min-height: 55px;
          padding: 5px 2px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 0;
          border-radius: 14px;
          color: #71839b;
          background: transparent;
          font-family: inherit;
          cursor: pointer;
          transition: .2s;
        }

        .bottom-nav button.active {
          color: #087cff;
          background: #eaf4ff;
        }

        .bottom-nav button:active { transform: scale(.94); }

        .bottom-nav .nav-icon {
          font-size: 21px;
          line-height: 1;
          font-weight: 900;
        }

        .bottom-nav .nav-label {
          font-size: 10px;
          line-height: 1.2;
          font-weight: 800;
          white-space: nowrap;
        }

        .dark-mode .bottom-nav {
          background: rgba(10, 29, 51, .97);
          border-color: #294766;
          box-shadow: 0 12px 40px #0007;
        }

        .dark-mode .bottom-nav button { color: #9eb1c8; }

        .dark-mode .bottom-nav button.active {
          color: #58baff;
          background: #17395c;
        }

        .dark-mode .panel {
          color: #edf5ff;
          background: #10233b;
          border-color: #294766;
        }

        .dark-mode .panel input,
        .dark-mode .panel select {
          color: #edf5ff;
          background: #0a1b30;
          border-color: #294766;
        }

        .dark-mode .dash-network,
        .dark-mode .dash-shortcut {
          color: #edf5ff;
          background: #10233b;
          border-color: #294766;
        }

        .dark-mode .price,
        .dark-mode .status {
          color: #d7eaff;
          background: #102d4b;
          border-color: #294766;
        }

        @media (max-width: 750px) {
          .dashboard { padding: 25px 15px 45px; }

          .dash-heading {
            align-items: flex-start;
            flex-direction: column;
          }

         .dash-hero {
  grid-template-columns: 1fr;
  padding: 29px 21px;
  gap: 10px;
  border-radius: 23px;
}

.dash-hero-visual {
  min-height: 245px;
  margin-top: 5px;
}

.dash-visual-orbit {
  width: 210px;
  height: 210px;
}

.dash-visual-card {
  width: 225px;
}

          .dash-networks {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .dash-network {
            min-height: 130px;
            padding: 15px;
          }

          .dash-shortcuts { grid-template-columns: 1fr; }
        }

        @media (max-width: 700px) {
          .topbar { padding: 15px 18px; }
          .brand { font-size: 21px; }

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

          .bottom-nav {
            bottom: max(10px, env(safe-area-inset-bottom));
            width: calc(100% - 20px);
            min-height: 68px;
            border-radius: 19px;
          }

          .bottom-nav button { min-height: 51px; }
          .bottom-nav .nav-icon { font-size: 20px; }
          .bottom-nav .nav-label { font-size: 9px; }

          main { padding-bottom: 100px; }
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
        </div>
      )}

      {!showSplash && (
        <>
          <header className="topbar">
            <div className="brand">AIRDATA <span>GH</span></div>
            <button
              className="theme-button"
              aria-label="Toggle theme"
              onClick={() => setDarkMode(value => !value)}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </header>

          {page === 'dashboard' && (
            <div className="dashboard">
              <div className="dash-heading">
                <div>
                  <div className="dash-eyebrow">WELCOME TO AIRDATA GH</div>
                  <h1>Your connection starts here.</h1>
                  <p>Simple, affordable and convenient digital services.</p>
                </div>
              </div>

             <section className="dash-hero">
  <div className="dash-hero-copy">
    <div className="dash-hero-tag">
      ✦ AIRDATA GH • STAY CONNECTED
    </div>

    <h2>
      Your data.
      <br />
      Your connection.
      <br />
      Your freedom.
    </h2>

    <p>
      Get your favourite data bundles from your preferred
      network with a simple and convenient checkout experience.
    </p>

    <button
      className="primary"
      onClick={() => navigate('buy-data')}
    >
      Buy Data Now →
    </button>
  </div>

  <div className="dash-hero-visual" aria-hidden="true">
    <div className="dash-visual-orbit"></div>

    <div className="dash-visual-card">
      <div className="dash-visual-top">
        <span>AIRDATA GH</span>
        <span>● ONLINE</span>
      </div>

      <div className="dash-visual-icon">📶</div>

      <div className="dash-visual-number">DATA</div>
      <div className="dash-visual-caption">
        Your connection starts here
      </div>

      <div className="dash-visual-bottom">
        <span>MTN • AT • TELECEL</span>
        <span>✦</span>
      </div>
    </div>
  </div>
</section>

                            {customerUser && (
                <section
                  style={{
                    margin: '22px 0 30px',
                    padding: '22px 25px',
                    borderRadius: 22,
                    border: '1px solid #168bff55',
                    background: darkMode
                      ? 'linear-gradient(120deg, #102b49, #0b1c32)'
                      : 'linear-gradient(120deg, #eaf5ff, #f8fbff)',
                    boxShadow: '0 12px 32px rgba(8, 85, 170, .09)'
                  }}
                >
                  <div style={{
                    color: '#168bff',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 1.4
                  }}>
                    YOUR DATA SPENDING
                  </div>

                  <div style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: darkMode ? '#b9cce2' : '#71839b'
                  }}>
                    Total amount spent on data purchases
                  </div>

                  <div style={{
                    marginTop: 7,
                    fontSize: 32,
                    fontWeight: 950,
                    color: darkMode ? '#ffffff' : '#10213b'
                  }}>
                    GH₵{(totalSpentPesewas / 100).toLocaleString(
                      'en-GH',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }
                    )}
                  </div>
                </section>
              )}
              <section className="dash-section">
                <div className="dash-section-head">
                  <div>
                    <h2>Choose your network</h2>
                    <p>Select a network to explore available bundles.</p>
                  </div>
                </div>

                              <div className="dash-networks">
                  {[
                    { name: 'MTN', description: 'MTN data bundles', logo: 'https://cdn.brandfetch.io/id-4xm-GCy/theme/dark/logo.svg' },
                    { name: 'AirtelTigo iShare', description: 'iShare bundles', logo: 'https://static.africa-press.net/ghana/sites/18/2023/06/sm_1687706784.824922.jpg' },
                    { name: 'AirtelTigo BigTime', description: 'BigTime bundles', logo: 'https://static.africa-press.net/ghana/sites/18/2023/06/sm_1687706784.824922.jpg' },
                    { name: 'Telecel', description: 'Telecel data bundles', logo: 'https://www.telecel.com.gh/img/Telecel-Icon-Red.png' }
                  ].map(item => (
                    <button
                      key={item.name}
                      className="dash-network"
                      onClick={() => {
                        changeNetwork(item.name);
                        navigate('buy-data');
                      }}
                    >
                      <div
                        className="dash-network-logo-wrap"
                        style={{
                          backgroundColor: item.name === 'MTN' ? '#ffcc00' : '#ffffff'
                        }}
                      >
                        <img
                          className="dash-network-logo"
                          src={item.logo}
                          alt={`${item.name} logo`}
                        />
                      </div>
                      <strong>{item.name}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="dash-section">
                <div className="dash-section-head">
                  <div>
                    <h2>More from AirData GH</h2>
                    <p>Explore other services and get assistance.</p>
                  </div>
                </div>

                <div className="dash-shortcuts">
                  <button
                    className="dash-shortcut"
                    onClick={() => navigate('digital-services')}
                  >
                    <div className="dash-shortcut-icon">✨</div>
                    <div>
                      <strong>Digital Services</strong>
                      <span>MTN AFA and examination results checkers</span>
                    </div>
                  </button>

                  <button
                    className="dash-shortcut"
                    onClick={() => navigate('support')}
                  >
                    <div className="dash-shortcut-icon">💬</div>
                    <div>
                      <strong>Customer Support</strong>
                      <span>Get help with your orders and payments</span>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          )}

     
          {page === 'buy-data' && (
            <div className="content">
              <section className="panel">
                <h2>Buy Data Bundles</h2>
                <p className="muted">
                  Choose your network and tap Buy Now on your preferred bundle.
                </p>

                <label>Select Network</label>
                <div className="network-grid">
                  {Object.keys(networkBundles).map(item => (
                    <button
                      key={item}
                      className={`network-button ${network === item ? 'active' : ''}`}
                      onClick={() => changeNetwork(item)}
                    >
                      <img
  className="network-logo"
  src={
    item === 'MTN'
      ? 'https://cdn.brandfetch.io/id-4xm-GCy/theme/dark/logo.svg'
      : item === 'Telecel'
        ? 'https://www.telecel.com.gh/img/Telecel-Icon-Red.png'
        : 'https://static.africa-press.net/ghana/sites/18/2023/06/sm_1687706784.824922.jpg'
  }
  alt={`${item} logo`}
/>
                      {item}
                    </button>
                  ))}
                </div>

                <label>Available Bundles</label>
                <div className="bundle-cards">
                  {bundles.map(bundle => (
                    <div className="bundle-card" key={`${network}-${bundle[0]}`}>
                      <strong>{bundle[0]}</strong>
                      <span className="bundle-card-price">
                        GH₵{bundle[1]}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(bundle);
                          setMessage('');
                          setOrderStatus('');
                          setShowOrderModal(true);
                        }}
                      >
                        Buy Now
                      </button>
                    </div>
                  ))}
                </div>

                {message && !showOrderModal && (
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
                                             {(orderStatus === 'failed' ||
                          orderStatus === 'refunded') &&
                          !replacementStatus && (
                            <button
                              className="primary"
                              onClick={requestReplacement}
                              disabled={loading}
                            >
                              {loading ? 'Please wait...' : 'Replace Order — FREE'}
                            </button>
                          )}

                        {replacementStatus && (
                          <p>
                            Replacement status: {replacementStatus}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <p className="muted">
                  Secure payment is handled by Paystack. Your order is processed
                  after payment confirmation.
                </p>
              </section>
            </div>
          )}

          {showOrderModal && (
            <div
              className="order-overlay"
              onClick={event => {
                if (event.target === event.currentTarget && !loading) {
                  setShowOrderModal(false);
                }
              }}
            >
              <section
                className="order-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Confirm data bundle"
              >
                <div className="order-modal-head">
                  <h2>Confirm Your Order</h2>
                  <button
                    className="order-close"
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    disabled={loading}
                  >
                    ×
                  </button>
                </div>

                <div className="price">
                  Network: <strong>{network}</strong><br />
                  Bundle: <strong>{selected[0]}</strong><br />
                  Total: <strong>GH₵{selected[1]}</strong>
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

                <label htmlFor="customer-email">
                  Email Address for Paystack Payment
                </label>
                <input
                  id="customer-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={event => {
                    setEmail(event.target.value);
                    setMessage('');
                  }}
                />

                <button
                  className="primary"
                  onClick={orderNow}
                  disabled={loading}
                >
                  {loading ? 'Please wait...' : `Pay GH₵${selected[1]} and Buy Data`}
                </button>

                {message && (
                  <div className="status" role="status">
                    <strong>
                      {orderStatus === 'error' ? 'Unable to Continue' : 'Order Update'}
                    </strong>
                    <p>{message}</p>
                  </div>
                )}
              </section>
            </div>
          )}


          {page === 'orders' && (
            <div className="content">
              <section className="panel orders-panel">
                <div className="orders-heading">
                  <div>
                    <p className="orders-eyebrow">YOUR ACCOUNT</p>
                    <h2>My Orders</h2>
                    <p className="muted">
                      Track your data bundle purchases and delivery updates.
                    </p>
                  </div>

                  <button
                    className="orders-refresh"
                    onClick={loadCustomerOrders}
                    disabled={ordersLoading}
                  >
                    {ordersLoading ? 'Loading…' : '↻ Refresh'}
                  </button>
                </div>

                {!customerUser ? (
                  <div className="orders-empty">
                    <h3>Sign in to view your orders</h3>
                    <p>
                      Your order history is private and only available
                      to the account used at checkout.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="orders-summary">
                      <div>
                        <strong>{customerOrders.length}</strong>
                        <span>Total orders</span>
                      </div>

                      <div>
                        <strong>
                          {customerOrders.filter(o =>
                            String(o.supplier_status || o.status)
                              .toLowerCase() === 'completed'
                          ).length}
                        </strong>
                        <span>Delivered</span>
                      </div>

                      <div>
                        <strong>
                          {customerOrders.filter(o =>
                            ['failed', 'refunded'].includes(
                              String(o.supplier_status || o.status)
                                .toLowerCase()
                            )
                          ).length}
                        </strong>
                        <span>Failed</span>
                      </div>
                    </div>

                    <div className="orders-filters">
                      {[
                        ['all', 'All'],
                        ['processing', 'Processing'],
                        ['delivered', 'Delivered'],
                        ['failed', 'Failed']
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          className={ordersFilter === value ? 'active' : ''}
                          onClick={() => setOrdersFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {ordersError && (
                      <div className="status" role="alert">
                        {ordersError}
                      </div>
                    )}

                    {ordersLoading && customerOrders.length === 0 ? (
                      <div className="orders-empty">
                        Loading your orders…
                      </div>
                    ) : visibleOrders.length === 0 ? (
                      <div className="orders-empty">
                        <h3>No orders to show</h3>
                        <p>
                          {customerOrders.length
                            ? 'There are no orders in this filter.'
                            : 'Your new purchases will appear here after checkout.'}
                        </p>
                        <button
                          className="primary"
                          onClick={() => navigate('buy-data')}
                        >
                          Buy Data
                        </button>
                      </div>
                    ) : (
                      <div className="orders-list">
                        {visibleOrders.map(order => {
                          const status = String(
                            order.supplier_status || order.status || 'processing'
                          ).toLowerCase();

                          const failed = ['failed', 'refunded'].includes(status);
                          const delivered = status === 'completed';

                          return (
                            <article
                              className="customer-order-card"
                              key={order.reference}
                            >
                              <div className="customer-order-top">
                                <div>
                                  <strong>{order.network}</strong>
                                  <span>
                                    {Number(order.volume_gb)}GB Data Bundle
                                  </span>
                                </div>

                                <span className={`order-status-pill ${
                                  delivered ? 'delivered' :
                                  failed ? 'failed' : 'processing'
                                }`}>
                                  {delivered
                                    ? 'Delivered'
                                    : failed
                                      ? status
                                      : 'Processing'}
                                </span>
                              </div>

                              <div className="customer-order-amount">
                                GH₵{(
                                  Number(order.retail_price_pesewas || 0) / 100
                                ).toFixed(2)}
                              </div>

                              <div className="customer-order-details">
                                <span>
                                  Recipient
                                  <strong>{maskRecipient(order.recipient)}</strong>
                                </span>

                                <span>
                                  Payment
                                  <strong>
                                    {String(order.payment_status || 'pending')
                                      .replace(/_/g, ' ')}
                                  </strong>
                                </span>

                                <span>
                                  Reference
                                  <strong>{order.reference}</strong>
                                </span>

                                <span>
                                  Date
                                  <strong>
                                    {order.created_at
                                      ? new Date(order.created_at).toLocaleString()
                                      : '—'}
                                  </strong>
                                </span>
                              </div>

                              {order.replacement_reference && (
                                <p className="replacement-note">
                                  Free replacement: {String(
                                    order.replacement_status || 'submitted'
                                  )}
                                </p>
                              )}

                              {failed && !order.replacement_reference && (
                                <button
                                  className="replacement-button"
                                  disabled={
                                    replacementBusyRef === order.reference
                                  }
                                  onClick={() =>
                                    requestOrderReplacement(order.reference)
                                  }
                                >
                                  {replacementBusyRef === order.reference
                                    ? 'Submitting…'
                                    : 'Replace Order — FREE'}
                                </button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}

                    <p className="orders-footnote">
                      Only purchases made while signed in appear here.
                      Earlier guest orders cannot be assigned automatically.
                    </p>
                  </>
                )}
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
                    <div className="price">
                      Registration request fee: <strong>GH₵15.00</strong>
                    </div>

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

                {serviceMessage && (
                  <div className="status">{serviceMessage}</div>
                )}
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
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    textDecoration: 'none'
                  }}
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
                <button
                  className="primary"
                  onClick={() => setDarkMode(value => !value)}
                >
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

          <nav className="bottom-nav" aria-label="Main navigation">
         {visibleNavigation.map(item => (
              <button
                key={item.page}
                className={page === item.page ? 'active' : ''}
                onClick={() => navigate(item.page)}
                aria-label={item.label}
                aria-current={page === item.page ? 'page' : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {!showSplash && <InScopeAI />}
    </main>
  );
}
