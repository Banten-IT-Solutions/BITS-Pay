-- QRIS static per app: dana charge langsung masuk ke merchant milik user.
-- NULL = app belum dikonfigurasi → create charge ditolak (qris_not_configured).
ALTER TABLE apps ADD COLUMN qris_static TEXT;
