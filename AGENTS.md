# AGENTS.md — Petunjuk untuk AI Coding Agent

Proyek: BITS Pay — QRIS payment gateway (Cloudflare Workers monorepo).

## Aturan Wajib (baca dulu)

1. **Jangan implement ulang yang sudah ada.** Cek dulu:
   - Types → `packages/shared/src/types/index.ts`
   - Utils (crypto, unique-code) → `packages/shared/src/utils/`
   - Schema DB → `packages/api/src/db/migrations/0001_initial.sql`
2. **Shared package = sumber kebenaran.** Semua type baru masuk `packages/shared/src/types/index.ts`. Jangan duplikasi type di package lain.
3. **`@bits-pay/shared` diakses via `@bits-pay/shared`** (workspace alias). Jangan import path relatif lintas package.
4. **Runtime = Cloudflare Workers.** Pakai Web Crypto API (`crypto.subtle`, `crypto.randomUUID`), BUKAN `node:crypto`. `bcryptjs` + `jose` sudah dipakai.
5. **D1 query pakai prepared statement** (`.bind()`), JANGAN string interpolation.
6. **Error pakai `AppError`.** Response pakai wrapper `{ success, data|error }`.
7. **Validasi request pakai `zod`.** Setiap endpoint wajib schema.
8. **Jangan commit secret.** `JWT_SECRET`, API key, token masuk `.env` / `.dev.vars` / secrets GitHub.
9. **Jangan pakai `any`.** Semua type eksplisit.
10. **Jangan buat abstraksi yang tidak diminta** (no interface 1 impl, no factory 1 produk, no config untuk nilai yang tak berubah).

## Dokumentasi (baca sesuai task)

| Doc                            | Isi                            | Kapan baca           |
| ------------------------------ | ------------------------------ | -------------------- |
| `docs/PRD.md`                  | Fitur, prioritas, pricing      | Mulai fitur baru     |
| `docs/ARCHITECTURE.md`         | 2-worker arsitektur, data flow | Mulai fitur baru     |
| `docs/API.md`                  | Endpoint spec (req/resp/error) | Buat/modify endpoint |
| `docs/DATABASE.md`             | Schema DDL                     | Buat/modify query    |
| `docs/UI_DESIGN.md`            | Warna, typography, layout      | Buat UI              |
| `docs/SPRINT.md`               | Task breakdown + deps          | Estimasi scope       |
| `docs/SPRINT_DELEGATION.md`    | Map task → agent opencode      | Sebelum delegasi     |
| `docs/IMPLEMENTATION_GUIDE.md` | Pattern kode lengkap           | Sebelum coding       |

## Struktur Monorepo

```
packages/
├── api/        # Worker 1 — Hono API (api.pay.bits.co.id)
├── shared/     # Types + utils (import via @bits-pay/shared)
├── web/        # Worker 2 — Landing page static (pay.bits.co.id)
├── user/       # User dashboard (Svelte SPA)
└── admin/      # Admin dashboard (Svelte SPA)
```

## Delegasi Agent (build orchestrator)

Build orchestrator menugaskan task ke specialist agent. Peta lengkap task → agent ada di `docs/SPRINT_DELEGATION.md`.

Aturan cepat:

- **`@backend`** → API route, service, middleware, auth, business logic.
- **`@frontend`** → UI, komponen, styling, aksesibilitas.
- **`@fullstack`** → fitur lintas UI+API+DB+test.
- **`@database`** → schema, migrasi, index, query.
- **`@tester`** → unit/integration/e2e.
- **`@devops`** → CI/CD, deploy, observability.
- **`@docs`** → dokumentasi.
- **`@umum`** → task rutin/verifikasi.
- **`@architect`** / **`@tech-lead`** → desain/keputusan arsitektur.
- **`@debugger`** → bug fixing.
- **`@reviewer`** / **`@security`** / **`@scrum-master`** → READ-ONLY. Output laporan, orchestrator yang terapkan.

Satu task → satu agent. Jangan pecah task kecil ke banyak agent. Delegasi independen paralel.

## Model Data Penting (hindari salah asumsi)

- **User tier**: `free` | `premium` (disimpan di `users.tier`). Menentukan feature limits via `tier_features`.
- **Subscription tier**: `premium_monthly` | `premium_yearly` (disimpan di `subscriptions.tier`). Hanya beda harga/period, BUKAN limits. Harga dari wrangler vars `PREMIUM_PRICE_MONTHLY` / `PREMIUM_PRICE_YEARLY`.
- **Unique code**: `amount_due = amount × 10000 + unique_code`, range `0001–9999`.
- **Idempotency order_id**: `payments(order_id)` unik per `app_id`. Gagal duplicate → 409.
- **Password reset**: pakai tabel `password_reset_tokens` (bukan `email_verifications`).
- **Email verification**: pakai tabel `email_verifications`.

