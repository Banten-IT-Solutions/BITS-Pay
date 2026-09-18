// BITS Pay — Display Formatters

/** Format nominal untuk tampilan: 150657 → "150.657" (pemisah ribuan titik, tanpa prefix) */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('id-ID');
}
