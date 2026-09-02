# BITS Pay — Architecture Document

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Cloudflare                                                       │
│                                                                   │
│  Worker 1: api.pay.bits.co.id (FREE)                             │
│  ├── Hono API (auth, payments, QRIS, OCR, billing)               │
│  ├── D1 Database (users, transactions, subscriptions)            │
│  ├── R2 Storage (bukti bayar, QR images)                         │
│  ├── Cloudflare Queues (callback retry)                          │
│  ├── Cron Triggers (expire, reminder)                            │
│  ├── Cloudflare Email Service (notifikasi, invoice)              │
│  └── Workers AI (OCR vision)                                     │
│                                                                   │
│  Worker 2: pay.bits.co.id (FREE)                                 │
│  ├── Landing page (static HTML)                                  │
│  ├── API Docs (Swagger UI + Markdown)                            │
│  ├── User Dashboard (Svelte SPA)                                 │
│  └── Admin Dashboard (Svelte SPA)                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Runtime | Cloudflare Workers | Latest |
| Framework | Hono | 4.x |
| Language | TypeScript | 5.x |
| Database | Cloudflare D1 (SQLite) | - |
| Storage | Cloudflare R2 | - |
| Queue | Cloudflare Queues | - |
| Email | Cloudflare Email Service | - |
| OCR | Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) | - |
| QRIS | `bits-qris` (npm) | Latest |
| Auth | Custom (bcrypt + JWT) | - |
| JWT | `jose` | Latest |
| Validation | `zod` | Latest |
| Dashboard | Svelte + Vite + Tailwind | Latest |
| Landing Page | HTML + CSS + Tailwind | - |
| API Docs | Swagger UI (`@hono/swagger-ui`) | Latest |

## 3. Worker Architecture

### Worker 1: API (api.pay.bits.co.id)

```
Request → Hono Router
  ├── Auth Middleware (JWT / API Key)
  ├── Rate Limit Middleware
  │
  ├── /auth/* → AuthRoutes
  │   ├── signup, login, logout
  │   ├── google OAuth
  │   ├── email verification
  │   └── password reset
  │
  ├── /v1/* → ApiRoutes
  │   ├── POST /charges
  │   ├── GET /payments/:id
  │   ├── POST /payments/:id/confirm
  │   │
  │   ├── /webhook/* → WebhookRoutes
  │   │   └── POST /receive              # Callback dari external (webhook simulator)
  │   │
  │   └── /callback/* → CallbackRoutes   # BITS Pay → App callback (internal, via Queue)
  │
  ├── /app/* → AppRoutes
  │   ├── /workspaces/**
  │   ├── /apps/**
  │   ├── /members/**
  │   └── /payments/**
  │
  ├── /billing/* → BillingRoutes
  │   ├── /subscriptions/**
  │   └── /invoices/**
  │
  ├── /admin/* → AdminRoutes
  │   ├── overview, payments, users
  │   ├── workspaces, callbacks
  │   ├── settings, reports, audit
  │   └── /settings/ocr → OCR config
  │
  └── /health → HealthCheck
```

### Worker 2: Static (pay.bits.co.id)

```
Request → Static Assets Router
  ├── /dashboard/* → serve user SPA
  ├── /admin/* → serve admin SPA
  ├── /docs/* → serve Swagger UI + docs
  └── /* → serve landing page
```

## 4. Data Flow

### Unique Code

**Rumus:** `amount_due = amount × 10000 + unique_code`

```
amount: 150000
unique_code: 1
amount_due: 1500000001

Extract amount asli: Math.floor(amount_due / 10000)  → 150000
Extract kode:        amount_due % 10000              → 1
```

Range: `0001` – `9999` (9999 transaksi pending bersamaan). Cukup untuk skala besar.

### Create Charge
```
App → POST /v1/charges { amount, order_id }
  → QRService: generate kode unik (0001-9999, cek available)
  → QRService: convert QRIS static → dynamic (bits-qris)
  → QRService: generate QR image (base64)
  → D1: INSERT transaction (status: pending)
  → Return: { transaction_id, qr_image, amount_due, expiry }
```

### Confirm Payment
```
User → POST /v1/payments/:id/confirm { proof_image, amount }
  → Validasi: amount == amount_due?
  → Validasi: hash duplicate?
  → R2: upload proof image
  → OCR: extract nominal dari gambar (Workers AI)
  → Matching: OCR amount == amount_due? && confidence > 85%?
  → D1: UPDATE status = 'success' (auto) / 'pending_review' (manual)
  → Queue: enqueue callback
  → Return: { status }
```

### Callback Delivery
```
Queue Consumer → CallbackService
  → HTTP POST ke callback_url app
  → Sukses? → D1: UPDATE callback_logs (status: success)
  → Gagal? → D1: UPDATE callback_logs (attempt++, next_retry)
  → Attempt > 3? → Dead letter, notif admin
```

