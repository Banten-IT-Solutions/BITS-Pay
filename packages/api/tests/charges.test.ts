import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Payment } from '@bits-pay/shared';
import { apiRoutes } from '../src/routes/api';
import { errorHandler } from '../src/middleware/error-handler';
import type { Env } from '../src/config';
import {
  mockDbDispatch,
  mockRateLimiter,
  mockEnv,
  type MockAppRow,
  type SqlRoute,
} from './mock-env';

const ACTIVE_APP: MockAppRow = { id: 'a1', workspace_id: 'w1', is_active: 1, api_rate_limit: 10 };
// QRIS static uji (sama dengan seed scripts/setup-local.mjs).
const QRIS_STATIC =
  '00020101021126640012ID.CO.BITS.WWW01189360091200008080240215BITS-PAY-TEST5204000053033605802ID5914BITS Pay Test6007Banten61053630062070703A016304';

const FREE_FEATURES = {
  tier: 'free',
  max_workspaces: 1,
  max_apps: 1,
  max_transactions_month: 300,
  max_transactions_per_day: 10,
  api_rate_limit: 10,
  callback_allowed: 0,
  callback_retry_count: 0,
  max_team_members: 1,
};

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    workspace_id: 'w1',
    app_id: 'a1',
    user_id: null,
    order_id: 'ORD-1',
    type: 'payment',
    amount: 150000,
    amount_due: 150042,
    unique_code: 42,
    currency: 'IDR',
    status: 'pending',
    qris_dynamic: 'qris-dynamic',
    qr_image: 'data:image/png;base64,x',
    proof_hash: null,
    proof_path: null,
    proof_mime: null,
    user_input_amount: null,
    ocr_amount: null,
    ocr_confidence: null,
    ocr_merchant: null,
    ocr_raw_text: null,
    ocr_provider: null,
    match_result: null,
    metadata: null,
    description: null,
    created_at: '2026-09-18 12:00:00',
    paid_at: null,
    expired_at: '2099-01-01 00:00:00',
    confirmed_at: null,
    confirmed_by: null,
    updated_at: '2026-09-18 12:00:00',
    ...overrides,
  };
}

interface QueueMessage {
  callbackId: string;
}

interface MakeAppOptions {
  routes: SqlRoute[];
  queueSent?: QueueMessage[];
}

function makeApp({ routes, queueSent }: MakeAppOptions) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.route('/v1', apiRoutes);
  const env = mockEnv({
    DB: mockDbDispatch(routes),
    RATE_LIMITER: mockRateLimiter({ allowed: true, remaining: 9, reset: Date.now() + 1000 }),
    QRIS_STATIC,
    MAX_UNIQUE_CODE: '999',
    TRANSACTION_EXPIRE_MINUTES: '15',
    CALLBACK_QUEUE: {
      send: (msg: QueueMessage) => {
        queueSent?.push(msg);
        return Promise.resolve();
      },
    },
  });
  const auth = { Authorization: 'Bearer sk_charges_test' };
  return { app, env, auth };
}

// Rute DB yang selalu dipakai: auth api-key + kuota tier.
function baseRoutes(): SqlRoute[] {
  return [
    { match: 'api_key_hash = ?', first: () => ACTIVE_APP },
    { match: 'FROM workspaces w JOIN users u', first: () => ({ user_id: 'u1', tier: 'free' }) },
    { match: 'FROM tier_features WHERE tier = ?', first: () => FREE_FEATURES },
    { match: "date(p.created_at) = date('now')", first: () => ({ c: 0 }) },
    { match: "strftime('%Y-%m', p.created_at)", first: () => ({ c: 0 }) },
  ];
}

