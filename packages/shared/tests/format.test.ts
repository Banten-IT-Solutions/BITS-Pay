import { describe, it, expect } from 'vitest';
import { formatAmount } from '../src/index';

describe('formatAmount', () => {
  it('format dengan pemisah ribuan titik, tanpa prefix', () => {
    expect(formatAmount(150657)).toBe('150.657');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(1000000000)).toBe('1.000.000.000');
  });
});
