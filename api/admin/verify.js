import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTH_BASE_URL =
  'https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth';

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_BASE_URL}/.well-known/jwks.json`)
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const expectedAdmin = process.env.ADMIN_EMAIL;

  if (!expectedAdmin) {
    return res.status(500).json({
      error: 'Admin access is not configured yet.'
    });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    return res.status(401).json({
      error: 'Please sign in first.'
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_BASE_URL
    });

    const email = String(payload.email || '').trim().toLowerCase();

    if (email !== expectedAdmin.trim().toLowerCase()) {
      return res.status(403).json({
        error: 'This account is not authorised as an administrator.'
      });
    }

    return res.status(200).json({
      authorised: true,
      email
    });
  } catch (error) {
    console.error('Admin verification failed:', error.message);

    return res.status(401).json({
      error: 'Your session could not be verified. Please sign in again.'
    });
  }
}
