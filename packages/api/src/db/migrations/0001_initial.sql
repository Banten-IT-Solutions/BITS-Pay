-- BITS Pay — Initial Schema
-- Migration 0001: Core tables
-- Apply: wrangler d1 migrations apply DB --local

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','banned')),
  tier TEXT DEFAULT 'free' CHECK(tier IN ('free','premium')),
  tier_expires_at TEXT,
  email_verified INTEGER DEFAULT 0 CHECK(email_verified IN (0,1)),
  phone_verified INTEGER DEFAULT 0 CHECK(phone_verified IN (0,1)),
  google_id TEXT UNIQUE,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- ============================================================
-- EMAIL VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0,1)),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0,1)),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- ============================================================
-- OAUTH STATES
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  redirect_to TEXT,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0,1)),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ============================================================
-- APPS
-- ============================================================
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  callback_url TEXT,
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apps_workspace ON apps(workspace_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  order_id TEXT,
  type TEXT DEFAULT 'payment' CHECK(type IN ('payment','invoice')),
  amount INTEGER NOT NULL CHECK(amount >= 100),
  amount_due INTEGER NOT NULL,
  unique_code INTEGER NOT NULL CHECK(unique_code BETWEEN 1 AND 9999),
  currency TEXT DEFAULT 'IDR',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','failed','expired','pending_review')),
  qris_dynamic TEXT,
  qr_image TEXT,
  proof_hash TEXT,
  proof_path TEXT,
  proof_mime TEXT,
  user_input_amount INTEGER,
  ocr_amount INTEGER,
  ocr_confidence REAL CHECK(ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 100)),
  ocr_merchant TEXT,
  ocr_raw_text TEXT,
  ocr_provider TEXT,
  match_result TEXT CHECK(match_result IS NULL OR match_result IN ('auto_confirm','low_confidence','mismatch','manual_confirm','manual_reject')),
  metadata TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT,
  expired_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_workspace ON payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_amount_due ON payments(amount_due, status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
-- Idempotency: satu order_id unik per app. NULL order_id (invoice) tidak ikut.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order ON payments(app_id, order_id)
  WHERE order_id IS NOT NULL;

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK(tier IN ('premium_monthly','premium_yearly')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','canceled','expired','pending')),
  amount INTEGER NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancelled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  amount_due INTEGER NOT NULL,
  unique_code INTEGER NOT NULL CHECK(unique_code BETWEEN 1 AND 9999),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','failed')),
  tier TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  qris_dynamic TEXT,
  qr_image TEXT,
  due_at TEXT NOT NULL,
  paid_at TEXT,
  expired_at TEXT,
  reminder_sent_3 INTEGER DEFAULT 0 CHECK(reminder_sent_3 IN (0,1)),
  reminder_sent_1 INTEGER DEFAULT 0 CHECK(reminder_sent_1 IN (0,1)),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_at);

-- ============================================================
-- CALLBACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS callbacks (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('payment.success','payment.failed','payment.expired')),
  payload TEXT NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','failed','dead')),
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_callbacks_payment ON callbacks(payment_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks(status);
CREATE INDEX IF NOT EXISTS idx_callbacks_retry ON callbacks(next_retry_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email','in_app')),
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  sent_at TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- TIER FEATURES
-- ============================================================
-- Feature limits keyed by user tier (free | premium).
-- Billing period (monthly/yearly) hanya beda harga, bukan limits.
-- Harga dari PREMIUM_PRICE_MONTHLY / PREMIUM_PRICE_YEARLY (wrangler vars).
CREATE TABLE IF NOT EXISTS tier_features (
  tier TEXT PRIMARY KEY CHECK(tier IN ('free','premium')),
  max_workspaces INTEGER DEFAULT 1,
  max_apps INTEGER DEFAULT 1,
  max_transactions_month INTEGER DEFAULT 100,
  max_transactions_per_day INTEGER DEFAULT 10,
  api_rate_limit INTEGER DEFAULT 10,
  callback_allowed INTEGER DEFAULT 0 CHECK(callback_allowed IN (0,1)),
  callback_retry_count INTEGER DEFAULT 0,
  report_export INTEGER DEFAULT 0 CHECK(report_export IN (0,1)),
  priority_review INTEGER DEFAULT 0 CHECK(priority_review IN (0,1)),
  max_team_members INTEGER DEFAULT 1
);

INSERT INTO tier_features (tier, max_workspaces, max_apps, max_transactions_month, max_transactions_per_day, api_rate_limit, callback_allowed, callback_retry_count, report_export, priority_review, max_team_members)
VALUES
  ('free', 1, 1, 100, 10, 10, 0, 0, 0, 0, 1),
  ('premium', 3, 5, 10000, 500, 100, 1, 3, 1, 1, 5);

-- ============================================================
-- CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO config (key, value, updated_by) VALUES
  ('ocr_provider', 'workers-ai', 'system'),
  ('vps_ocr_url', '', NULL),
  ('vps_ocr_api_key', '', NULL);