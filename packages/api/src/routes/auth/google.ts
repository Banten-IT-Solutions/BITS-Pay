import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { AuthService } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.get('/google', async (c) => {
  const url = await AuthService.googleAuthUrl(c.env);
  return c.redirect(url);
});

router.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code) throw AppError.badRequest('google_auth_failed', 'Kode OAuth tidak ditemukan');
  const { code: authCode } = await AuthService.googleCallback(c.env, code, state);
  return c.redirect(`${c.env.APP_URL}/auth/callback?code=${encodeURIComponent(authCode)}`);
});

export { router as googleRoute };
