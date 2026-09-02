import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';

// ponytail: in-memory per-isolate limiter; ceiling = inconsistent across isolates.
// Upgrade path: KV / Rate Limiting binding / Durable Object untuk counter terdistribusi.
const WINDOW_MS = 1000;
const buckets = new Map<string, { count: number; reset: number }>();

const LIMITS: Record<string, number> = { free: 10, premium: 100 };

export const rateLimit = createMiddleware(async (c, next) => {
  const user = c.get('user');
  const limit = LIMITS[user?.tier ?? 'free'] ?? 10;
  const key = `${c.req.header('CF-Connecting-IP') ?? 'unknown'}:${c.req.path}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (buckets.size > 10000) buckets.clear(); // guard memory growth

  const remaining = Math.max(0, limit - bucket.count);
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(bucket.reset / 1000)));

  if (bucket.count > limit) {
    throw AppError.tooMany(`Rate limit ${limit} req/s tercapai, coba lagi sesaat`);
  }
  await next();
});
