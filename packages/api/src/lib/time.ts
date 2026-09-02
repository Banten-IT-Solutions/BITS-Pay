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
