import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { signJWT } from '@bits-pay/shared';
import { errorHandler } from '../src/middleware/error-handler';
import { appRoutes } from '../src/routes/app';
import { apiRoutes } from '../src/routes/api';
import type { Env } from '../src/config';
import { mockDbDispatch, mockRateLimiter, mockEnv, type SqlRoute } from './mock-env';

const JWT_SECRET = 'test-jwt-secret-min-32-chars-long!!';
const USER_ID = 'u1';
// QRIS static valid (contoh dari README bits-qris — lolos isValidQris + CRC).
const QRIS_STATIC =
  '00020101021126560014ID.CO.QRIS.WWW0115ID10231625260990215ID10231625260995204581253033605802ID5919BANTEN IT SOLUTIONS6006SERANG6304DA44';

const APP_ROW = {
  id: 'a1',
  workspace_id: 'w1',
  name: 'Toko Saya',
  api_key_prefix: 'sk_live_abc',
  callback_url: null,
  is_active: 1,
  qris_static: null as string | null,
  created_at: '2026-09-18 12:00:00',
  updated_at: '2026-09-18 12:00:00',
};

function authRoutesBase(): SqlRoute[] {
  return [
    {
      match: 'SELECT id, email, tier, status, token_version, email_verified FROM users',
      first: () => ({
        id: USER_ID,
        email: 'user@test.com',
        tier: 'free',
        status: 'active',
        token_version: 0,
        email_verified: 1,
      }),
    },
    { match: 'SELECT role FROM workspace_members', first: () => ({ role: 'owner' }) },
  ];
}

async function makeApp(routes: SqlRoute[]) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.route('/app', appRoutes);
  app.route('/v1', apiRoutes);
  const env = mockEnv({
    DB: mockDbDispatch(routes),
    JWT_SECRET,
    RATE_LIMITER: mockRateLimiter({ allowed: true, remaining: 9, reset: Date.now() + 1000 }),
    MAX_UNIQUE_CODE: '999',
    TRANSACTION_EXPIRE_MINUTES: '15',
    CALLBACK_QUEUE: { send: () => Promise.resolve() },
  });
  const token = await signJWT(
    { id: USER_ID, email: 'user@test.com', tier: 'free', token_version: 0 },
    JWT_SECRET,
    '1d',
  );
  return { app, env, token };
}

