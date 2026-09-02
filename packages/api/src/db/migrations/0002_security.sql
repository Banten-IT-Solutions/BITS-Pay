-- BITS Pay — Security hardening
-- Migration 0002: callback HMAC secret terpisah + JWT revocation
-- Apply: wrangler d1 migrations apply DB --local

-- HMAC signature callback memakai secret sendiri, lepas dari api_key_hash.
-- Alasan: rotate API key TIDAK boleh memutus callback existing.
ALTER TABLE apps ADD COLUMN callback_secret TEXT;

-- Bump token_version untuk invalidate semua JWT user (logout-all / suspend).
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- One-time code OAuth: JWT tidak lagi lewat query string.
CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0,1)),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON auth_codes(code);