import { Hono } from 'hono';
import type { Env } from '../../config';
import type { UserMe } from '@bits-pay/shared';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';

const router = new Hono<{ Bindings: Env }>();

router.get('/me', requireAuth, async (c) => {
  const auth = c.get('user');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, tier, status, tier_expires_at, password_hash, email_verified, created_at FROM users WHERE id = ?',
  )
    .bind(auth.id)
    .first<{
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      tier: 'free' | 'premium';
      status: 'active' | 'suspended' | 'banned';
      tier_expires_at: string | null;
      password_hash: string | null;
      email_verified: number;
      created_at: string;
    }>();
  if (!user || user.status !== 'active') throw AppError.unauthorized('Akun tidak aktif');
  // Trial = tier premium tanpa subscription aktif.
  const sub = await c.env.DB.prepare(
    "SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1",
  )
    .bind(auth.id)
    .first<{ id: string }>();
  const me: UserMe = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    tier: user.tier,
    status: user.status,
    tier_expires_at: user.tier_expires_at,
    is_trial: user.tier === 'premium' && !sub,
    email_verified: user.email_verified === 1,
    has_password: !!user.password_hash,
    created_at: user.created_at,
  };
  return success(c, me);
});

export { router as meRoute };
