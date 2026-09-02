import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { success } from '../../lib/response';
import { AuthService } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.get('/verify-email', async (c) => {
  const token = c.req.query('token');
  if (!token) throw AppError.badRequest('validation_error', 'Token wajib disertakan');
  await AuthService.verifyEmail(c.env, token);
  return success(c, { message: 'Email berhasil diverifikasi' });
});

export { router as verifyRoute };
