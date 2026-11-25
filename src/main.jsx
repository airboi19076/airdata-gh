
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CustomerAuth from './CustomerAuth.jsx';
import './index.css';

const isAdminPage = window.location.pathname === '/admin';

// Disable the old AirData GH PWA service worker.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations =
        await navigator.serviceWorker.getRegistrations();

      await Promise.all(
        registrations.map(registration => registration.unregister())
      );

      await caches.delete('airdata-gh-v1');
    } catch (error) {
      console.error('Could not disable old PWA:', error);
    }
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
