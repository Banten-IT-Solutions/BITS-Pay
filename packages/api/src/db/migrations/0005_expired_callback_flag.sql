-- BITS Pay — Expired callback flag
-- Migration 0005: pastikan callback `payment.expired` terkirim tepat sekali.
-- Ganti korelasi waktu `updated_at > now - 5 minutes` (rapuh, bisa skip
-- di batas cron) dengan flag eksplisit.
ALTER TABLE payments ADD COLUMN callback_queued INTEGER NOT NULL DEFAULT 0;