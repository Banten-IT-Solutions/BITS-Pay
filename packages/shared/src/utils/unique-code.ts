// BITS Pay — Unique Code Utilities
// amount_due = amount × 10000 + unique_code (range: 0001–9999)

export function calculateAmountDue(amount: number, uniqueCode: number): number {
  return amount * 10000 + uniqueCode;
}

export function extractAmount(amountDue: number): number {
  return Math.floor(amountDue / 10000);
}

export function extractUniqueCode(amountDue: number): number {
  return amountDue % 10000;
}

/**
 * Cari kode unik yang available dari transaksi pending yang belum expired.
 * @param usedCodes - Array kode yang sedang dipakai transaksi pending
 * @param maxCode - Kode maksimal (default 9999)
 * @returns Kode unik yang available, atau null jika penuh
 */
export function findAvailableCode(
  usedCodes: number[],
  maxCode = 9999,
): number | null {
  if (usedCodes.length >= maxCode) return null;

  const usedSet = new Set(usedCodes);
  for (let code = 1; code <= maxCode; code++) {
    if (!usedSet.has(code)) return code;
  }
  return null;
}