
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
const [showChannelPrompt, setShowChannelPrompt] = useState(false);

const channelUrl = 'https://whatsapp.com/channel/0029VbE7DAs4Y9lwIZQcAU3b';
const supportUrl = 'https://wa.me/233548206175';

useEffect(() => {
  if (!user?.id) {
    setShowChannelPrompt(false);
    return;
  }

  const key = `airdata-channel-prompt-${user.id}`;
  if (sessionStorage.getItem(key) !== 'seen') {
    setShowChannelPrompt(true);
  }
}, [user?.id]);

function dismissChannelPrompt() {
  if (user?.id) {
    sessionStorage.setItem(`airdata-channel-prompt-${user.id}`, 'seen');
  }
  setShowChannelPrompt(false);
}
  
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
  async function handleSocialSignIn(provider) {
    if (loading) return;

    setLoading(true);
    setMessage('');

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin
      });

      if (result?.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      setMessage(
        error.message || `Could not continue with ${provider}.`
      );
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
        {showChannelPrompt && (
  <div className="channel-overlay">
    <section className="channel-modal" role="dialog" aria-modal="true">
      <div className="channel-header">
        <button className="channel-close" onClick={dismissChannelPrompt}>×</button>
        <div className="channel-icon">◉</div>
        <div className="channel-eyebrow">STAY CONNECTED</div>
        <h2>Join AirData GH on WhatsApp</h2>
      </div>

      <div className="channel-body">
        <p>
          Join our WhatsApp channel for data bundle price updates,
          new bundles, special promotions and important service
          announcements. Stay informed and never miss an offer!
        </p>

        <a className="channel-card" href={channelUrl} target="_blank"
          rel="noopener noreferrer" onClick={dismissChannelPrompt}>
          <span className="channel-card-icon">◉</span>
          <span>
            <strong>Join our WhatsApp Channel</strong>
            <small>Updates, promos & announcements</small>
          </span>
          <b>↗</b>
        </a>

        <a className="channel-card support" href={supportUrl}
          target="_blank" rel="noopener noreferrer">
          <span className="channel-card-icon">☏</span>
          <span>
            <strong>Message AirData GH</strong>
            <small>Customer support on WhatsApp</small>
          </span>
          <b>↗</b>
        </a>
      </div>

      <div className="channel-actions">
        <button onClick={dismissChannelPrompt}>Maybe Later</button>
        <a href={channelUrl} target="_blank" rel="noopener noreferrer"
          onClick={dismissChannelPrompt}>
          Join Channel
        </a>
      </div>
    </section>
  </div>
)}
<style>{`
.channel-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 14px;
  background: rgba(5,13,27,.62);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  font-family: Inter, Arial, sans-serif;
}
.channel-modal {
  width: min(560px,100%);
  overflow: hidden;
  border-radius: 27px;
  background: white;
  color: #172338;
  box-shadow: 0 28px 90px #0006;
  animation: channelIn .25s ease-out;
}
@keyframes channelIn {
  from {opacity:0;transform:translateY(14px) scale(.98)}
  to {opacity:1;transform:translateY(0) scale(1)}
}
.channel-header {
  position: relative;
  min-height: 190px;
  padding: 35px 28px 28px 125px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
  background: linear-gradient(120deg,#08a9df,#087cff 65%,#174fe5);
}
.channel-icon {
  position: absolute;
  left: 27px;
  top: 50%;
  transform: translateY(-50%);
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border: 1px solid #ffffff55;
  border-radius: 22px;
  background: #ffffff20;
  font-size: 37px;
}
.channel-close {
  position: absolute;
  top: 13px;
  right: 16px;
  border: 0;
  background: transparent;
  color: white;
  font-size: 29px;
  cursor: pointer;
}
.channel-eyebrow {
  margin-bottom: 10px;
  color: #d8f4ff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 2px;
}
.channel-header h2 {
  margin: 0;
  color: white;
  font-size: 27px;
  line-height: 1.3;
}
.channel-body { padding: 25px 28px; }
.channel-body p {
  margin: 0 0 20px;
  color: #465267;
  font-size: 15px;
  line-height: 1.65;
}
.channel-card {
  min-height: 85px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px;
  border: 1px solid #d8edfb;
  border-radius: 20px;
  background: #f2faff;
  color: #172338;
  text-decoration: none;
}
.channel-card + .channel-card { margin-top: 13px; }
.channel-card.support {
  border-color: #e8ebf0;
  background: white;
}
.channel-card-icon {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #0bbd65;
  color: white;
  font-size: 27px;
}
.channel-card.support .channel-card-icon { background: #2878ed; }
.channel-card span:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.channel-card strong { font-size: 14px; }
.channel-card small { color: #778397; font-size: 11px; }
.channel-card b { color: #2878aa; font-size: 23px; }
.channel-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 21px 28px 25px;
  border-top: 1px solid #edf0f4;
}
.channel-actions button,
.channel-actions a {
  min-height: 59px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}
.channel-actions button {
  border: 1px solid #dce1e8;
  background: white;
  color: #566174;
}
.channel-actions a {
  background: linear-gradient(105deg,#08a9df,#087cff);
  color: white;
  box-shadow: 0 8px 20px #087cff35;
}
@media(max-width:480px) {
  .channel-header { min-height:170px;padding:30px 42px 25px 105px; }
  .channel-icon { left:17px;width:68px;height:68px; }
  .channel-header h2 { font-size:23px; }
  .channel-body { padding:21px 17px; }
  .channel-body p { font-size:14px; }
  .channel-card { gap:10px;padding:11px; }
  .channel-card strong { font-size:12px; }
  .channel-card small { font-size:10px; }
  .channel-actions { padding:17px;gap:9px; }
  .channel-actions button,.channel-actions a { min-height:55px;font-size:12px; }
}
`}</style>
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
                .customer-social-buttons {
          display: grid;
          gap: 11px;
          margin: 20px 0;
        }

        .customer-social-button {
          width: 100%;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1px solid #45617e;
          border-radius: 12px;
          background: #ffffff;
          color: #172b43;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .customer-social-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .customer-social-icon {
          font-size: 19px;
          font-weight: 900;
        }

        .customer-social-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 19px 0;
          color: #a9c5e2;
          font-size: 10px;
          font-weight: 800;
        }

        .customer-social-divider::before,
        .customer-social-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #ffffff25;
        }

        .customer-social-note {
          margin-top: -7px;
          color: #a9c5e2;
          font-size: 10px;
          text-align: center;
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
