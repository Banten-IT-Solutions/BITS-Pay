import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { AuthService } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.get('/google', async (c) => {
  const url = AuthService.googleAuthUrl(c.env);
  return c.redirect(url);
});

router.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) throw AppError.badRequest('google_auth_failed', 'Kode OAuth tidak ditemukan');
  const { user, token } = await AuthService.googleCallback(c.env, code);
  const redirectUrl = new URL(`${c.env.APP_URL}/dashboard`);
  redirectUrl.searchParams.set('token', token);
  redirectUrl.searchParams.set('user', JSON.stringify(user));
  return c.redirect(redirectUrl.toString());
});

export { router as googleRoute };
