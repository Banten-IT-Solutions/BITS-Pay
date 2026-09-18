-- BITS Pay — Hapus flag tier yang tak pernah dienforce
-- Migration 0008: report_export & priority_review tidak dibaca kode mana pun.
-- Review manual & export laporan admin berlaku untuk semua tier.
ALTER TABLE tier_features DROP COLUMN report_export;
ALTER TABLE tier_features DROP COLUMN priority_review;
