import { authClient } from "./auth-client";
import React, { useState } from "react";

export default function DashboardMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
  { icon: "⌂", label: "Home", link: "/?page=dashboard" },
  { icon: "▦", label: "Dashboard", link: "/?page=dashboard" },
  { icon: "＋", label: "Top Up / Deposit", link: "/?page=deposit" },
  { icon: "◉", label: "Buy Data Bundles", link: "/?page=buy-data" },
  { icon: "▤", label: "My Transactions", link: "/?page=transactions" },
  { icon: "♙", label: "My Profile", link: "/?page=profile" },
  { icon: "☏", label: "Customer Support", link: "/?page=support" },
  { icon: "⚙", label: "Settings", link: "/?page=settings" }
];

  return (
    <>
      <style>{`
        .ad-menu-button {
          position: fixed;
          top: 18px;
          left: 18px;
          z-index: 1002;
          width: 48px;
          height: 48px;
          border: 1px solid #263750;
          border-radius: 12px;
          background: #111b2d;
          color: white;
          font-size: 25px;
          cursor: pointer;
          box-shadow: 0 5px 20px #0005;
        }

        .ad-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0,0,0,.65);
          opacity: 0;
          visibility: hidden;
          transition: .3s ease;
        }

        .ad-menu-overlay.open {
          opacity: 1;
          visibility: visible;
        }

        .ad-sidebar {
          position: fixed;
          z-index: 1001;
          top: 0;
          left: 0;
          height: 100%;
          width: min(300px, 85vw);
          background: #0b1424;
          border-right: 1px solid #263750;
          padding: 22px 16px;
          box-sizing: border-box;
          transform: translateX(-105%);
          transition: transform .3s ease;
          overflow-y: auto;
          color: white;
        }

        .ad-sidebar.open {
          transform: translateX(0);
        }

        .ad-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 22px;
          border-bottom: 1px solid #263750;
          margin-bottom: 20px;
        }

        .ad-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: bold;
          font-size: 19px;
        }

        .ad-logo-mark {
          background: #0284c7;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 21px;
        }

        .ad-close {
          border: 0;
          background: transparent;
          color: white;
          font-size: 27px;
          cursor: pointer;
        }

        .ad-menu-label {
          color: #64748b;
          font-size: 11px;
          letter-spacing: 2px;
          margin: 15px 10px;
        }

        .ad-menu-item {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 13px;
          margin-bottom: 5px;
          border-radius: 10px;
          color: #cbd5e1;
          text-decoration: none;
          font-size: 14px;
          box-sizing: border-box;
          transition: .2s;
        }

        .ad-menu-item:hover,
        .ad-menu-item:focus {
          background: #123454;
          color: #38bdf8;
        }

        .ad-menu-icon {
          width: 24px;
          text-align: center;
          font-size: 20px;
        }

        .ad-menu-footer {
          border-top: 1px solid #263750;
          margin-top: 22px;
          padding-top: 15px;
        }

        .ad-logout {
          color: #fb7185;
        }

        @media (min-width: 900px) {
          .ad-menu-button {
            top: 22px;
            left: 24px;
          }
        }
      `}</style>

      <button
        className="ad-menu-button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        ☰
      </button>

      <div
        className={`ad-menu-overlay ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`ad-sidebar ${isOpen ? "open" : ""}`}>
        <div className="ad-menu-header">
          <div className="ad-logo">
            <div className="ad-logo-mark">AD</div>
            <div>
              AirData GH
              <div style={{
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: "normal"
              }}>
                Your data, your way
              </div>
            </div>
          </div>

          <button
            className="ad-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="ad-menu-label">MAIN MENU</div>

        {menuItems.map((item) => (
          <a
            key={item.label}
            className="ad-menu-item"
            href={item.link}
onClick={event => {
  event.preventDefault();
  window.history.pushState({}, '', item.link);
  window.dispatchEvent(new PopStateEvent('popstate'));
  setIsOpen(false);
}}
            <span className="ad-menu-icon">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}

        <div className="ad-menu-footer">
          <a
  href="#logout"
  className="ad-menu-item ad-logout"
  onClick={async (e) => {
    e.preventDefault();
    await authClient.signOut();
    window.location.href = "/";
  }}
>
            <span className="ad-menu-icon">⇥</span>
            <span>Logout</span>
          </a>
          <div style={{
            color: "#64748b",
            fontSize: 11,
            textAlign: "center",
            padding: 12
          }}>
            © 2026 AirData GH
          </div>
        </div>
      </aside>
    </>
  );
}
