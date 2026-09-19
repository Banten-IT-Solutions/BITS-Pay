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
  const errorParam = c.req.query('error');
  if (errorParam) {
    // User batalkan login Google di consent screen -> arahkan kembali ke /login
    const redirectUrl = new URL(`${c.env.APP_URL}/user/`);
    redirectUrl.hash = '/login';
    return c.redirect(redirectUrl.toString());
  }
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code) throw AppError.badRequest('google_auth_failed', 'Kode OAuth tidak ditemukan');
  const { code: authCode } = await AuthService.googleCallback(c.env, code, state);
  // ponytail: user SPA diserve di /user/ (deploy-web copies user/dist → web/dist/user).
  // Hash route `#/auth/callback` biar svelte-spa-router render OAuthCallback;
  // param `code` di path query biar terbaca via window.location.search.
  const redirectUrl = new URL(`${c.env.APP_URL}/user/`);
  redirectUrl.searchParams.set('code', authCode);
  redirectUrl.hash = '/auth/callback';
  return c.redirect(redirectUrl.toString());
});

export { router as googleRoute };
