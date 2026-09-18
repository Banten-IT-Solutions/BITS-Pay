import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { tickBucket } from '../src/durable/window';
import { publicRateLimit } from '../src/middleware/rate-limit';
import { errorHandler } from '../src/middleware/error-handler';
import type { Env } from '../src/config';
import { mockRateLimiter, mockEnv, type RateLimitResult } from './mock-env';

describe('rate-limit fixed window', () => {
  it('starts count at 1 and allows within limit', () => {
    const r = tickBucket(undefined, 1000, 1000, 10);
    expect(r.bucket.count).toBe(1);
    expect(r.bucket.reset).toBe(2000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it('increments within same window', () => {
    const first = tickBucket(undefined, 1000, 1000, 2);
    const r = tickBucket(first.bucket, 1500, 1000, 2);
    expect(r.bucket.count).toBe(2);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('rejects beyond limit', () => {
    const first = tickBucket(undefined, 1000, 1000, 1);
    const r = tickBucket(first.bucket, 1500, 1000, 1);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('resets bucket after window passes', () => {
    const first = tickBucket(undefined, 1000, 1000, 10);
    const r = tickBucket(first.bucket, 2500, 1000, 10);
    expect(r.bucket.count).toBe(1);
    expect(r.bucket.reset).toBe(3500);
    expect(r.allowed).toBe(true);
  });
});

function makeRateApp(result: RateLimitResult | Error) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError(errorHandler);
  app.use('/pub/*', publicRateLimit);
  app.get('/pub/x', (c) => c.json({ ok: true }));
  const env = mockEnv({ RATE_LIMITER: mockRateLimiter(result) });
  return { app, env };
}

describe('rate-limit middleware headers', () => {
  it('allowed → 200 + X-RateLimit-* terisi', async () => {
    const { app, env } = makeRateApp({ allowed: true, remaining: 9, reset: 1_800_000_000_000 });
    const res = await app.request('/pub/x', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('1800000000');
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('blocked → 429 + Retry-After detik integer + X-RateLimit-* tetap ada', async () => {
    const { app, env } = makeRateApp({ allowed: false, remaining: 0, reset: Date.now() + 1500 });
    const res = await app.request('/pub/x', {}, env);
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body).toMatchObject({ success: false, error: { code: 'rate_limited' } });
  });

  it('Retry-After minimal 1 walau reset sudah lewat', async () => {
    const { app, env } = makeRateApp({ allowed: false, remaining: 0, reset: Date.now() - 10 });
    const res = await app.request('/pub/x', {}, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1');
  });

  it('DO error → fail-open 200, header limit tetap ada', async () => {
    const { app, env } = makeRateApp(new Error('DO down'));
    const res = await app.request('/pub/x', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
  });
});
