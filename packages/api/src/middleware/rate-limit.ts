import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../config';
import { AppError } from '../lib/errors';

const WINDOW_MS = 1000;
const PUBLIC_LIMIT = 10;
const API_LIMIT = 10;
const USER_LIMITS: Record<string, number> = { free: 10, premium: 100 };

interface CheckResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

async function check(env: Env, key: string, limit: number): Promise<CheckResult> {
  const fallback: CheckResult = { allowed: true, remaining: limit, reset: Date.now() + WINDOW_MS };
  try {
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(key));
    const res = await stub.fetch('https://rate-limiter.internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, limit, windowMs: WINDOW_MS }),
    });
    if (!res.ok) return fallback;
    return (await res.json()) as CheckResult;
  } catch {
    // Fail-open: DO error jangan blokir traffic
    return fallback;
  }
}

function build(keyFn: (c: Context) => { key: string; limit: number }) {
  return createMiddleware(async (c, next) => {
    const { key, limit } = keyFn(c);
    const env: Env = c.env;
    const result = await check(env, key, limit);
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));
    if (!result.allowed) {
      throw AppError.tooMany(`Rate limit ${limit} req/s tercapai, coba lagi sesaat`);
    }
    await next();
  });
}

// Endpoint publik (auth): per IP + path
export const publicRateLimit = build((c) => ({
  key: `${c.req.header('CF-Connecting-IP') ?? 'unknown'}:${c.req.path}`,
  limit: PUBLIC_LIMIT,
}));

// Route authenticated non-/v1: per user, limit by tier
export const userRateLimit = build((c) => {
  const user = c.get('user');
  return { key: `user:${user.id}`, limit: USER_LIMITS[user.tier] ?? USER_LIMITS.free };
});

// Route /v1: per app.
// ponytail: limit hardcoded; ceiling = tier_features.api_rate_limit per workspace.
// Upgrade path: baca tier_features di requireApiKey, pass via context.
export const apiRateLimit = build((c) => ({ key: `app:${c.get('app').id}`, limit: API_LIMIT }));
