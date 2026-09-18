// BITS Pay — Unique Code Utilities
// amount_due = amount + unique_code (range: 001–999)
// Catatan: amount_due tidak bisa di-decompose balik (penjumlahan ambigu).
// Selalu baca amount & unique_code dari kolom DB, jangan extract dari amount_due.

export function calculateAmountDue(amount: number, uniqueCode: number): number {
  return amount + uniqueCode;
}

/**
 * Cari kode unik yang available dari transaksi pending yang belum expired.
 * @param usedCodes - Array kode yang sedang dipakai transaksi pending
 * @param maxCode - Kode maksimal (default 999)
 * @returns Kode unik yang available, atau null jika penuh
 */
export function findAvailableCode(usedCodes: number[], maxCode = 999): number | null {
  if (usedCodes.length >= maxCode) return null;

  const usedSet = new Set(usedCodes);
  for (let code = 1; code <= maxCode; code++) {
    if (!usedSet.has(code)) return code;
  }
  return null;
}
