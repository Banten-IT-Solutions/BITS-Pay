-- BITS Pay — Payment integrity
-- Migration 0003: unique_code atomik + proof_hash anti-replay
-- Apply: wrangler d1 migrations apply DB --local

-- amount_due unik selama transaksi masih aktif (pending / pending_review).
-- Mencegah dua charge concurrent dapat unique_code sama → nominal duplikat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_amount_due_pending
  ON payments(amount_due)
  WHERE status IN ('pending','pending_review');

-- Satu bukti bayar hanya boleh dipakai satu transaksi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_proof_hash
  ON payments(proof_hash)
  WHERE proof_hash IS NOT NULL;
