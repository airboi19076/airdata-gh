

const AUTH_BASE_URL =
  process.env.NEON_AUTH_BASE_URL ||
  'https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth';

const AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  `${AUTH_BASE_URL.replace(/\/$/, '')}/.well-known/jwks.json`;

const AUTH_ISSUER = new URL(AUTH_BASE_URL).origin;

let remoteJwksPromise;

async function getRemoteJwks() {
  if (!remoteJwksPromise) {
    remoteJwksPromise = import('jose')
      .then(({ createRemoteJWKSet }) =>
        createRemoteJWKSet(new URL(AUTH_JWKS_URL))
      )
      .catch(error => {
        remoteJwksPromise = null;
        throw error;
      });
  }

  return remoteJwksPromise;
}

export async function requireUser(req, res) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    res.status(401).json({
      error: 'Please sign in first.'
    });
    return null;
  }

  try {
    const { jwtVerify } = await import('jose');
    const JWKS = await getRemoteJwks();

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_ISSUER,
      algorithms: ['EdDSA']
    });

    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      res.status(401).json({
        error: 'Your account identity is missing. Please sign in again.'
      });
      return null;
    }

    return {
      id: payload.sub
    };

  } catch (error) {
    console.error('Neon Auth JWT verification failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'unknown',
      message: error?.message || 'Token verification failed'
    });

    res.status(401).json({
      error: 'Your login token could not be verified. Please sign in again.'
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
