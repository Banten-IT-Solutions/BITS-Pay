// BITS Pay — Unique Code Utilities
// amount_due = amount + unique_code (range: 001–999)
// Catatan: amount_due tidak bisa di-decompose balik (penjumlahan ambigu).
// Selalu baca amount & unique_code dari kolom DB, jangan extract dari amount_due.

export function calculateAmountDue(amount: number, uniqueCode: number): number {
  return amount + uniqueCode;
}

/**
 * Cari kode unik yang available dari transaksi pending yang belum expired.
 * Titik mulai diacak agar tidak selalu kode terkecil (001) saat tidak ada
 * transaksi pending. Jaminan tetap: kode yang dikembalikan belum dipakai.
 * @param usedCodes - Array kode yang sedang dipakai transaksi pending
 * @param maxCode - Kode maksimal (default 999)
 * @returns Kode unik yang available, atau null jika penuh
 */
export function findAvailableCode(usedCodes: number[], maxCode = 999): number | null {
  const usedSet = new Set(usedCodes);
  if (usedSet.size >= maxCode) return null;

  const start = 1 + Math.floor(Math.random() * maxCode);
  for (let i = 0; i < maxCode; i++) {
    const code = ((start - 1 + i) % maxCode) + 1;
    if (!usedSet.has(code)) return code;
  }
  return null;
}
