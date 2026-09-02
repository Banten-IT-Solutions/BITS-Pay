import { createMiddleware } from 'hono/factory';
import { verifyJWT } from '@bits-pay/shared';
import { AppError } from '../lib/errors';
import type { Env } from '../config';

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; email: string; tier: string; token_version: number };
  }
}

interface JwtPayload {
  id: string;
  email: string;
  tier: string;
  token_version: number;
}

export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token tidak ditemukan');
  }
  const token = header.slice(7);
  let payload: JwtPayload;
  try {
    payload = await verifyJWT<JwtPayload>(token, c.env.JWT_SECRET);
  } catch {
    throw AppError.unauthorized('Token tidak valid atau expired');
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, tier, status, token_version FROM users WHERE id = ?',
  )
    .bind(payload.id)
    .first<{ id: string; email: string; tier: string; status: string; token_version: number }>();
  if (!user) throw AppError.unauthorized('User tidak ditemukan');
  if (user.status !== 'active') throw AppError.unauthorized('Akun tidak aktif');
  if (payload.token_version !== user.token_version) {
    throw AppError.unauthorized('Sesi telah dicabut, silakan login ulang');
  }

  c.set('user', {
    id: user.id,
    email: user.email,
    tier: user.tier,
    token_version: user.token_version,
  });
  await next();
});
