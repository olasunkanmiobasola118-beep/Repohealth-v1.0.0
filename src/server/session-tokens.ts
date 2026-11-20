import crypto from 'node:crypto';

const SESSION_PREFIX = 'rh_sess';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionTokenPayload {
  uid: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function getSigningKey(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ENCRYPTION_SECRET ||
    process.env.GEMINI_API_KEY ||
    'repo-health-session-signing-key-v1'
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized) && normalized.length <= 254;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const actualBuf = crypto.scryptSync(password, salt, expectedBuf.length);
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function signSessionToken(
  user: { uid: string; email: string; name: string },
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    uid: user.uid,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encoded)
    .digest('base64url');
  return `${SESSION_PREFIX}.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || !token.startsWith(`${SESSION_PREFIX}.`)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!decoded.uid || !decoded.email || typeof decoded.exp !== 'number') {
      return null;
    }
    if (decoded.exp <= Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
