-- BITS Pay — Kolom updated_at di callbacks
-- Migration 0010: DTO publik GET /v1/callbacks mengekspos updated_at, tapi
-- kolom belum ada. SQLite larang DEFAULT non-konstan di ALTER TABLE →
-- nullable + backfill dari created_at. Writer di CallbackService ikut diset.
ALTER TABLE callbacks ADD COLUMN updated_at TEXT;
UPDATE callbacks SET updated_at = created_at WHERE updated_at IS NULL;
