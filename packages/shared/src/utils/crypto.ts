// BITS Pay — Crypto Utilities
// Runtime: Cloudflare Workers (Web Crypto API + bcryptjs ESM)

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SALT_ROUNDS = 10;

/**
 * Hash password dengan bcryptjs.
 * bcryptjs ESM compatible via npm import.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate API key: sk_ prefix + 32 byte random hex
 */
export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const prefix = raw.slice(0, 8);
  const key = `sk_${raw}`;
  const hash = await hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash API key untuk penyimpanan (SHA-256 via Web Crypto)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate random token (email verification, password reset)
 */
export function generateToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate JWT signature (via jose)
 */
export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = '7d',
): Promise<string> {
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
  const encoder = new TextEncoder();
  const { payload } = await jwtVerify(token, encoder.encode(secret), { algorithms: ['HS256'] });
  return payload as T;
}

/**
 * HMAC signature untuk callback payload
 */
export async function signCallbackPayload(payload: string, secret: string): Promise<string> {
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
