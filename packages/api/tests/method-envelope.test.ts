import { describe, it, expect } from 'vitest';
import app from '../src/index';
import { mockDb, mockRateLimiter, mockEnv, type MockAppRow } from './mock-env';

// App entry asli (index.ts): method salah pada path yang ada harus tetap
// menjawab envelope JSON { success: false, error } — bukan plain text Hono.
// Hono 4 tidak punya 405 bawaan: path match method beda → notFound (404).
// Catatan: /v1/* punya middleware auth `*` (method-agnostic) → tanpa auth
// salah method terjawab 401 duluan, bukan 404. Keduanya envelope JSON.
const ACTIVE_APP: MockAppRow = { id: 'a1', workspace_id: 'w1', is_active: 1, api_rate_limit: 10 };
const env = mockEnv({
  JWT_SECRET: 'test-secret-key-minimal-32-karakter!!',
  APP_URL: 'http://localhost:7002',
  DB: mockDb(ACTIVE_APP),
  RATE_LIMITER: mockRateLimiter({ allowed: true, remaining: 9, reset: Date.now() + 1000 }),
});
const auth = { Authorization: 'Bearer sk_method_test' };

async function expectJsonEnvelope(res: Response) {
  expect(res.headers.get('content-type')).toContain('application/json');
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  expect(body.success).toBe(false);
  expect(body.error.code).toBeTypeOf('string');
  return body;
}

describe('method salah pada route yang ada', () => {
  it('GET /v1/charges tanpa auth → 401 envelope (middleware auth jalan sebelum route match)', async () => {
    const res = await app.request('/v1/charges', { method: 'GET' }, env);
    expect(res.status).toBe(401);
    const body = await expectJsonEnvelope(res);
    expect(body.error.code).toBe('unauthorized');
  });

  it('GET /v1/charges dengan auth valid → 404 envelope not_found', async () => {
    const res = await app.request('/v1/charges', { method: 'GET', headers: auth }, env);
    expect(res.status).toBe(404);
    const body = await expectJsonEnvelope(res);
    expect(body.error.code).toBe('not_found');
  });

  it('DELETE /v1/payments/p1 (hanya GET/POST) dengan auth → 404 envelope', async () => {
    const res = await app.request('/v1/payments/p1', { method: 'DELETE', headers: auth }, env);
    expect(res.status).toBe(404);
    await expectJsonEnvelope(res);
  });

  it('POST /health (hanya GET) → 404 envelope JSON', async () => {
    const res = await app.request('/health', { method: 'POST' }, env);
    expect(res.status).toBe(404);
    await expectJsonEnvelope(res);
  });

  it('path tidak dikenal → 404 envelope JSON (bukan text Hono default)', async () => {
    const res = await app.request('/tidak-ada', {}, env);
    expect(res.status).toBe(404);
    await expectJsonEnvelope(res);
  });
});
