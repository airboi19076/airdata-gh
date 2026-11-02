import React, { useState } from 'react';
import { authClient } from './auth-client';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setMessage(
        'Login successful. Verifying administrator permissions...'
      );
    } catch (error) {
      setMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080d18',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111b2d',
        padding: '35px',
        borderRadius: '18px',
        border: '1px solid #263750'
      }}>
        <h1 style={{ textAlign: 'center', color: '#38bdf8' }}>
          AD
        </h1>

        <h2 style={{ textAlign: 'center' }}>
          Admin Portal
        </h2>

        <p style={{
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          AirData GH Management System
        </p>

        <form onSubmit={handleLogin}>
          <label>Administrator Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter admin email"
            required
            style={fieldStyle}
          />

          <label>Administrator Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            style={fieldStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? 'Please wait...' : 'Secure Admin Login'}
          </button>
        </form>

        {message && (
          <p style={{ color: '#38bdf8', textAlign: 'center' }}>
            {message}
          </p>
        )}

        <p style={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: '12px',
          marginTop: '25px'
        }}>
          © 2026 AirData GH. Restricted Access.
        </p>
      </div>
    </div>
  );
}

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px',
  margin: '10px 0 20px',
  borderRadius: '8px',
  border: '1px solid #334155',
  background: '#080d18',
  color: '#ffffff'
};

const buttonStyle = {
  width: '100%',
  padding: '15px',
  border: 'none',
  borderRadius: '8px',
  background: '#0284c7',
  color: '#ffffff',
  fontWeight: 'bold',
  cursor: 'pointer'
};
