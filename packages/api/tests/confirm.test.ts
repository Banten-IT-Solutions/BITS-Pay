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

// PNG minimal: cukup magic bytes (validator hanya sniff 4 byte pertama).
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  payment: Payment | null;
  /** OCR amount yang "terbaca" Workers AI. */
  ocrAmount?: number;
  /** callback resolveTarget: true = app boleh menerima webhook. */
  callbackAllowed?: boolean;
  queueSent?: QueueMessage[];
}

function makeApp({ payment, ocrAmount, callbackAllowed, queueSent }: MakeAppOptions) {
  const routes: SqlRoute[] = [
    { match: 'api_key_hash = ?', first: () => ACTIVE_APP },
    {
      match: 'SELECT * FROM payments WHERE id = ? AND workspace_id = ? AND app_id = ?',
      first: () => payment,
    },
    { match: 'SELECT id FROM payments WHERE proof_hash = ?', first: () => null },
    // getOcrProvider: config kosong → default provider workers-ai (env.AI mock di bawah).
    { match: "SELECT value FROM config WHERE key = 'ocr_provider'", first: () => null },
    {
      match: 'UPDATE payments SET',
      run: () => 1,
    },
    // activateFromInvoice: type 'payment' → early return.
    { match: 'SELECT * FROM payments WHERE id = ?', first: () => payment },
    {
      match: 'SELECT a.callback_url',
      first: () =>
        callbackAllowed
          ? { callback_url: 'https://merchant.example/hook', is_active: 1, allowed: 1 }
          : null,
    },
    { match: 'INSERT INTO callbacks', run: () => 1 },
  ];
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.route('/v1', apiRoutes);
  const env = mockEnv({
    DB: mockDbDispatch(routes),
    RATE_LIMITER: mockRateLimiter({ allowed: true, remaining: 9, reset: Date.now() + 1000 }),
    OCR_CONFIDENCE_THRESHOLD: '85',
    R2: {
      put: () => Promise.resolve({}),
      delete: () => Promise.resolve(),
    },
    AI: {
      run: () =>
        Promise.resolve({
          response: JSON.stringify({ amount: ocrAmount ?? null, confidence: 95, merchant: 'BCA' }),
        }),
    },
    CALLBACK_QUEUE: {
      send: (msg: QueueMessage) => {
        queueSent?.push(msg);
        return Promise.resolve();
      },
    },
  });
  const auth = { Authorization: 'Bearer sk_confirm_test' };
  return { app, env, auth };
}

function confirmForm(amount: string, withProof: boolean): FormData {
  const fd = new FormData();
  fd.append('amount', amount);
  if (withProof) {
    fd.append('proof_image', new File([PNG_BYTES], 'proof.png', { type: 'image/png' }));
  }
  return fd;
}

describe('POST /v1/payments/:id/confirm', () => {
  it('OCR match (amount = amount_due, confidence ≥ threshold) → 200 success + webhook ter-enqueue', async () => {
    const queueSent: QueueMessage[] = [];
    const { app, env, auth } = makeApp({
      payment: makePayment(),
      ocrAmount: 150042,
      callbackAllowed: true,
      queueSent,
    });
    const res = await app.request(
      '/v1/payments/p1/confirm',
      { method: 'POST', headers: auth, body: confirmForm('150042', true) },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        status: string;
        match_result: string;
        ocr_amount: number;
        ocr_confidence: number;
        paid_at: string | null;
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('success');
    expect(body.data.match_result).toBe('auto_confirm');
    expect(body.data.ocr_amount).toBe(150042);
    expect(body.data.ocr_confidence).toBe(95);
    expect(body.data.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(queueSent).toHaveLength(1);
  });

  it('amount input ≠ amount_due → 200 data.status failed (mismatch), tanpa OCR', async () => {
    const queueSent: QueueMessage[] = [];
    const { app, env, auth } = makeApp({ payment: makePayment(), queueSent });
    const res = await app.request(
      '/v1/payments/p1/confirm',
      { method: 'POST', headers: auth, body: confirmForm('150000', false) },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { status: string; match_result: string; ocr_amount: number | null; message?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('failed');
    expect(body.data.match_result).toBe('mismatch');
    expect(body.data.ocr_amount).toBeNull();
    expect(body.data.message).toBe('Nominal tidak cocok');
    // resolveTarget null (tier free / tanpa callback_url) → tidak ada webhook.
    expect(queueSent).toHaveLength(0);
  });

  it('payment bukan pending (sudah success) → 400 invalid_status', async () => {
    const { app, env, auth } = makeApp({ payment: makePayment({ status: 'success' }) });
    const res = await app.request(
      '/v1/payments/p1/confirm',
      { method: 'POST', headers: auth, body: confirmForm('150042', true) },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body).toMatchObject({ success: false, error: { code: 'invalid_status' } });
  });

  it('payment milik app lain → 404 not_found', async () => {
    const { app, env, auth } = makeApp({ payment: null });
    const res = await app.request(
      '/v1/payments/p-lain/confirm',
      { method: 'POST', headers: auth, body: confirmForm('150042', true) },
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });
});
