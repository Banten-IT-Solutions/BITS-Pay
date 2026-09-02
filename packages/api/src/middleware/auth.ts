import { createMiddleware } from 'hono/factory';
import { verifyJWT } from '@bits-pay/shared';
import { AppError } from '../lib/errors';

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; email: string; tier: string };
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Token tidak ditemukan');
  }
  const token = header.slice(7);
  try {
    const payload = await verifyJWT<{ id: string; email: string; tier: string }>(
      token,
      c.env.JWT_SECRET,
    );
    c.set('user', payload);
    await next();
  } catch {
    throw AppError.unauthorized('Token tidak valid atau expired');
  }
});
