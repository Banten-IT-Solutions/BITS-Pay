import { cors } from 'hono/cors';
import type { Env } from '../config';

/**
 * CORS untuk dashboard SPA (pay.bits.co.id → api.pay.bits.co.id).
 * Server-to-server (API key) tidak kirim Origin header — cors() skip otomatis.
 *
 * Origin yang diizinkan = APP_URL + CORS_ORIGINS (comma-separated, opsional).
 * CORS_ORIGINS untuk origin dev tambahan, mis:
 * "http://localhost:7003,http://localhost:7004,http://192.168.1.10:7002"
 */
function getAllowedOrigins(env: Env): string[] {
  const extra = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [env.APP_URL, ...extra];
}

export function corsMiddleware() {
  return cors({
    origin: (origin: string, c) => {
      if (!origin) return origin;
      const allowed = getAllowedOrigins(c.env as Env);
      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-BITS-Signature', 'X-BITS-Event'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });
}