function postCharge(auth: Record<string, string>, body: unknown) {
  return {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('POST /v1/charges', () => {
  it('happy path: 201 + envelope + amount_due = amount + unique_code + qr + expired ISO', async () => {
    // State idempotency: INSERT sukses → order_id dianggap terpakai.
    let orderExists = false;
    const routes: SqlRoute[] = [
      ...baseRoutes(),
      {
        match: 'SELECT id FROM payments WHERE app_id = ? AND order_id = ?',
        first: () => (orderExists ? { id: 'p-existing' } : null),
      },
      { match: 'SELECT unique_code FROM payments', all: () => [] },
      {
        match: 'INSERT INTO payments',
        first: (p) => {
          orderExists = true;
          return makePayment({
            id: p[0] as string,
            order_id: p[3] as string,
            amount: p[4] as number,
            amount_due: p[5] as number,
            unique_code: p[6] as number,
            currency: p[7] as string,
            qris_dynamic: p[10] as string,
            qr_image: p[11] as string,
            expired_at: p[12] as string,
          });
        },
      },
    ];
    const { app, env, auth } = makeApp({ routes });

    const res = await app.request(
      '/v1/charges',
      postCharge(auth, { order_id: 'ORD-1', amount: 150000 }),
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: Record<string, unknown>;
    };
    expect(body.success).toBe(true);
    const d = body.data;
    expect(d.id).toBeTypeOf('string');
    expect(d.amount).toBe(150000);
    // Tidak ada transaksi pending lain → kode unik pertama (1) terpakai.
    expect(d.unique_code).toBe(1);
    expect(d.amount_due).toBe(150001);
    expect(d.currency).toBe('IDR');
    expect(d.status).toBe('pending');
    expect(String(d.qr_image)).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(String(d.qris_dynamic)).toMatch(/^00020101/);

    const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    expect(String(d.expired_at)).toMatch(isoRe);
    expect(String(d.created_at)).toMatch(isoRe);
    // expired ±15 menit dari sekarang (TRANSACTION_EXPIRE_MINUTES=15).
    const expiredMs = Date.parse(d.expired_at as string);
    expect(expiredMs).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(expiredMs).toBeLessThan(Date.now() + 16 * 60 * 1000);

    // Idempotency: order_id sama → 409 duplicate_order (SELECT menemukan row aktif).
    const res2 = await app.request(
      '/v1/charges',
      postCharge(auth, { order_id: 'ORD-1', amount: 150000 }),
      env,
    );
    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as { success: boolean; error: { code: string } };
    expect(body2).toMatchObject({ success: false, error: { code: 'duplicate_order' } });
  });

  it('validasi gagal (amount < 100) → 400 validation_error', async () => {
    const { app, env, auth } = makeApp({ routes: baseRoutes() });
    const res = await app.request(
      '/v1/charges',
      postCharge(auth, { order_id: 'ORD-2', amount: 50 }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });
});

describe('POST /v1/charges/:id/cancel', () => {
  function cancelRoutes(payment: Payment | null, updateChanges: number): SqlRoute[] {
    return [
      { match: 'api_key_hash = ?', first: () => ACTIVE_APP },
      {
        match: 'SELECT * FROM payments WHERE id = ? AND workspace_id = ? AND app_id = ?',
        first: () => payment,
      },
      { match: "UPDATE payments SET status = 'expired'", run: () => updateChanges },
      {
        match: 'callback_queued = 0',
        first: () =>
          payment && {
            id: payment.id,
            app_id: payment.app_id,
            callback_url: 'https://merchant.example/hook',
            order_id: payment.order_id,
            amount: payment.amount,
            amount_due: payment.amount_due,
          },
      },
      { match: 'UPDATE payments SET callback_queued = 1', run: () => 1 },
      { match: 'INSERT INTO callbacks', run: () => 1 },
    ];
  }

  it('pending → 200 status expired + callback payment.expired ter-enqueue', async () => {
    const queueSent: QueueMessage[] = [];
    const { app, env, auth } = makeApp({
      routes: cancelRoutes(makePayment(), 1),
      queueSent,
    });
    const res = await app.request('/v1/charges/p1/cancel', { method: 'POST', headers: auth }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('expired');
    // Webhook expired masuk queue tepat sekali.
    expect(queueSent).toHaveLength(1);
    expect(queueSent[0].callbackId).toBeTypeOf('string');
  });

  it('sudah success (status final) → 409 invalid_status, tanpa enqueue', async () => {
    const queueSent: QueueMessage[] = [];
    const { app, env, auth } = makeApp({
      routes: cancelRoutes(makePayment({ status: 'success' }), 0),
      queueSent,
    });
    const res = await app.request('/v1/charges/p1/cancel', { method: 'POST', headers: auth }, env);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_status');
    expect(queueSent).toHaveLength(0);
  });

  it('payment milik app lain (SELECT null) → 404 not_found, tanpa enqueue', async () => {
    const queueSent: QueueMessage[] = [];
    const { app, env, auth } = makeApp({
      routes: cancelRoutes(null, 0),
      queueSent,
    });
    const res = await app.request(
      '/v1/charges/p-milik-orang/cancel',
      { method: 'POST', headers: auth },
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
    expect(queueSent).toHaveLength(0);
  });
});
