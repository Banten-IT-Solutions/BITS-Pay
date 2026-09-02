-- Lockout brute force login per akun (email).
-- failed_count di-reset ke 0 saat lock dipasang; locked_until format dbTime
-- (YYYY-MM-DD HH:MM:SS UTC) supaya string-compare dengan datetime('now') valid.
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
