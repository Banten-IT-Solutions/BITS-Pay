import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  signJWT,
  generateToken,
  type User,
  type UserPublic,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { dbTime } from '../lib/time';
import { EmailService } from './email';
import { EmailTemplateService } from './email-template';

export const signupSchema = z.object({
  email: z.email('Email tidak valid').toLowerCase(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  name: z.string().min(1, 'Nama wajib diisi'),
});

export const loginSchema = z.object({
  email: z.email('Email tidak valid').toLowerCase(),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Email tidak valid').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export class AuthService {
  static async signup(env: Env, input: z.infer<typeof signupSchema>): Promise<void> {
    // Anti-enumeration: respons identik baik email baru maupun sudah terdaftar.
    // Email sudah terdaftar → diam saja (tidak bocor info, tidak auto-login).
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(input.email)
      .first();
    if (existing) return;

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(input.password);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // batch = atomik: user + token verifikasi masuk bersama, tidak ada user yatim.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').bind(
        id,
        input.email,
        passwordHash,
        input.name,
      ),
      env.DB.prepare(
        'INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), id, token, expiresAt),
    ]);

    // ponytail: user SPA diserve di /user/ (deploy-web). Hash route biar SPA router baca rute.
    const verifyUrl = `${env.APP_URL}/user/?token=${encodeURIComponent(token)}#/verify-email`;
    const tpl = await EmailTemplateService.get(env, 'email_template_verify');
    const defaultText = `Halo ${input.name}, verifikasi email kamu: ${verifyUrl}`;
    const text =
      EmailTemplateService.render(tpl, { name: input.name, verify_url: verifyUrl }) || defaultText;
    await EmailService.send(env, {
      to: input.email,
      subject: 'Verifikasi Email BITS Pay',
      text,
      html:
        text === defaultText
          ? `<p>Halo ${input.name},</p><p>Klik <a href="${verifyUrl}">di sini</a> untuk verifikasi email.</p>`
          : undefined,
    }).catch(() => {});
  }

  static async login(
    env: Env,
    input: z.infer<typeof loginSchema>,
  ): Promise<{ user: UserPublic; token: string }> {
    // Lockout per akun (tabel login_attempts, key = email): 5x gagal → kunci 15 menit.
    const attempt = await env.DB.prepare(
      'SELECT failed_count, locked_until FROM login_attempts WHERE email = ?',
    )
      .bind(input.email)
      .first<{ failed_count: number; locked_until: string | null }>();
    let failedCount = attempt?.failed_count ?? 0;
    if (attempt?.locked_until) {
      if (attempt.locked_until > dbTime(new Date())) {
        throw AppError.tooMany('Terlalu banyak percobaan login. Coba lagi 15 menit.');
      }
      // Lock sudah lewat → reset counter, mulai hitung ulang.
      await env.DB.prepare(
        'UPDATE login_attempts SET failed_count = 0, locked_until = NULL WHERE email = ?',
      )
        .bind(input.email)
        .run();
      failedCount = 0;
    }

    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, avatar_url, tier, status, token_version FROM users WHERE email = ?',
    )
      .bind(input.email)
      .first<User & { password_hash: string | null }>();
    // Email tidak terdaftar / akun OAuth tanpa password TIDAK dihitung gagal —
    // cegah lockout saat user cuma salah ketik email atau salah jalur login.
    if (!user || !user.password_hash) {
      throw AppError.unauthorized('Email atau password salah');
    }
    if (user.status !== 'active') {
      await recordFailedLogin(env, input.email, failedCount);
      throw AppError.unauthorized('Email atau password salah');
    }

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) {
      await recordFailedLogin(env, input.email, failedCount);
      throw AppError.unauthorized('Email atau password salah');
    }

    // Sukses → bersihkan counter lockout.
    await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(input.email).run();

    await env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
      .bind(user.id)
      .run();

    const jwt = await signJWT(
      { id: user.id, email: user.email, tier: user.tier, token_version: user.token_version },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    );

    const publicUser: UserPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      tier: user.tier,
      status: user.status,
    };
    return { user: publicUser, token: jwt };
  }

  static async verifyEmail(env: Env, token: string): Promise<void> {
    const row = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used FROM email_verifications WHERE token = ?',
    )
      .bind(token)
      .first<{ id: string; user_id: string; expires_at: string; used: number }>();
    if (!row) throw AppError.notFound('Token verifikasi');
    if (row.used) throw AppError.badRequest('token_used', 'Token sudah digunakan');
    if (new Date(row.expires_at) < new Date()) {
      throw AppError.badRequest('expired', 'Token sudah kadaluarsa');
    }

    // batch = atomik: user terverifikasi + token hangus bersamaan.
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(row.user_id),
      env.DB.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').bind(row.id),
    ]);
  }

  static async forgotPassword(env: Env, email: string): Promise<void> {
    const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; name: string }>();
    if (!user) return;

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), user.id, token, expiresAt)
      .run();

    const resetUrl = `${env.APP_URL}/user/?token=${encodeURIComponent(token)}#/reset-password`;
    const tpl = await EmailTemplateService.get(env, 'email_template_reset');
    const defaultText = `Halo ${user.name}, reset password kamu: ${resetUrl}`;
    const text =
      EmailTemplateService.render(tpl, { name: user.name, reset_url: resetUrl }) || defaultText;
    await EmailService.send(env, {
      to: email,
      subject: 'Reset Password BITS Pay',
      text,
      html:
        text === defaultText
          ? `<p>Halo ${user.name},</p><p>Klik <a href="${resetUrl}">di sini</a> untuk reset password.</p>`
          : undefined,
    }).catch(() => {});
  }

  static async resetPassword(env: Env, token: string, password: string): Promise<void> {
    const row = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
    )
      .bind(token)
      .first<{ id: string; user_id: string; expires_at: string; used: number }>();
    if (!row) throw AppError.notFound('Token reset password');
    if (row.used) throw AppError.badRequest('token_used', 'Token sudah digunakan');
    if (new Date(row.expires_at) < new Date()) {
      throw AppError.badRequest('expired', 'Token sudah kadaluarsa');
    }

    const passwordHash = await hashPassword(password);
    // batch = atomik: password diganti + token hangus bersamaan.
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(
        passwordHash,
        row.user_id,
      ),
      env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').bind(row.id),
    ]);
  }

  static async googleAuthUrl(env: Env): Promise<string> {
    const redirectUri = env.GOOGLE_REDIRECT_URI;
    const clientId = env.GOOGLE_CLIENT_ID;
    const state = generateToken(16);
    await env.DB.prepare('INSERT INTO oauth_states (id, state, expires_at) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), state, new Date(Date.now() + 10 * 60 * 1000).toISOString())
      .run();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  static async googleCallback(
    env: Env,
    code: string,
    state: string | undefined,
  ): Promise<{ code: string; isNew: boolean }> {
    if (!state) throw AppError.badRequest('google_auth_failed', 'State OAuth tidak ditemukan');
    const st = await env.DB.prepare('SELECT id, used, expires_at FROM oauth_states WHERE state = ?')
      .bind(state)
      .first<{ id: string; used: number; expires_at: string }>();
    if (!st) throw AppError.badRequest('google_auth_failed', 'State OAuth tidak valid');
    if (st.used) throw AppError.badRequest('google_auth_failed', 'State OAuth sudah dipakai');
    if (new Date(st.expires_at) < new Date()) {
      throw AppError.badRequest('google_auth_failed', 'State OAuth kadaluarsa');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const tokenResp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResp.ok) {
      throw AppError.badRequest('google_auth_failed', 'Gagal autentikasi Google');
    }
    const tokenData = (await tokenResp.json()) as { access_token: string };
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userInfoResp.ok) {
      throw AppError.badRequest('google_auth_failed', 'Gagal mendapatkan data user Google');
    }
    const googleUser = (await userInfoResp.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };
    const email = googleUser.email.toLowerCase();

    // Tandai state terpakai HANYA setelah exchange + userinfo sukses —
    // kalau exchange gagal, state masih bisa dipakai ulang.
    // Guard `used = 0` + meta.changes: dua request paralel dengan state sama,
    // hanya satu yang menang update; yang kalah changes=0 → tolak.
    const stateRes = await env.DB.prepare(
      'UPDATE oauth_states SET used = 1 WHERE id = ? AND used = 0',
    )
      .bind(st.id)
      .run();
    if (stateRes.meta.changes === 0) {
      throw AppError.badRequest('google_auth_failed', 'State OAuth sudah dipakai');
    }

    // 1) Match by google_id — akun yang memang sudah ter-link ke Google ini.
    const byGoogleId = await env.DB.prepare('SELECT id FROM users WHERE google_id = ?')
      .bind(googleUser.id)
      .first<{ id: string }>();
    if (byGoogleId) {
      await env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
        .bind(byGoogleId.id)
        .run();
      const authCode = await createAuthCode(env, byGoogleId.id);
      return { code: authCode, isNew: false };
    }

    // 2) Match by email — link HANYA bila akun sudah email_verified DAN belum
    // punya google_id. Email UNIQUE → tidak bisa buat akun kedua; akun
    // belum verified milik orang lain JANGAN di-link (pre-hijack), tolak jelas.
    const byEmail = await env.DB.prepare(
      'SELECT id, email_verified, google_id FROM users WHERE email = ?',
    )
      .bind(email)
      .first<{ id: string; email_verified: number; google_id: string | null }>();
    if (byEmail) {
      if (!byEmail.email_verified || byEmail.google_id) {
        throw AppError.conflict(
          'google_link_failed',
          'Email sudah terdaftar. Login dengan password lalu verifikasi email untuk menghubungkan akun Google.',
        );
      }
      await env.DB.prepare(
        "UPDATE users SET google_id = ?, last_login_at = datetime('now') WHERE id = ?",
      )
        .bind(googleUser.id, byEmail.id)
        .run();
      const authCode = await createAuthCode(env, byEmail.id);
      return { code: authCode, isNew: false };
    }

    // 3) Akun baru — email dari Google dianggap terverifikasi.
    const id = crypto.randomUUID();
    const user = await env.DB.prepare(
      'INSERT INTO users (id, email, name, avatar_url, google_id, email_verified) VALUES (?, ?, ?, ?, ?, 1) RETURNING id',
    )
      .bind(id, email, googleUser.name, googleUser.picture, googleUser.id)
      .first<{ id: string }>();
    if (!user) throw AppError.internal('Gagal membuat user');

    const authCode = await createAuthCode(env, user.id);
    return { code: authCode, isNew: true };
  }

  static async exchangeCode(env: Env, code: string): Promise<{ user: UserPublic; token: string }> {
    const row = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used FROM auth_codes WHERE code = ?',
    )
      .bind(code)
      .first<{ id: string; user_id: string; expires_at: string; used: number }>();
    if (!row) throw AppError.unauthorized('Kode tidak valid');
    if (row.used) throw AppError.unauthorized('Kode sudah digunakan');
    if (new Date(row.expires_at) < new Date()) {
      throw AppError.unauthorized('Kode sudah kadaluarsa');
    }
    await env.DB.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').bind(row.id).run();

    const user = await env.DB.prepare(
      'SELECT id, email, name, avatar_url, tier, status, token_version FROM users WHERE id = ?',
    )
      .bind(row.user_id)
      .first<User>();
    if (!user || user.status !== 'active') throw AppError.unauthorized('Akun tidak aktif');

    const token = await signJWT(
      { id: user.id, email: user.email, tier: user.tier, token_version: user.token_version },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    );
    const publicUser: UserPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      tier: user.tier,
      status: user.status,
    };
    return { user: publicUser, token };
  }
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

// Upsert counter gagal. Capai threshold → kunci 15 menit dan reset counter ke 0
// supaya setelah lock expire hitungan mulai dari awal. Pesan error ke caller
// tetap generik ('Email atau password salah') — status lock tidak bocor di sini.
async function recordFailedLogin(env: Env, email: string, currentFailed: number): Promise<void> {
  const next = currentFailed + 1;
  const locked = next >= LOGIN_MAX_ATTEMPTS;
  await env.DB.prepare(
    `INSERT INTO login_attempts (email, failed_count, locked_until) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until, updated_at = datetime('now')`,
  )
    .bind(
      email,
      locked ? 0 : next,
      locked ? dbTime(new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)) : null,
    )
    .run();
}

async function createAuthCode(env: Env, userId: string): Promise<string> {
  const code = generateToken(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO auth_codes (id, user_id, code, expires_at, used) VALUES (?, ?, ?, ?, 0)',
  )
    .bind(crypto.randomUUID(), userId, code, expiresAt)
    .run();
  return code;
}
