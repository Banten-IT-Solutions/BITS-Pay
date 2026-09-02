import { describe, it, expect } from 'vitest';
import {
  calculateAmountDue,
  extractAmount,
  extractUniqueCode,
  findAvailableCode,
} from '@bits-pay/shared';

describe('unique-code utils', () => {
  it('calculateAmountDue = amount * 10000 + uniqueCode', () => {
    expect(calculateAmountDue(150000, 1)).toBe(1500000001);
  });

  it('extractAmount dan extractUniqueCode round-trip', () => {
    const amountDue = calculateAmountDue(150000, 9999);
    expect(extractAmount(amountDue)).toBe(150000);
    expect(extractUniqueCode(amountDue)).toBe(9999);
  });

  it('findAvailableCode returns first unused code', () => {
    expect(findAvailableCode([1, 2, 4])).toBe(3);
  });

  it('findAvailableCode returns null when full', () => {
    expect(findAvailableCode([1], 1)).toBeNull();
  });
});
