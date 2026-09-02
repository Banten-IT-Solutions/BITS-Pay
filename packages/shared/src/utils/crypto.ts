// BITS Pay — Crypto Utilities
// NOTE: Runtime = Cloudflare Workers (Web Crypto API, not Node crypto)

/**
 * Hash password dengan bcrypt (via npm: bcryptjs).
 * Fallback: PBKDF2 jika bcrypt tidak available.
 */
export async function hashPassword(password: string): Promise<string> {
  // Implementasi: gunakan bcryptjs di Worker
  // const bcrypt = await import('bcryptjs');
  // return bcrypt.hash(password, 10);
  throw new Error('hashPassword: implement with bcryptjs or @node-rs/bcrypt');
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  throw new Error('verifyPassword: implement with bcryptjs or @node-rs/bcrypt');
}

/**
 * Generate API key: sk_ prefix + 32 byte random hex
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const { randomBytes } = require('node:crypto');
  const raw = randomBytes(32).toString('hex');
  const prefix = raw.slice(0, 8);
  const key = `sk_${raw}`;
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash API key untuk penyimpanan (SHA-256)
 */
export function hashApiKey(key: string): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate random token (email verification, password reset)
 */
export function generateToken(bytes = 32): string {
  const { randomBytes } = require('node:crypto');
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate JWT signature (via jose)
 * @see docs/IMPLEMENTATION_GUIDE.md untuk detail
 */
export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = '7d',
): Promise<string> {
  const { SignJWT } = await import('jose');
  const encoder = new TextEncoder();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(encoder.encode(secret));
}

export async function verifyJWT<T = Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T> {
  const { jwtVerify } = await import('jose');
  const encoder = new TextEncoder();
  const { payload } = await jwtVerify(token, encoder.encode(secret));
  return payload as T;
}

/**
 * HMAC signature untuk callback payload
 */
export async function signCallbackPayload(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}