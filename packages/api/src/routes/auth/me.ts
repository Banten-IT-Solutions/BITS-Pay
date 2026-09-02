import { Hono } from 'hono';
import type { Env } from '../../config';
import type { UserPublic } from '@bits-pay/shared';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';

const router = new Hono<{ Bindings: Env }>();

router.get('/me', requireAuth, async (c) => {
  const auth = c.get('user');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, tier, status FROM users WHERE id = ?',
  )
    .bind(auth.id)
    .first<UserPublic>();
  if (!user || user.status !== 'active') throw AppError.unauthorized('Akun tidak aktif');
  return success(c, user);
});

export { router as meRoute };
