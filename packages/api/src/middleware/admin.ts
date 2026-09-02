import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';

// Harus dipasang SETELAH requireAuth.
// ponytail: admin list via wrangler var; upgrade path = kolom users.role / tabel admins.
export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (!user) throw AppError.unauthorized('Token tidak ditemukan');
  const admins = (c.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) {
    throw AppError.unauthorized('Akses admin diperlukan');
  }
  await next();
});
