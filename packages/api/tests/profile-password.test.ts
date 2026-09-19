import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../src/middleware/error-handler';
import { authRoutes } from '../src/routes/auth';
import type { Env } from '../src/config';
import { mockDbDispatch, mockEnv } from './mock-env';
import { hashPassword, signJWT } from '@bits-pay/shared';

const JWT_SECRET = 'test-jwt-secret-min-32-chars-long!!';
const USER_ID = 'u-test-123';
const CURRENT_PASS = 'P@ssword123';

async function makeTestApp(userOverrides: Record<string, unknown> = {}) {
  const passwordHash = await hashPassword(CURRENT_PASS);
  const user = {
    id: USER_ID,
    email: 'user@test.com',
    password_hash: passwordHash,
    name: 'Budi Test',
    avatar_url: null,
    tier: 'free',
    status: 'active',
    tier_expires_at: null,
    email_verified: 1,
    token_version: 0,
    created_at: '2026-09-01T00:00:00Z',
    ...userOverrides,
  };

  const db = mockDbDispatch([
    {
      match: 'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
      first: ([email]) => (email === 'taken@test.com' ? { id: 'other-user' } : null),
    },
    {
      match:
        'SELECT id, email, tier, status, token_version, email_verified FROM users WHERE id = ?',
      first: () => ({
        id: user.id,
        email: user.email,
        tier: user.tier,
        status: user.status,
        token_version: user.token_version,
        email_verified: user.email_verified,
      }),
    },
    {
      match: 'SELECT id, email, password_hash, name',
      first: () => user,
    },
    {
      match: 'SELECT id, email, tier, password_hash, token_version FROM users WHERE id = ?',
      first: () => user,
    },
    {
      match: 'SELECT id FROM subscriptions',
      first: () => null,
    },
    {
      match: 'UPDATE users',
      run: () => 1,
    },
  ]);

  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.route('/auth', authRoutes);

  const env = mockEnv({
    DB: db,
    JWT_SECRET,
  });

  const validToken = await signJWT(
    { id: user.id, email: user.email, tier: user.tier, token_version: user.token_version },
    JWT_SECRET,
    '1d',
  );

  return { app, env, validToken };
}

describe('Auth Profile & Password API', () => {
  it('PATCH /auth/profile: update nama berhasil', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/profile',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Budi Baru' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { user: { name: string } } };
    expect(body.success).toBe(true);
    expect(body.data.user.name).toBe('Budi Baru');
  });

  it('PATCH /auth/profile: ubah email tanpa password saat ini gagal 400', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/profile',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'newemail@test.com' }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('validation_error');
  });

  it('PATCH /auth/profile: ubah email dengan password salah gagal 401', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/profile',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newemail@test.com',
          current_password: 'WrongPassword!',
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('unauthorized');
  });

  it('PATCH /auth/profile: ubah email dengan email yang sudah dipakai gagal 409', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/profile',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'taken@test.com',
          current_password: CURRENT_PASS,
        }),
      },
      env,
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('duplicate_email');
  });

  it('PUT /auth/password: ubah password dengan password saat ini salah gagal 401', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/password',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: 'WrongPassword!',
          new_password: 'NewStrongPassword123',
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('unauthorized');
  });

  it('PUT /auth/password: ubah password berhasil dan mengembalikan token baru', async () => {
    const { app, env, validToken } = await makeTestApp();

    const res = await app.request(
      '/auth/password',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: CURRENT_PASS,
          new_password: 'NewStrongPassword123',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { token: string } };
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe('string');
  });
});
