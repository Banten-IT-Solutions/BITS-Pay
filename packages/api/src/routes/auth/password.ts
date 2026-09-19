import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { validateBody } from '../../lib/validate';
import { hashPassword, verifyPassword, signJWT } from '@bits-pay/shared';

const changePasswordSchema = z.object({
  current_password: z.string().optional(),
  new_password: z
    .string()
    .min(8, 'Password baru minimal 8 karakter')
    .max(100, 'Password maksimal 100 karakter'),
});

const router = new Hono<{ Bindings: Env }>();

router.put('/', requireAuth, async (c) => {
  const auth = c.get('user');
  const input = await validateBody(c, changePasswordSchema);

  const user = await c.env.DB.prepare(
    'SELECT id, email, tier, password_hash, token_version FROM users WHERE id = ?',
  )
    .bind(auth.id)
    .first<{
      id: string;
      email: string;
      tier: string;
      password_hash: string | null;
      token_version: number;
    }>();

  if (!user) throw AppError.unauthorized('User tidak ditemukan');

  if (user.password_hash) {
    if (!input.current_password) {
      throw AppError.badRequest('validation_error', 'Password saat ini diperlukan', {
        current_password: ['Password saat ini diperlukan'],
      });
    }
    const valid = await verifyPassword(input.current_password, user.password_hash);
    if (!valid) {
      throw AppError.unauthorized('Password saat ini salah');
    }
  }

  const newHash = await hashPassword(input.new_password);
  const newTokenVersion = user.token_version + 1;

  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, token_version = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(newHash, newTokenVersion, user.id)
    .run();

  const newToken = await signJWT(
    { id: user.id, email: user.email, tier: user.tier, token_version: newTokenVersion },
    c.env.JWT_SECRET,
    c.env.JWT_EXPIRES_IN,
  );

  return success(c, {
    token: newToken,
    message: 'Password berhasil diperbarui',
  });
});

export { router as passwordRoute };
