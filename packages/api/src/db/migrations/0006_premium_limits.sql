-- BITS Pay — Premium limits v2
-- Migration 0006: premium = 1 workspace, 3 apps, 3.000 transaksi/bulan
-- flat sharing per akun (lihat PaymentService.checkQuota).
UPDATE tier_features
SET max_workspaces = 1, max_apps = 3, max_transactions_month = 3000
WHERE tier = 'premium';