### Subscription Flow
```
User → POST /subscriptions/upgrade { tier: 'premium_monthly' }
  → InvoiceService: generate invoice Rp 50.001 (kode unik)
  → QRService: generate QRIS dinamis
  → EmailService: kirim invoice via email
  → D1: INSERT invoice (status: pending)
  → D1: INSERT subscription (status: pending)
  → Return: { invoice_id, qr_image, amount_due }
```

## 5. Directory Structure

```
/root/code/BITS-Pay/
├── package.json                      # monorepo root
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── commitlint.config.mjs
├── .prettierrc
├── .releaserc.json
├── .editorconfig
├── .gitignore
├── .node-version
├── .npmrc
├── LICENSE
├── SECURITY.md
├── README.md
│
├── docs/                             # Dokumentasi
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── UI_DESIGN.md
│   ├── DEVOPS.md
│   ├── ROADMAP.md
│   ├── SPRINT.md
│   └── IMPLEMENTATION_GUIDE.md
│
├── packages/
│   ├── api/                          # Worker 1 — Hono API
│   │   ├── wrangler.jsonc
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── lib/
│   │   │   │   ├── errors.ts
│   │   │   │   ├── response.ts
│   │   │   │   └── validate.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth/
│   │   │   │   ├── api/
│   │   │   │   ├── app/
│   │   │   │   ├── billing/
│   │   │   │   └── admin/
│   │   │   ├── services/
│   │   │   │   ├── email/
│   │   │   │   ├── ocr/
│   │   │   │   ├── qr.ts
│   │   │   │   └── callback.ts
│   │   │   ├── templates/email/
│   │   │   └── db/
│   │   │       ├── schema.ts
│   │   │       └── migrations/
│   │   │           └── 0001_initial.sql
│   │   └── tests/
│   │
│   ├── shared/                       # Types + utils
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   ├── user.ts
│   │   │   │   ├── payment.ts
│   │   │   │   ├── workspace.ts
│   │   │   │   ├── subscription.ts
│   │   │   │   └── api.ts
│   │   │   ├── utils/
│   │   │   │   ├── unique-code.ts
│   │   │   │   └── crypto.ts
│   │   │   └── db/
│   │   └── package.json
│   │
│   ├── web/                          # Worker 2 — Landing page (static)
│   │   ├── wrangler.jsonc
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── styles/
│   │   │   └── guides/
│   │   ├── public/
│   │   └── package.json
│   │
│   ├── user/                         # User Dashboard (Svelte SPA)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── routes/
│   │   │   ├── stores/
│   │   │   ├── lib/
│   │   │   │   └── api.ts
│   │   │   └── main.ts
│   │   └── tests/
│   │
│   └── admin/                        # Admin Dashboard (Svelte SPA)
│       ├── src/
│       │   ├── components/
│       │   ├── routes/
│       │   ├── stores/
│       │   ├── lib/
│       │   │   └── api.ts
│       │   └── main.ts
│       └── tests/
│
├── tests/                            # Integration tests
│   ├── api/
│   └── helpers/
│
└── .github/
    ├── workflows/
    │   ├── ci.yml
    │   ├── deploy-api.yml
    │   ├── deploy-web.yml
    │   └── uptime.yml
    ├── CODEOWNERS
    └── dependabot.yml
│   │   │   └── rate-limits.md
│   │   └── changelog.md
│   │
│   ├── user/                         # User dashboard (Svelte)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── components/
│   │   │   └── stores/
│   │   └── package.json
│   │
│   └── admin/                        # Admin dashboard (Svelte)
│       ├── src/
│       │   ├── routes/
│       │   ├── components/
│       │   └── stores/
│       └── package.json
│
├── migrations/                       # SQL migrations
│   └── 001_initial.sql
│
├── docs/                             # Project docs
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── UI_DESIGN.md
│   ├── SPRINT.md
│   └── ROADMAP.md
│
└── tests/
    └── api/
```

## 6. Cloudflare Resources

| Resource | Name | Config |
|----------|------|--------|
| Worker 1 | bits-pay-api | api.pay.bits.co.id |
| Worker 2 | bits-pay-web | pay.bits.co.id |
| D1 DB | bits-pay-db | Main database |
| R2 Bucket | bits-pay-proofs | Bukti bayar |
| Queue | payment-callback | Callback retry |
| Cron | */5 * * * * | Expire + reminder |
| Email | pay.bits.co.id | Cloudflare Email Sending |
| Workers AI | - | OCR via binding |

## 7. Future Migration Path

### Multi-Worker (when needed)
```
Worker 1: api.pay.bits.co.id → API + cron
Worker 2: pay.bits.co.id → Landing page + docs
Worker 3: app.pay.bits.co.id → User dashboard
Worker 4: admin.pay.bits.co.id → Admin dashboard
```

### VPS OCR (when needed)
```
VPS: ocr.bits.co.id → Tesseract Docker container
Worker 1 → fetch VPS → OCR result
```

**Migrasi mudah karena:**
- Kode per package sudah terpisah via monorepo
- OCR provider abstraction (ganti via config)
- JWT stateless — no session migration needed
