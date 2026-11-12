
export const AUTH_BASE_URL =
  'https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth';

export async function requireUser(req, res) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    res.status(401).json({
      error: 'Please sign in first.'
    });
    return null;
  }

  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');

    const JWKS = createRemoteJWKSet(
      new URL(`${AUTH_BASE_URL}/.well-known/jwks.json`)
    );

    const { payload } = await jwtVerify(token, JWKS);

    if (!payload.sub || !payload.email) {
      res.status(401).json({
        error: 'Account details are missing.'
      });
      return null;
    }

    return {
      id: String(payload.sub),
      email: String(payload.email).trim().toLowerCase()
    };

  } catch (error) {
    console.error('User verification failed:', error.message);

    res.status(401).json({
      error: 'Please sign in again.'
    });

    return null;
  }
}

export async function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const { neon } = await import('@neondatabase/serverless');

  return neon(process.env.DATABASE_URL);
}