## Konvensi (ringkas)

- File route: kebab-case, 1 endpoint per file.
- Class: PascalCase. Function/variable: camelCase. DB: snake_case.
- Response sukses: `{ success: true, data }` (helper `success()` di `lib/response.ts`).
- Response error: `{ success: false, error: { code, message, details? } }`.
- Error code: `invalid_amount`, `invalid_app`, `unauthorized`, `not_found`, `expired`, `duplicate_hash`, `rate_limited`, `validation_error`, `internal_error`.

## State Proyek (progress terkini)

**Sudah jadi:**

- **Package Shared:**
  - Types: `users`, `apps`, `workspaces`, `payments`, `charges`, `subscriptions`, `invoices`, `tier_features`, `audit_logs`, `callbacks`, `password_reset_tokens`, `email_verifications`, `config`, `OcrConfig`, `OcrProvider` — lengkap
  - Utils: `crypto.ts` (hashPassword, verifyPassword, generateApiKey, hashApiKey, signJWT, verifyJWT, signCallbackPayload), `unique-code.ts` (generateUniqueCode, decomposeAmount, computeAmountDue)
  - Barrel export `index.ts` — semua public

- **Package API (Worker 1 — Hono Workers):**
  - `src/config.ts` — type `Env` bindings + vars
  - `src/lib/` — `errors.ts` (AppError), `response.ts` (success, paginated), `validate.ts` (validateBody, validateQuery), `time.ts` (dbTime), `upload.ts` (validateProofFile), `ssrf.ts` (validateCallbackUrl)
  - `src/index.ts` — Hono entry, CORS, security headers, publicRateLimit, errorHandler, route mount, health check, scheduled handler (cron), queue consumer
  - `src/middleware/` — `auth.ts` (requireAuth), `api-key.ts` (requireApiKey), `rate-limit.ts` (publicRateLimit), `admin.ts` (requireAdmin), `cors.ts`, `error-handler.ts`
  - `src/routes/auth/` — 10 file: index, signup, login, logout, logout-all, me, google, verify, exchange, reset
  - `src/routes/app/` — 5 file: index, workspaces, apps, members, payments
  - `src/routes/api/` — 3 file: index, charges, payments (confirm/proof upload)
  - `src/routes/admin/` — 9 file: index, overview, users, payments, callbacks, reports, settings, tier-features, audit-logs
  - `src/routes/billing/` — 3 file: index, subscriptions, invoices
  - `src/services/` — 18 file: auth, app, workspace, payment, qr, ocr (workers-ai + tesseract-vps), callback, callback-admin, email + email-template, billing, subscription, tier, tier-config, admin, report, audit
  - `src/services/ocr/` — 3 file: index (OcrProvider interface + getOcrProvider), workers-ai.ts, tesseract-vps.ts
  - `src/durable/` — `rate-limiter.ts` (DurableObject RateLimiter), `window.ts` (tickBucket pure)
  - `src/db/migrations/` — 5 migrasi: `0001_initial.sql` (schema lengkap), `0002_security.sql`, `0003_payment_integrity.sql`, `0004_login_lockout.sql`, `0005_expired_callback_flag.sql`
  - `wrangler.jsonc` — D1 (DB), R2, AI, Queue (producer+consumer), Durable Object (RateLimiter), Cron (every 5min), vars, send_email

- **Package Web (Worker 2 — Landing page statis):**
  - `index.html` — landing page lengkap (hero, features, pricing, FAQ, modal login/signup)
  - `src/main.ts` — JS interaksi (modal, login/signup fetch, nav toggle)
  - `src/style.css` — 637 baris CSS custom (oklch colors, responsive, modal, animasi)
  - `vite.config.ts` — build ke `dist/`
  - `wrangler.jsonc` — serve `dist/` via `assets` binding

- **Package User (Svelte 5 SPA):**
  - 13 route components: Login, ForgotPassword, ResetPassword, VerifyEmail, OAuthCallback, Overview, Workspaces, WorkspaceDetail, Apps, Payments, PaymentDetail, Invoices, Subscription
  - 3 layout components: DashboardLayout, Navbar, Sidebar
  - 11 UI components: Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Modal, Pagination, Table, Toast
  - Stores: auth, payment, workspace
  - Lib: api.ts, toast.ts
  - Vite + Svelte 5 + Tailwind CSS v4

