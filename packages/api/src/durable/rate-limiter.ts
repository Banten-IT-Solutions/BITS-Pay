import { DurableObject } from 'cloudflare:workers';
import { tickBucket, type RateBucket } from './window';

interface CheckRequest {
  key: string;
  limit: number;
  windowMs: number;
}

// Fixed-window rate limiter. State in-memory per DO instance (soft limit —
// DO restart boleh reset counter). Di-shard via idFromName(key).
export class RateLimiter extends DurableObject {
  private buckets = new Map<string, RateBucket>();

  async fetch(request: Request): Promise<Response> {
    const { key, limit, windowMs } = (await request.json()) as CheckRequest;
    const now = Date.now();

    const result = tickBucket(this.buckets.get(key), now, windowMs, limit);
    this.buckets.set(key, result.bucket);

    // Guard memory growth — shard per key, tapi tetap jaga-jaga
    if (this.buckets.size > 1000) {
      for (const [k, b] of this.buckets) {
        if (now >= b.reset) this.buckets.delete(k);
      }
      if (this.buckets.size > 1000) this.buckets.clear();
    }

    return Response.json({
      allowed: result.allowed,
      remaining: result.remaining,
      reset: result.bucket.reset,
    });
  }
}
