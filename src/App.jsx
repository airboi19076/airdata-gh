import React, { useState } from 'react';

const bundles = [
  ['1GB', '4.50'], ['2GB', '8.80'], ['3GB', '12.90'],
  ['4GB', '16.80'], ['5GB', '20.50'], ['6GB', '24.00'],
  ['7GB', '27.30'], ['8GB', '30.40'], ['10GB', '35.00'],
  ['15GB', '52.50'], ['20GB', '70.00'], ['25GB', '87.50'],
  ['30GB', '105.00'], ['40GB', '140.00'], ['50GB', '175.00'],
  ['100GB', '350.00'], ['300GB', '1050.00'], ['1TB', '3500.00']
];

export default function App() {
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

  return (
    <main>
      <header>
        <h1>AirData <span>GH</span></h1>
        <p>Your connection. Our priority.</p>
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

      <footer>
        <h2>AirData GH</h2>
        <p>Affordable data. Reliable service.</p>
        <p>WhatsApp: 0548 206 175</p>
        <small>© 2026 AirData GH. All rights reserved.</small>
      </footer>
    </main>
  );
}
