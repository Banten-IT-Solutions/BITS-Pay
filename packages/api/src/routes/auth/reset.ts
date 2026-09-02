import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AuthService, forgotPasswordSchema, resetPasswordSchema } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.get('/reset', (c) => {
  const token = c.req.query('token') ?? '';
  return success(c, { token });
});

router.post('/reset', async (c) => {
  const input = await validateBody(c, resetPasswordSchema);
  await AuthService.resetPassword(c.env, input.token, input.password);
  return success(c, { message: 'Password berhasil direset' });
});

router.post('/forgot-password', async (c) => {
  const input = await validateBody(c, forgotPasswordSchema);
  await AuthService.forgotPassword(c.env, input.email);
  return success(c, { message: 'Jika email terdaftar, link reset telah dikirim' });
});

export { router as resetRoute };