- **Package Admin (Svelte 5 SPA):**
  - 11 route components: Login, Overview, Users, Payments, PaymentDetail, Callbacks, Reports, Settings, TierFeatures, AuditLogs, ReviewQueue
  - 1 layout: AdminLayout
  - 9 UI components: Badge, Button, Card, EmptyState, ErrorState, Loading, Modal, Pagination, Toast
  - Stores: auth
  - Lib: api.ts, toast.ts
  - Vite + Svelte 5 + Tailwind CSS v4

- **Tests (4 file, 20 test pass):**
  - `packages/shared/tests/crypto.test.ts`
  - `packages/shared/tests/unique-code.test.ts`
  - `packages/api/tests/rate-limit.test.ts`
  - `packages/api/tests/ocr-tesseract.test.ts`

- **Config root:**
  - tsconfig.json, eslint.config.js, prettier.config.mjs, .commitlintrc.json, .husky/, vitest.config.ts
  - `.github/`: ci.yml, deploy-api.yml, deploy-web.yml, uptime.yml, dependabot.yml, CODEOWNERS

- **Scripts:**
  - `scripts/setup-local.mjs` — setup idempotent lokal (dev vars, .env, D1 migrations)

**Belum jadi (minor):**

- E2E tests (Playwright/Selenium)
- Load test / benchmarking
- Monitoring dashboard (Grafana / uptime)
- Multi-worker deployment guide (draft di `docs/MULTI_WORKER.md`)

## Urutan Implementasi (Sprint 1) — ✅ Selesai

1. ✅ `packages/api/src/lib/` — `errors.ts`, `response.ts`, `validate.ts`
2. ✅ `packages/api/src/index.ts` — Hono entry + `errorHandler` + routing mount
3. ✅ `middleware/auth.ts`, `middleware/api-key.ts`, `middleware/rate-limit.ts`
4. ✅ `routes/auth/*` — signup, login, logout, google, verify, reset
5. ✅ `routes/app/*` — workspaces, apps, members
6. ✅ `routes/api/*` — charges, payments, confirm
7. ✅ `services/*` — qr, ocr, callback, email, auth, payment
8. ✅ `routes/admin/*`, `routes/billing/*`
9. ✅ Frontend: web → user → admin
10. ✅ Tests

## Catatan Teknis yang Gampang Salah

- **`generateApiKey()` async** — `await generateApiKey()`, karena `hashApiKey` async (Web Crypto).
- **`hashApiKey()` async** — pemanggil wajib `await`.
- **`requireApiKey`** lookup full key via `api_key_hash`, bukan prefix.
- **Web Worker 2 statis** — `packages/web` tidak punya `src/index.ts` logic; cuma serve `./dist` via `assets` binding. SPA user/admin dibuild lalu di-copy ke `web/dist`.
- **API_URL di SPA** — pakai `import.meta.env.VITE_API_URL` (build-time), bukan wrangler vars runtime. Wrangler vars tidak terbaca di client SPA.
- **`npm run dev:all`** — jalankan `scripts/setup-local.mjs` dulu, lalu `concurrently` 4 service: api (8787), web (5173), user (5174), admin (5175). Semua bind `0.0.0.0` untuk akses LAN/testing. Setiap SPA punya `.env` dengan `VITE_API_URL=http://localhost:8787`.
- **`scripts/setup-local.mjs`** — idempotent, buat `.dev.vars` + `.env` + jalanin D1 migrations `--local`. Jangan tulis manual. File existing tidak ditimpa.
- **`wrangler.jsonc` migrations_dir** — `"migrations_dir": "src/db/migrations"` (bukan default `migrations/`).
- **Durable Object RateLimiter** — di-shard via `idFromName(key)`. State in-memory (DO restart reset counter). Guard memory growth di `fetch()`.
- **Cron every 5min** — expired payment, queue callback expired, expire+downgrade subscription, kirim invoice reminder.
- **Queue consumer** — max 3 retries, batch 10. Process callback dari `callbacks` table.
- **OCR fallback** — `getOcrProvider()` baca config `ocr_provider` (default `workers-ai`). Alternatif `tesseract-vps` via VPS HTTP endpoint.

## Verifikasi Sebelum Selesai

```bash
npm run type-check   # tsc --noEmit — harus bersih
npm run lint         # eslint — harus bersih
npm test             # vitest — harus pass
```
