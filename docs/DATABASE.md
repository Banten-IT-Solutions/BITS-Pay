# BITS Pay — Database Schema (D1 SQLite)

## Tables

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  tier TEXT DEFAULT 'free',
  tier_expires_at TEXT,
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  google_id TEXT UNIQUE,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### email_verifications
```sql
CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### oauth_states
```sql
CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY,
  state TEXT UNIQUE NOT NULL,
  redirect_to TEXT,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### workspaces
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### workspace_members
```sql
CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, user_id)
);
```

### apps
```sql
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  callback_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### payments
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  app_id TEXT REFERENCES apps(id),
  user_id TEXT REFERENCES users(id),
  order_id TEXT,
  type TEXT DEFAULT 'payment',
  amount INTEGER NOT NULL,
  amount_due INTEGER NOT NULL,
  unique_code INTEGER NOT NULL,
  currency TEXT DEFAULT 'IDR',
  status TEXT DEFAULT 'pending',
  qris_dynamic TEXT,
  qr_image TEXT,
  proof_hash TEXT,
  proof_path TEXT,
  proof_mime TEXT,
  user_input_amount INTEGER,
  ocr_amount INTEGER,
  ocr_confidence REAL,
  ocr_merchant TEXT,
  ocr_raw_text TEXT,
  ocr_provider TEXT,
  match_result TEXT,
  metadata TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT,
  expired_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_payments_workspace ON payments(workspace_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_amount_due ON payments(amount_due, status);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_created ON payments(created_at);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  amount INTEGER NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancelled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### invoices
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT REFERENCES subscriptions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  payment_id TEXT REFERENCES payments(id),
  amount INTEGER NOT NULL,
  amount_due INTEGER NOT NULL,
  unique_code INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  tier TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  qris_dynamic TEXT,
  qr_image TEXT,
  due_at TEXT NOT NULL,
  paid_at TEXT,
  expired_at TEXT,
  reminder_sent_3 INTEGER DEFAULT 0,
  reminder_sent_1 INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_at);
```

### callbacks
```sql
CREATE TABLE callbacks (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  app_id TEXT REFERENCES apps(id),
  url TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  status TEXT DEFAULT 'pending',
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### notifications
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  workspace_id TEXT REFERENCES workspaces(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### tier_features
```sql
CREATE TABLE tier_features (
  tier TEXT PRIMARY KEY,
  max_workspaces INTEGER DEFAULT 1,
  max_apps INTEGER DEFAULT 1,
  max_transactions_month INTEGER DEFAULT 100,
  max_transactions_per_day INTEGER DEFAULT 10,
  api_rate_limit INTEGER DEFAULT 10,
  callback_allowed INTEGER DEFAULT 0,
  callback_retry_count INTEGER DEFAULT 0,
  report_export INTEGER DEFAULT 0,
  priority_review INTEGER DEFAULT 0,
  max_team_members INTEGER DEFAULT 1,
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0
);

INSERT INTO tier_features VALUES
  ('free', 1, 1, 100, 10, 10, 0, 0, 0, 0, 1, 0, 0),
  ('premium', 3, 5, 10000, 500, 100, 1, 3, 1, 1, 5, 50000, 500000);
```

### config
```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO config VALUES
  ('ocr_provider', 'workers-ai', 'system', datetime('now')),
  ('vps_ocr_url', '', NULL, NULL),
  ('vps_ocr_api_key', '', NULL, NULL);
```

## Data Relationships

```
users ──< workspace_members >── workspaces
  │                                │
  │                                └──< apps
  │                                      │
  │                                      └──< payments
  │
  ├──< subscriptions
  │      │
  │      └──< invoices ──< payments
  │
  ├──< email_verifications
  └──< notifications
```
