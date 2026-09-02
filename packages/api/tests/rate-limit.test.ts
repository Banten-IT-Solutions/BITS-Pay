import { describe, it, expect } from 'vitest';
import { tickBucket } from '../src/durable/window';

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