function putApp(token: string, body: unknown) {
  return {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('PUT /app/workspaces/:wid/apps/:id — qris_static', () => {
  it('QRIS invalid → 400 validation_error', async () => {
    const { app, env, token } = await makeApp(authRoutesBase());
    const res = await app.request(
      '/app/workspaces/w1/apps/a1',
      putApp(token, { qris_static: 'bukan-payload-qris' }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('QRIS valid → 200, charge berikutnya pakai QRIS app', async () => {
    const routes: SqlRoute[] = [
      ...authRoutesBase(),
      {
        match: 'FROM apps WHERE id = ? AND workspace_id = ?',
        first: () => APP_ROW,
      },
      {
        match: 'UPDATE apps SET',
        first: (p) => ({ ...APP_ROW, qris_static: p[3] as string }),
      },
      // Charge via API key: app sudah punya qris_static tersimpan.
      {
        match: 'api_key_hash = ?',
        first: () => ({
          id: 'a1',
          workspace_id: 'w1',
          is_active: 1,
          api_rate_limit: 10,
          qris_static: QRIS_STATIC,
        }),
      },
      {
        match: 'FROM workspaces w JOIN users u',
        first: () => ({ user_id: USER_ID, tier: 'free' }),
      },
      {
        match: 'FROM tier_features WHERE tier = ?',
        first: () => ({
          tier: 'free',
          max_workspaces: 1,
          max_apps: 1,
          max_transactions_month: 300,
          max_transactions_per_day: 10,
          api_rate_limit: 10,
          callback_allowed: 0,
          callback_retry_count: 0,
          max_team_members: 1,
        }),
      },
      { match: "date(p.created_at) = date('now')", first: () => ({ c: 0 }) },
      { match: "strftime('%Y-%m', p.created_at)", first: () => ({ c: 0 }) },
      { match: 'SELECT id FROM payments WHERE app_id = ? AND order_id = ?', first: () => null },
      { match: 'SELECT unique_code FROM payments', all: () => [] },
      {
        match: 'INSERT INTO payments',
        first: (p) => ({
          id: p[0],
          order_id: p[3],
          amount: p[4],
          amount_due: p[5],
          unique_code: p[6],
          currency: p[7],
          status: 'pending',
          qris_dynamic: p[10],
          qr_image: p[11],
          expired_at: p[12],
          created_at: '2026-09-18 12:00:00',
        }),
      },
    ];
    const { app, env, token } = await makeApp(routes);

    const res = await app.request(
      '/app/workspaces/w1/apps/a1',
      putApp(token, { qris_static: QRIS_STATIC }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { qris_static: string } };
    expect(body.data.qris_static).toBe(QRIS_STATIC);

    const charge = await app.request(
      '/v1/charges',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk_test_qris',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: 'ORD-QRIS-1', amount: 150000 }),
      },
      env,
    );
    expect(charge.status).toBe(201);
    const chargeBody = (await charge.json()) as { data: { qris_dynamic: string } };
    // Payload dynamic diturunkan dari QRIS static app (diawali tag 00/01).
    expect(chargeBody.data.qris_dynamic).toMatch(/^00020101/);
  });

  it('qris_static string kosong → 400 (hapus QRIS tidak diizinkan)', async () => {
    const { app, env, token } = await makeApp(authRoutesBase());
    const res = await app.request(
      '/app/workspaces/w1/apps/a1',
      putApp(token, { qris_static: '' }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('qris_static null → 400 (hapus QRIS tidak diizinkan)', async () => {
    const { app, env, token } = await makeApp(authRoutesBase());
    const res = await app.request(
      '/app/workspaces/w1/apps/a1',
      putApp(token, { qris_static: null }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });
});

describe('POST /app/workspaces/:wid/apps — qris_static wajib', () => {
  function postApp(token: string, body: unknown) {
    return {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  function createRoutes(): SqlRoute[] {
    return [
      ...authRoutesBase(),
      { match: 'SELECT tier FROM users WHERE id = ?', first: () => ({ tier: 'free' }) },
      {
        match: 'FROM tier_features WHERE tier = ?',
        first: () => ({
          tier: 'free',
          max_workspaces: 1,
          max_apps: 1,
          max_transactions_month: 300,
          max_transactions_per_day: 10,
          api_rate_limit: 10,
          callback_allowed: 0,
          callback_retry_count: 0,
          max_team_members: 1,
        }),
      },
      { match: 'FROM apps WHERE workspace_id = ?', all: () => [] },
      {
        match: 'INSERT INTO apps',
        first: (p) => ({
          ...APP_ROW,
          id: p[0] as string,
          qris_static: p[7] as string,
        }),
      },
    ];
  }

  it('tanpa qris_static → 400 validation_error', async () => {
    const { app, env, token } = await makeApp(authRoutesBase());
    const res = await app.request(
      '/app/workspaces/w1/apps',
      postApp(token, { name: 'Toko Saya' }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('qris_static invalid → 400 validation_error', async () => {
    const { app, env, token } = await makeApp(authRoutesBase());
    const res = await app.request(
      '/app/workspaces/w1/apps',
      postApp(token, { name: 'Toko Saya', qris_static: 'bukan-payload-qris' }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('qris_static valid → 201, qris_static tersimpan', async () => {
    const { app, env, token } = await makeApp(createRoutes());
    const res = await app.request(
      '/app/workspaces/w1/apps',
      postApp(token, { name: 'Toko Saya', qris_static: QRIS_STATIC }),
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { qris_static: string; api_key: string } };
    expect(body.data.qris_static).toBe(QRIS_STATIC);
    expect(body.data.api_key).toBeTruthy();
  });
});
