
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CustomerAuth from './CustomerAuth.jsx';
import './index.css';

const isAdminPage = window.location.pathname === '/admin';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(error => {
        console.error('AirData GH service worker error:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminPage ? (
      <App />
    ) : (
      <CustomerAuth>
        <App />
      </CustomerAuth>
    )}
  </React.StrictMode>
);
