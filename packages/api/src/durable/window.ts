// Fixed-window rate-limit core. Pure + testable (no cloudflare import).
export interface RateBucket {
  count: number;
  reset: number;
}

export interface RateResult {
  bucket: RateBucket;
  allowed: boolean;
  remaining: number;
}

export function tickBucket(
  bucket: RateBucket | undefined,
  now: number,
  windowMs: number,
  limit: number,
): RateResult {
  const next: RateBucket =
    !bucket || now >= bucket.reset
      ? { count: 1, reset: now + windowMs }
      : { count: bucket.count + 1, reset: bucket.reset };
  return {
    bucket: next,
    allowed: next.count <= limit,
    remaining: Math.max(0, limit - next.count),
  };
}
