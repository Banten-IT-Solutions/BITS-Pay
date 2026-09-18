import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { apiRoutes } from '../src/routes/api';
import { errorHandler } from '../src/middleware/error-handler';
import { AppError } from '../src/lib/errors';
import type { Env } from '../src/config';
import { mockDb, mockRateLimiter, mockEnv, type MockAppRow } from './mock-env';

const ACTIVE_APP: MockAppRow = { id: 'a1', workspace_id: 'w1', is_active: 1, api_rate_limit: 1000 };
const MAX_CHARGE_BODY = 64 * 1024;
const MAX_CONFIRM_BODY = 5 * 1024 * 1024 + 1024 * 1024;

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.route('/v1', apiRoutes);
  const env = mockEnv({
    DB: mockDb(ACTIVE_APP),
    RATE_LIMITER: mockRateLimiter({ allowed: true, remaining: 999, reset: Date.now() + 1000 }),
  });
  const auth = { Authorization: 'Bearer sk_gate_test' };
  return { app, env, auth };
}

async function expectPayloadTooLarge(res: Response) {
  expect(res.status).toBe(413);
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  expect(body).toMatchObject({ success: false, error: { code: 'payload_too_large' } });
}

describe('AppError.payloadTooLarge', () => {
  it('413 + code payload_too_large', () => {
    const err = AppError.payloadTooLarge();
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe('payload_too_large');
  });

  it('custom message dipakai', () => {
    expect(AppError.payloadTooLarge('Body maksimal 64KB').message).toBe('Body maksimal 64KB');
  });
});

describe('content-length gate', () => {
  it('POST /v1/charges >64KB → 413 payload_too_large', async () => {
    const { app, env, auth } = makeApp();
    const res = await app.request(
      '/v1/charges',
      {
        method: 'POST',
        headers: { ...auth, 'content-length': String(MAX_CHARGE_BODY + 1) },
        body: 'x',
      },
      env,
    );
    await expectPayloadTooLarge(res);
  });

  it('POST /v1/charges tepat 64KB → lolos gate (400 validasi, bukan 413)', async () => {
    const { app, env, auth } = makeApp();
    const res = await app.request(
      '/v1/charges',
      {
        method: 'POST',
        headers: {
          ...auth,
          'content-type': 'application/json',
          'content-length': String(MAX_CHARGE_BODY),
        },
        body: '{}',
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('POST /v1/payments/:id/confirm >6MB → 413 payload_too_large', async () => {
    const { app, env, auth } = makeApp();
    const res = await app.request(
      '/v1/payments/p1/confirm',
      {
        method: 'POST',
        headers: { ...auth, 'content-length': String(MAX_CONFIRM_BODY + 1) },
        body: 'x',
      },
      env,
    );
    await expectPayloadTooLarge(res);
  });

  it('POST /v1/payments/:id/confirm tepat 6MB → lolos gate (400 amount wajib, bukan 413)', async () => {
    const { app, env, auth } = makeApp();
    const res = await app.request(
      '/v1/payments/p1/confirm',
      {
        method: 'POST',
        headers: {
          ...auth,
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': String(MAX_CONFIRM_BODY),
        },
        body: '',
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });
});
