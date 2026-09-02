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
  const { token } = await AuthService.googleCallback(c.env, code, state);
  // ponytail: token masih di query (frontend SPA belum konsumsi one-time code).
  // Upgrade: ganti dengan short-lived one-time code supaya tidak bocor di log/referer.
  const redirectUrl = new URL(`${c.env.APP_URL}/dashboard`);
  redirectUrl.searchParams.set('token', token);
  return c.redirect(redirectUrl.toString());
});

export { router as googleRoute };
