import { describe, it, expect } from 'vitest';
import { calculateAmountDue, findAvailableCode } from '../src/index';

describe('unique-code utils', () => {
  it('calculateAmountDue = amount + uniqueCode', () => {
    expect(calculateAmountDue(150000, 657)).toBe(150657);
    expect(calculateAmountDue(150000, 1)).toBe(150001);
  });

  it('findAvailableCode returns first unused code', () => {
    expect(findAvailableCode([1, 2, 4])).toBe(3);
  });

  it('findAvailableCode returns null when full', () => {
    expect(findAvailableCode([1], 1)).toBeNull();
  });
});
