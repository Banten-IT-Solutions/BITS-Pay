-- Idempotency order_id: unik per app HANYA untuk transaksi aktif.
-- Baris expired tidak memblokir reuse order_id (payment.ts sudah mengizinkan
-- reuse pasca-expired via SELECT ... AND status != 'expired').
-- Overrule idx_payments_order dari 0001 yang unik penuh.
DROP INDEX IF EXISTS idx_payments_order;
CREATE UNIQUE INDEX idx_payments_order ON payments(app_id, order_id)
  WHERE order_id IS NOT NULL AND status != 'expired';
