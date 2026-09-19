import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { type UserMe, verifyPassword, generateToken, signJWT } from '@bits-pay/shared';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { validateBody } from '../../lib/validate';
import { EmailService } from '../../services/email';
import { EmailTemplateService } from '../../services/email-template';

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
    .optional(),
  email: z.string().trim().email('Format email tidak valid').max(255).optional(),
  current_password: z.string().optional(),
});

const router = new Hono<{ Bindings: Env }>();

router.patch('/', requireAuth, async (c) => {
  const auth = c.get('user');
  const input = await validateBody(c, updateProfileSchema);

  if (!input.name && !input.email) {
    throw AppError.badRequest('validation_error', 'Tidak ada perubahan data');
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name, avatar_url, tier, status, tier_expires_at, email_verified, token_version, created_at FROM users WHERE id = ?',
  )
    .bind(auth.id)
    .first<{
      id: string;
      email: string;
      password_hash: string | null;
      name: string;
      avatar_url: string | null;
      tier: 'free' | 'premium';
      status: 'active' | 'suspended' | 'banned';
      tier_expires_at: string | null;
      email_verified: number;
      token_version: number;
      created_at: string;
    }>();

  if (!user || user.status !== 'active') throw AppError.unauthorized('Akun tidak aktif');

  let newEmail = user.email;
  let emailChanged = false;
  let newName = user.name;

  if (input.name && input.name !== user.name) {
    newName = input.name;
  }

  if (input.email && input.email.toLowerCase() !== user.email.toLowerCase()) {
    newEmail = input.email.toLowerCase();
    emailChanged = true;

    if (user.password_hash) {
      if (!input.current_password) {
        throw AppError.badRequest(
          'validation_error',
          'Password saat ini diperlukan untuk mengubah email',
          { current_password: ['Password saat ini diperlukan'] },
        );
      }
      const valid = await verifyPassword(input.current_password, user.password_hash);
      if (!valid) {
        throw AppError.unauthorized('Password saat ini salah');
      }
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
    )
      .bind(newEmail, user.id)
      .first();
    if (existing) {
      throw AppError.conflict('duplicate_email', 'Email sudah terdaftar pada akun lain');
    }
  }

  if (emailChanged) {
    const verifyToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(newName, newEmail, user.id),
      c.env.DB.prepare(
        'INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), user.id, verifyToken, expiresAt),
    ]);

    const verifyUrl = `${c.env.APP_URL}/user/?token=${encodeURIComponent(verifyToken)}#/verify-email`;
    const tpl = await EmailTemplateService.get(c.env, 'email_template_verify');
    const defaultText = `Halo ${newName}, verifikasi alamat email baru kamu: ${verifyUrl}`;
    const text =
      EmailTemplateService.render(tpl, { name: newName, verify_url: verifyUrl }) || defaultText;
    await EmailService.send(c.env, {
      to: newEmail,
      subject: 'Verifikasi Email Baru BITS Pay',
      text,
      html:
        text === defaultText
          ? `<p>Halo ${newName},</p><p>Klik <a href="${verifyUrl}">di sini</a> untuk verifikasi alamat email baru kamu.</p>`
          : undefined,
    }).catch(() => {});
  } else {
    await c.env.DB.prepare("UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(newName, user.id)
      .run();
  }

  const sub = await c.env.DB.prepare(
    "SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1",
  )
    .bind(user.id)
    .first<{ id: string }>();

  const me: UserMe = {
    id: user.id,
    email: newEmail,
    name: newName,
    avatar_url: user.avatar_url,
    tier: user.tier,
    status: user.status,
    tier_expires_at: user.tier_expires_at,
    is_trial: user.tier === 'premium' && !sub,
    email_verified: emailChanged ? false : user.email_verified === 1,
    has_password: !!user.password_hash,
    created_at: user.created_at,
  };

  let newToken: string | undefined;
  if (emailChanged) {
    newToken = await signJWT(
      { id: user.id, email: newEmail, tier: user.tier, token_version: user.token_version },
      c.env.JWT_SECRET,
      c.env.JWT_EXPIRES_IN,
    );
  }

  return success(c, {
    user: me,
    token: newToken,
    message: emailChanged
      ? 'Profil diperbarui. Silakan cek email baru untuk verifikasi.'
      : 'Profil berhasil diperbarui',
  });
});

export { router as profileRoute };
