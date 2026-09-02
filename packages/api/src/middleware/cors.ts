import { cors } from 'hono/cors';
import type { Env } from '../config';

/**
 * CORS untuk dashboard SPA (pay.bits.co.id → api.pay.bits.co.id).
 * Server-to-server (API key) tidak kirim Origin header — cors() skip otomatis.
 */
export function corsMiddleware() {
  return cors({
    origin: (origin: string, c) => {
      if (!origin) return origin;
      const allowed = (c.env as Env).APP_URL;
      return origin === allowed ? origin : null;
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-BITS-Signature', 'X-BITS-Event'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });
}
