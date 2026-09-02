import { describe, it, expect } from 'vitest';
import { signCallbackPayload } from '@bits-pay/shared';

const HEX_64 = /^[0-9a-f]{64}$/;

describe('signCallbackPayload', () => {
  it('deterministic: panggil 2x hasil sama', async () => {
    const a = await signCallbackPayload('{"order_id":"ord_1"}', 'secret');
    const b = await signCallbackPayload('{"order_id":"ord_1"}', 'secret');
    expect(a).toBe(b);
  });

  it('return hex HMAC-SHA256: 64 char lowercase hex', async () => {
    const sig = await signCallbackPayload('payload', 'secret');
    expect(sig).toMatch(HEX_64);
  });

  it('secret berbeda → signature berbeda', async () => {
    const a = await signCallbackPayload('payload', 'secret-1');
    const b = await signCallbackPayload('payload', 'secret-2');
    expect(a).not.toBe(b);
  });

  it('payload berbeda → signature berbeda', async () => {
    const a = await signCallbackPayload('payload-1', 'secret');
    const b = await signCallbackPayload('payload-2', 'secret');
    expect(a).not.toBe(b);
  });

  it('cocok dengan HMAC-SHA256 manual via Web Crypto', async () => {
    const payload = '{"order_id":"ord_42","amount":1500000001}';
    const secret = 'callback-secret';

    const expected = await signCallbackPayload(payload, secret);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const buf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const manual = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(expected).toBe(manual);
  });
});
