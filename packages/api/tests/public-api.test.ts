import { describe, it, expect } from 'vitest';
import type { Payment } from '@bits-pay/shared';
import { toIso } from '../src/lib/time';
import { toPublicPayment } from '../src/services/payment';

describe('toIso', () => {
  it('konversi format DB UTC → ISO-8601 Z', () => {
    expect(toIso('2026-09-18 12:30:00')).toBe('2026-09-18T12:30:00Z');
  });

  it('null tetap null', () => {
    expect(toIso(null)).toBeNull();
  });

  it('string sudah ISO (mengandung T) → tidak diubah', () => {
    expect(toIso('2026-09-18T12:30:00Z')).toBe('2026-09-18T12:30:00Z');
    expect(toIso('2026-09-18T12:30:00.123Z')).toBe('2026-09-18T12:30:00.123Z');
  });

  it('string kosong → null', () => {
    expect(toIso('')).toBeNull();
  });
});

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    workspace_id: 'w1',
    app_id: 'a1',
    user_id: null,
    order_id: 'ORD-1',
    type: 'payment',
    amount: 150000,
    amount_due: 150001,
    unique_code: 1,
    currency: 'IDR',
    status: 'success',
    qris_dynamic: 'qris',
    qr_image: 'data:image/png;base64,x',
    proof_hash: 'hash',
    proof_path: 'proofs/p1/x',
    proof_mime: 'image/jpeg',
    user_input_amount: 150001,
    ocr_amount: 150001,
    ocr_confidence: 91,
    ocr_merchant: 'm',
    ocr_raw_text: 'raw',
    ocr_provider: 'workers-ai',
    match_result: 'auto_confirm',
    metadata: '{"ref":"A1"}',
    description: 'desc',
    created_at: '2026-09-18 12:00:00',
    paid_at: '2026-09-18 12:05:00',
    expired_at: '2026-09-18 12:15:00',
    confirmed_at: '2026-09-18 12:05:00',
    confirmed_by: null,
    updated_at: '2026-09-18 12:05:00',
    ...overrides,
  };
}

describe('toPublicPayment', () => {
  it('hanya expose field curated, metadata diparse, timestamp ISO', () => {
    const pub = toPublicPayment(makePayment());
    expect(pub).toEqual({
      id: 'p1',
      order_id: 'ORD-1',
      amount: 150000,
      unique_code: 1,
      amount_due: 150001,
      currency: 'IDR',
      status: 'success',
      description: 'desc',
      metadata: { ref: 'A1' },
      paid_at: '2026-09-18T12:05:00Z',
      expired_at: '2026-09-18T12:15:00Z',
      created_at: '2026-09-18T12:00:00Z',
    });
    expect(pub).not.toHaveProperty('proof_path');
    expect(pub).not.toHaveProperty('ocr_raw_text');
    expect(pub).not.toHaveProperty('user_input_amount');
  });

  it('metadata korup/non-object → null', () => {
    expect(toPublicPayment(makePayment({ metadata: '{broken' })).metadata).toBeNull();
    expect(toPublicPayment(makePayment({ metadata: '[1,2]' })).metadata).toBeNull();
    expect(toPublicPayment(makePayment({ metadata: null })).metadata).toBeNull();
  });
});
