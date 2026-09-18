-- BITS Pay — Quota pacing v2
-- Migration 0007: daily = bulanan/30 di kedua tier.
-- free: 300/bln + 10/hari. premium: 3.000/bln + 100/hari.
UPDATE tier_features SET max_transactions_month = 300 WHERE tier = 'free';
UPDATE tier_features SET max_transactions_per_day = 100 WHERE tier = 'premium';
