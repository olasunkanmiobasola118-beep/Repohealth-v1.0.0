import crypto from 'node:crypto';

function getDerivedKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.GEMINI_API_KEY ||
    'repo-health-local-dev-ephemeral-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDerivedKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getDerivedKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function redactSecrets(input: string): string {
  return input
    .replace(/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, '$1****************')
    .replace(/\b(ghp_|github_pat_|sk_live_|sk-[a-zA-Z0-9]{10,})[A-Za-z0-9_\-]*/g, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
}
