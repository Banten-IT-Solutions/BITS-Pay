import { describe, it, expect } from 'vitest';
import type { Callback } from '@bits-pay/shared';
import { toPublicCallback } from '../src/services/callback';

function makeCallback(overrides: Partial<Callback> = {}): Callback {
  return {
    id: 'cb1',
    payment_id: 'p1',
    app_id: 'a1',
    url: 'https://merchant.example/hook',
    event: 'payment.success',
    payload: '{"event":"payment.success"}',
    response_code: 200,
    response_body: '{"ok":true}',
    status: 'failed',
    attempt: 2,
    max_attempts: 3,
    next_retry_at: '2026-09-18 12:10:00',
    last_error: 'HTTP 500',
    created_at: '2026-09-18 12:00:00',
    updated_at: '2026-09-18 12:05:00',
    ...overrides,
  };
}

describe('toPublicCallback', () => {
  it('hanya expose field curated, timestamp ISO', () => {
    const pub = toPublicCallback(makeCallback());
    expect(pub).toEqual({
      id: 'cb1',
      payment_id: 'p1',
      event: 'payment.success',
      url: 'https://merchant.example/hook',
      status: 'failed',
      attempts: 2,
      max_attempts: 3,
      response_code: 200,
      next_retry_at: '2026-09-18T12:10:00Z',
      created_at: '2026-09-18T12:00:00Z',
      updated_at: '2026-09-18T12:05:00Z',
    });
    expect(pub).not.toHaveProperty('payload');
    expect(pub).not.toHaveProperty('response_body');
    expect(pub).not.toHaveProperty('last_error');
  });

  it('updated_at null (row lama/INSERT baru) → fallback created_at', () => {
    const pub = toPublicCallback(makeCallback({ updated_at: null }));
    expect(pub.updated_at).toBe('2026-09-18T12:00:00Z');
  });
});
