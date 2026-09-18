import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireApiKey } from '../src/middleware/api-key';
import { errorHandler } from '../src/middleware/error-handler';
import type { Env } from '../src/config';
import { mockDb, mockEnv, type MockAppRow } from './mock-env';

const ACTIVE_APP: MockAppRow = { id: 'a1', workspace_id: 'w1', is_active: 1, api_rate_limit: 10 };

function makeApp(dbRow: unknown) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.use('/v1/*', requireApiKey);
  app.get('/v1/ping', (c) => c.json({ ok: true, appId: c.get('app').id }));
  const env = mockEnv({ DB: mockDb(dbRow) });
  return { app, env };
}

async function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
  const body = (await res.json()) as { success: boolean; error: { code: string } };
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('unauthorized');
}

describe('requireApiKey', () => {
  it('tanpa Authorization → 401 + WWW-Authenticate: Bearer', async () => {
    const { app, env } = makeApp(ACTIVE_APP);
    await expectUnauthorized(await app.request('/v1/ping', {}, env));
  });

  it('scheme salah (Basic / Bearer non-sk_) → 401 + WWW-Authenticate', async () => {
    const { app, env } = makeApp(ACTIVE_APP);
    await expectUnauthorized(
      await app.request('/v1/ping', { headers: { Authorization: 'Basic sk_x' } }, env),
    );
    await expectUnauthorized(
      await app.request('/v1/ping', { headers: { Authorization: 'Bearer abc123' } }, env),
    );
  });

  it('key tak dikenal (DB null) → 401 + WWW-Authenticate', async () => {
    const { app, env } = makeApp(null);
    await expectUnauthorized(
      await app.request('/v1/ping', { headers: { Authorization: 'Bearer sk_unknown' } }, env),
    );
  });

  it('app nonaktif → 401 + WWW-Authenticate', async () => {
    const { app, env } = makeApp({ ...ACTIVE_APP, is_active: 0 });
    await expectUnauthorized(
      await app.request('/v1/ping', { headers: { Authorization: 'Bearer sk_dead' } }, env),
    );
  });

  it('key valid + app aktif → 200, context app terisi', async () => {
    const { app, env } = makeApp(ACTIVE_APP);
    const res = await app.request(
      '/v1/ping',
      { headers: { Authorization: 'Bearer sk_live_ok' } },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; appId: string };
    expect(body).toEqual({ ok: true, appId: 'a1' });
  });
});
