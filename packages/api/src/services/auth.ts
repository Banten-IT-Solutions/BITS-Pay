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
import { EmailService } from './email';

export const signupSchema = z.object({
  email: z.email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  name: z.string().min(1, 'Nama wajib diisi'),
});

export const loginSchema = z.object({
  email: z.email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Email tidak valid'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export class AuthService {
  static async signup(
    env: Env,
    input: z.infer<typeof signupSchema>,
  ): Promise<{ user: UserPublic; token: string }> {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(input.email)
      .first();
    if (existing) throw AppError.conflict('email_exists', 'Email sudah terdaftar');

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(input.password);
    const user = await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?) RETURNING id, email, name, avatar_url, tier, status',
    )
      .bind(id, input.email, passwordHash, input.name)
      .first<UserPublic>();
    if (!user) throw AppError.internal('Gagal membuat user');

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), id, token, expiresAt)
      .run();

    const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;
    await EmailService.send(env, {
      to: input.email,
      subject: 'Verifikasi Email BITS Pay',
      text: `Halo ${input.name}, verifikasi email kamu: ${verifyUrl}`,
      html: `<p>Halo ${input.name},</p><p>Klik <a href="${verifyUrl}">di sini</a> untuk verifikasi email.</p>`,
    }).catch(() => {});

    const jwt = await signJWT(
      { id: user.id, email: user.email, tier: user.tier },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    );

    return { user, token: jwt };
  }

  static async login(
    env: Env,
    input: z.infer<typeof loginSchema>,
  ): Promise<{ user: UserPublic; token: string }> {
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, avatar_url, tier, status FROM users WHERE email = ?',
    )
      .bind(input.email)
      .first<User & { password_hash: string | null }>();
    if (!user || !user.password_hash) {
      throw AppError.unauthorized('Email atau password salah');
    }
    if (user.status !== 'active') {
      throw AppError.unauthorized('Akun tidak aktif');
    }

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) throw AppError.unauthorized('Email atau password salah');

    await env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
      .bind(user.id)
      .run();

    const jwt = await signJWT(
      { id: user.id, email: user.email, tier: user.tier },
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

    await env.DB.prepare('UPDATE email_verifications SET used = 1 WHERE id = ?').bind(row.id).run();
    await env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?')
      .bind(row.user_id)
      .run();
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

    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    await EmailService.send(env, {
      to: email,
      subject: 'Reset Password BITS Pay',
      text: `Halo ${user.name}, reset password kamu: ${resetUrl}`,
      html: `<p>Halo ${user.name},</p><p>Klik <a href="${resetUrl}">di sini</a> untuk reset password.</p>`,
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
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(passwordHash, row.user_id)
      .run();
    await env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
      .bind(row.id)
      .run();
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
  ): Promise<{ user: UserPublic; token: string; isNew: boolean }> {
    if (!state) throw AppError.badRequest('google_auth_failed', 'State OAuth tidak ditemukan');
    const st = await env.DB.prepare('SELECT id, used, expires_at FROM oauth_states WHERE state = ?')
      .bind(state)
      .first<{ id: string; used: number; expires_at: string }>();
    if (!st) throw AppError.badRequest('google_auth_failed', 'State OAuth tidak valid');
    if (st.used) throw AppError.badRequest('google_auth_failed', 'State OAuth sudah dipakai');
    if (new Date(st.expires_at) < new Date()) {
      throw AppError.badRequest('google_auth_failed', 'State OAuth kadaluarsa');
    }
    await env.DB.prepare('UPDATE oauth_states SET used = 1 WHERE id = ?').bind(st.id).run();

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

    const existing = await env.DB.prepare(
      'SELECT id, email, name, avatar_url, tier, status FROM users WHERE google_id = ? OR email = ?',
    )
      .bind(googleUser.id, googleUser.email)
      .first<UserPublic>();
    if (existing) {
      await env.DB.prepare(
        "UPDATE users SET google_id = ?, last_login_at = datetime('now') WHERE id = ?",
      )
        .bind(googleUser.id, existing.id)
        .run();
      const jwt = await signJWT(
        { id: existing.id, email: existing.email, tier: existing.tier },
        env.JWT_SECRET,
        env.JWT_EXPIRES_IN,
      );
      return { user: existing, token: jwt, isNew: false };
    }

    const id = crypto.randomUUID();
    const user = await env.DB.prepare(
      'INSERT INTO users (id, email, name, avatar_url, google_id, email_verified) VALUES (?, ?, ?, ?, ?, 1) RETURNING id, email, name, avatar_url, tier, status',
    )
      .bind(id, googleUser.email, googleUser.name, googleUser.picture, googleUser.id)
      .first<UserPublic>();
    if (!user) throw AppError.internal('Gagal membuat user');

    const jwt = await signJWT(
      { id: user.id, email: user.email, tier: user.tier },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    );
    return { user, token: jwt, isNew: true };
  }
}
