import { describe, it, expect } from 'vitest';
import { calculateAmountDue, findAvailableCode } from '../src/index';

describe('unique-code utils', () => {
  it('calculateAmountDue = amount + uniqueCode', () => {
    expect(calculateAmountDue(150000, 657)).toBe(150657);
    expect(calculateAmountDue(150000, 1)).toBe(150001);
  });

  it('findAvailableCode returns an unused code', () => {
    const used = [1, 2, 4];
    const code = findAvailableCode(used);
    expect(code).not.toBeNull();
    expect(used).not.toContain(code);
    expect(code).toBeGreaterThanOrEqual(1);
    expect(code).toBeLessThanOrEqual(999);
  });

  it('findAvailableCode varies the starting point (not always 001)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const code = findAvailableCode([]);
      expect(code).not.toBeNull();
      seen.add(code as number);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('findAvailableCode returns null when full', () => {
    expect(findAvailableCode([1], 1)).toBeNull();
  });
});
