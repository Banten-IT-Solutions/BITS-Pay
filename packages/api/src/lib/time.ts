/**
 * Timestamp dalam format SQLite (YYYY-MM-DD HH:MM:SS, UTC) supaya
 * bisa dibandingkan langsung dengan `datetime('now')` / `date('now')`.
 *
 * JANGAN simpan `toISOString()` (format `...T...Z`) untuk kolom yang
 * dibandingkan dengan `datetime('now')` — string compare akan meleset.
 */
export function dbTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Konversi timestamp DB ("YYYY-MM-DD HH:MM:SS", UTC) → ISO-8601
 * ("YYYY-MM-DDTHH:MM:SSZ") untuk output PUBLIC API. Data DB sudah UTC
 * (dbTime / datetime('now')), jadi cukup ganti spasi + suffix Z.
 * Jangan dipakai untuk nilai yang ditulis balik ke DB.
 */
export function toIso(s: string): string;
export function toIso(s: string | null): string | null;
export function toIso(s: string | null): string | null {
  if (!s) return null;
  return s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
}
