import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { userRateLimit } from '../src/middleware/rate-limit';
import { errorHandler } from '../src/middleware/error-handler';
import type { Env } from '../src/config';
import { mockEnv } from './mock-env';

interface Captured {
  key?: string;
  limit?: number;
}

// USER_LIMITS di middleware mirror seed tier_features (free 10 / premium 100 req/s).
// Test ini mengunci mapping tier → limit yang dikirim ke DO + header response.
function makeApp(tier: string, captured: Captured) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.use('/u/*', async (c, next) => {
    c.set('user', { id: 'u1', email: 'u@example.com', tier, token_version: 1 });
    await next();
  });
  app.use('/u/*', userRateLimit);
  app.get('/u/ping', (c) => c.json({ ok: true }));
  const env = mockEnv({
    RATE_LIMITER: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: (_url: string, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body)) as { key: string; limit: number };
          captured.key = body.key;
          captured.limit = body.limit;
          return Promise.resolve(
            Response.json({ allowed: true, remaining: body.limit - 1, reset: Date.now() + 1000 }),
          );
        },
      }),
    } as unknown as DurableObjectNamespace,
  });
  return { app, env };
}

describe('userRateLimit tier mapping', () => {
  it('tier free → limit 10 req/s, key user:<id>', async () => {
    const captured: Captured = {};
    const { app, env } = makeApp('free', captured);
    const res = await app.request('/u/ping', {}, env);
    expect(res.status).toBe(200);
    expect(captured.key).toBe('user:u1');
    expect(captured.limit).toBe(10);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
  });

  it('tier premium → limit 100 req/s', async () => {
    const captured: Captured = {};
    const { app, env } = makeApp('premium', captured);
    const res = await app.request('/u/ping', {}, env);
    expect(res.status).toBe(200);
    expect(captured.limit).toBe(100);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
  });

  it('tier tak dikenal → fallback limit free (10)', async () => {
    const captured: Captured = {};
    const { app, env } = makeApp('enterprise', captured);
    const res = await app.request('/u/ping', {}, env);
    expect(res.status).toBe(200);
    expect(captured.limit).toBe(10);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
  });
});
