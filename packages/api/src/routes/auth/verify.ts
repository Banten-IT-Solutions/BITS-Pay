import { Hono } from 'hono';
import { verifyJWT } from '@bits-pay/shared';
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

router.post('/resend-verification', async (c) => {
  let userId: string | undefined;
  let email: string | undefined;

  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJWT<{ id: string; email: string }>(token, c.env.JWT_SECRET);
      userId = payload.id;
      email = payload.email;
    } catch {
      // Token expired atau invalid — lanjut baca body
    }
  }

  if (!userId) {
    const body = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
    email = body?.email;
  }

  if (!userId && !email) {
    throw AppError.badRequest('validation_error', 'Email atau sesi login diperlukan');
  }

  await AuthService.resendVerification(c.env, { userId, email });
  return success(c, { message: 'Tautan verifikasi baru berhasil dikirim ke email kamu' });
});

export { router as verifyRoute };
