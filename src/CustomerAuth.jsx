
import React, { useEffect, useState } from 'react';
import { authClient } from './auth-client';

export default function CustomerAuth({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
const [guestMode, setGuestMode] = useState(
  () => sessionStorage.getItem('airdata-guest-mode') === 'true'
);

function enterGuestMode() {
  sessionStorage.setItem('airdata-guest-mode', 'true');
  setGuestMode(true);
}

function exitGuestMode() {
  sessionStorage.removeItem('airdata-guest-mode');
  setGuestMode(false);
  setMessage('');
  setMode('login');
}
  
  useEffect(() => {
    async function checkSession() {
      try {
        const result = await authClient.getSession();

        if (result.error) {
          throw new Error(result.error.message);
        }

        setUser(
          result.data?.user ||
          result.data?.session?.user ||
          null
        );
      } catch (error) {
        setMessage(error.message || 'Unable to check your account.');
      } finally {
        setChecking(false);
      }
    }

    checkSession();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setMessage('');

    if (mode === 'signup') {
      if (password.length < 8) {
        setMessage('Your password must contain at least 8 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setMessage('Your passwords do not match.');
        return;
      }

      if (!name.trim()) {
        setMessage('Please enter your full name.');
        return;
      }
    }

    setLoading(true);

    try {
      const result = mode === 'signup'
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password
          })
        : await authClient.signIn.email({
            email: email.trim().toLowerCase(),
            password
          });

      if (result.error) {
        throw new Error(result.error.message);
      }

      let signedInUser =
        result.data?.user ||
        result.data?.session?.user ||
        null;

      if (!signedInUser) {
        const session = await authClient.getSession();

        signedInUser =
          session.data?.user ||
          session.data?.session?.user ||
          null;
      }

      if (signedInUser) {
        setUser(signedInUser);
        setPassword('');
        setConfirmPassword('');
      } else {
        setMessage(
          mode === 'signup'
            ? 'Account created. Please sign in.'
            : 'Login completed, but your session could not be loaded. Please try again.'
        );

        if (mode === 'signup') {
          setMode('login');
        }
      }
    } catch (error) {
      setMessage(error.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await authClient.signOut();
      setUser(null);
      setPassword('');
      setMode('login');
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Could not sign out.');
    }
  }

  if (checking) {
    return (
      <div className="customer-auth-loading">
        <div className="customer-auth-spinner" />
        <p>Checking your AirData GH account...</p>
        <style>{`
          .customer-auth-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 15px;
            background: #071426;
            color: white;
            font-family: Inter, Arial, sans-serif;
          }
          .customer-auth-spinner {
            width: 38px;
            height: 38px;
            border: 3px solid #ffffff30;
            border-top-color: #36c8ff;
            border-radius: 50%;
            animation: customerSpin .8s linear infinite;
          }
          @keyframes customerSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (user) {
    return (
      <>
        <div className="customer-account-bar">
          <span>
            Signed in as <strong>{user.name || user.email}</strong>
          </span>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
        {children}

        <style>{`
          .customer-account-bar {
            position: relative;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 6%;
            background: #071a36;
            color: #d8eaff;
            font: 12px Inter, Arial, sans-serif;
          }
          .customer-account-bar strong {
            color: #55d4ff;
          }
          .customer-account-bar button {
            border: 1px solid #ffffff35;
            border-radius: 9px;
            padding: 8px 13px;
            background: #ffffff12;
            color: white;
            font-weight: 800;
          }
        `}</style>
      </>
    );
  }
  if (guestMode) {
    return (
      <>
        <div style={{
          position: 'relative',
          zIndex: 30,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 6%',
          background: '#071a36',
          color: '#d8eaff',
          fontSize: '12px'
        }}>
          <span>
            Browsing as <strong style={{color: '#55d4ff'}}>Guest</strong>
          </span>

          <button
            onClick={exitGuestMode}
            style={{
              padding: '9px 13px',
              border: '1px solid #ffffff35',
              borderRadius: '9px',
              background: '#ffffff12',
              color: 'white',
              fontWeight: 800
            }}
          >
            Exit Guest Mode
          </button>
        </div>

        {children}
      </>
    );
  }
  
  return (
    <main className="customer-auth-page">
      <style>{`
        .customer-auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 25px 17px;
          background:
            radial-gradient(circle at 50% 10%, #10569a88, transparent 40%),
            linear-gradient(145deg, #020817, #071d3c);
          color: white;
          font-family: Inter, Arial, sans-serif;
        }
        .customer-auth-card {
          width: min(440px, 100%);
          padding: 30px 25px;
          border: 1px solid #ffffff20;
          border-radius: 23px;
          background: #10243bd9;
          box-shadow: 0 25px 70px #0006;
        }
        .customer-auth-brand {
          text-align: center;
          margin-bottom: 27px;
        }
        .customer-auth-logo {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          margin: 0 auto 13px;
          border: 1px solid #38c7ff;
          border-radius: 19px;
          background: linear-gradient(135deg, #087cff, #06366d);
          box-shadow: 0 0 25px #087cff66;
          font-size: 25px;
          font-weight: 950;
        }
        .customer-auth-brand h1 {
          font-size: 23px;
          font-weight: 950;
          letter-spacing: 1px;
        }
        .customer-auth-brand h1 span {
          color: #38c7ff;
        }
        .customer-auth-brand p {
          margin-top: 8px;
          color: #a9c5e2;
          font-size: 12px;
        }
        .customer-auth-card h2 {
          margin-bottom: 8px;
          font-size: 25px;
        }
        .customer-auth-description {
          margin-bottom: 20px;
          color: #a9c5e2;
          font-size: 13px;
          line-height: 1.7;
        }
        .customer-auth-card label {
          display: block;
          margin: 16px 0 8px;
          font-size: 12px;
          font-weight: 800;
        }
        .customer-auth-card input {
          width: 100%;
          padding: 14px;
          border: 1px solid #34516f;
          border-radius: 11px;
          outline: none;
          background: #081a30;
          color: white;
          font-size: 14px;
        }
        .customer-auth-card input:focus {
          border-color: #36c8ff;
          box-shadow: 0 0 0 3px #36c8ff20;
        }
        .customer-auth-submit {
          width: 100%;
          margin-top: 23px;
          padding: 15px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(105deg, #087cff, #0755c7);
          color: white;
          font-weight: 900;
          font-size: 14px;
        }
        .customer-auth-submit:disabled {
          opacity: .6;
        }
        .customer-auth-switch {
          margin-top: 20px;
          text-align: center;
          color: #a9c5e2;
          font-size: 12px;
        }
        .customer-auth-switch button {
          border: 0;
          background: none;
          color: #50d5ff;
          font-weight: 900;
        }
        .customer-auth-message {
          padding: 12px;
          margin-top: 15px;
          border-radius: 10px;
          background: #6b2838;
          color: #ffe0e7;
          font-size: 12px;
          line-height: 1.6;
        }
      `}</style>

      <section className="customer-auth-card">
        <div className="customer-auth-brand">
          <div className="customer-auth-logo">AD</div>
          <h1>AIRDATA <span>GH</span></h1>
          <p>YOUR CONNECTION. OUR PRIORITY.</p>
        </div>

        <h2>
          {mode === 'login' ? 'Welcome back!' : 'Create your account'}
        </h2>

        <p className="customer-auth-description">
          {mode === 'login'
            ? 'Sign in to access your AirData GH account.'
            : 'Join AirData GH and enjoy convenient data bundle purchases.'}
        </p>

                <div className="customer-social-buttons">
          <button
            type="button"
            className="customer-social-button"
            onClick={() => handleSocialSignIn('google')}
            disabled={loading}
          >
            <span className="customer-social-icon">G</span>
            Continue with Google
          </button>

          <button
            type="button"
            className="customer-social-button"
            disabled
            title="Apple sign-in setup is required"
          >
            <span className="customer-social-icon"></span>
            Continue with Apple
          </button>
        </div>

        <p className="customer-social-note">
          Apple sign-in requires additional setup.
        </p>

        <div className="customer-social-divider">
          OR CONTINUE WITH EMAIL
        </div>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                required
              />
            </>
          )}

          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            minLength={8}
            required
          />

          {mode === 'signup' && (
            <>
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </>
          )}

          {message && (
            <div className="customer-auth-message" role="alert">
              {message}
            </div>
          )}

          <button
            className="customer-auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'PLEASE WAIT...'
              : mode === 'login'
                ? 'SIGN IN'
                : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="customer-auth-switch">
          {mode === 'login'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setMessage('');
            }}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
                {mode === 'login' && (
          <button
            type="button"
            onClick={enterGuestMode}
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '15px',
              border: '1px solid #38c7ff',
              borderRadius: '12px',
              background: '#ffffff0d',
              color: '#55d4ff',
              fontSize: '14px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            CONTINUE AS GUEST →
          </button>
        )}
      </section>
    </main>
  );
}
