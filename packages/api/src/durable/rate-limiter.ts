import { DurableObject } from 'cloudflare:workers';

interface Bucket {
  count: number;
  reset: number;
}

interface CheckRequest {
  key: string;
  limit: number;
  windowMs: number;
}

// Fixed-window rate limiter. State in-memory per DO instance (soft limit —
// DO restart boleh reset counter). Di-shard via idFromName(key).
export class RateLimiter extends DurableObject {
  private buckets = new Map<string, Bucket>();

  async fetch(request: Request): Promise<Response> {
    const { key, limit, windowMs } = (await request.json()) as CheckRequest;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Guard memory growth — shard per key, tapi tetap jaga-jaga
    if (this.buckets.size > 1000) {
      for (const [k, b] of this.buckets) {
        if (now >= b.reset) this.buckets.delete(k);
      }
      if (this.buckets.size > 1000) this.buckets.clear();
    }

    const allowed = bucket.count <= limit;
    const remaining = Math.max(0, limit - bucket.count);
    return Response.json({ allowed, remaining, reset: bucket.reset });
  }
}
