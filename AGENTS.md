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

## Delegasi Agent

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

## Status Build & Cakupan Fitur

**Sudah dibangun — semua package siap produksi:**

| Package              | Isi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shared**           | Types: users, apps, workspaces, payments, charges, subscriptions, invoices, tier_features, audit_logs, callbacks, password_reset_tokens, email_verifications, config, OcrConfig, OcrProvider. Utils: crypto (hashPassword, verifyPassword, generateApiKey, hashApiKey, signJWT, verifyJWT, signCallbackPayload), unique-code (generateUniqueCode, decomposeAmount, computeAmountDue). Barrel export index.ts.                                                                                                                                                                                                                                                                                                                                                   |
| **api** (Worker 1)   | Hono entry + CORS + security headers + errorHandler. Config Env, lib (errors, response, validate, time, upload, ssrf). Middleware: auth, api-key, rate-limit, admin, cors, error-handler. Routes: auth (10 file), app (5), api (3), admin (9), billing (3). Services: 18 file (auth, app, workspace, payment, qr, ocr, callback, callback-admin, email, email-template, billing, subscription, tier, tier-config, admin, report, audit). OCR: OcrProvider interface + workers-ai + tesseract-vps. Durable: RateLimiter (DO), tickBucket. Migrasi: 5 file (initial schema, security, payment integrity, login lockout, expired callback flag). wrangler.jsonc: D1, R2, AI, Queue (producer+consumer), DO RateLimiter, Cron every 5min, vars, send_email binding. |
| **web** (Worker 2)   | Landing page: index.html (hero, features, pricing, FAQ, modal login/signup), main.ts, style.css 637 baris. Vite build ke dist/, wrangler serve via assets binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **user** (Svelte 5)  | 13 route komponen: Login, ForgotPassword, ResetPassword, VerifyEmail, OAuthCallback, Overview, Workspaces, WorkspaceDetail, Apps, Payments, PaymentDetail, Invoices, Subscription. 3 layout: DashboardLayout, Navbar, Sidebar. 11 UI komponen: Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Modal, Pagination, Table, Toast. Stores (auth, payment, workspace), lib (api.ts, toast.ts). Vite + Svelte 5 + Tailwind v4.                                                                                                                                                                                                                                                                                                                          |
| **admin** (Svelte 5) | 11 route komponen: Login, Overview, Users, Payments, PaymentDetail, Callbacks, Reports, Settings, TierFeatures, AuditLogs, ReviewQueue. 1 layout: AdminLayout. 9 UI komponen: Badge, Button, Card, EmptyState, ErrorState, Loading, Modal, Pagination, Toast. Stores (auth), lib (api.ts, toast.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **tests**            | 4 file, 20 test pass: crypto.test.ts, unique-code.test.ts, rate-limit.test.ts, ocr-tesseract.test.ts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **config root**      | tsconfig.json, eslint.config.js, prettier.config.mjs, .commitlintrc.json, .husky/, vitest.config.ts. CI/CD: ci.yml, deploy-api.yml, deploy-web.yml, uptime.yml, dependabot.yml, CODEOWNERS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **scripts**          | `scripts/setup-local.mjs` — setup idempotent lokal (dev vars, .env, D1 migrations).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Belum jadi (minor — opsional):**

- E2E tests (Playwright/Selenium)
- Load test / benchmarking
- Monitoring dashboard (Grafana / uptime)
- Multi-worker deployment guide (draft di `docs/MULTI_WORKER.md`)

## Catatan Teknis yang Gampang Salah

- **`generateApiKey()` async** — `await generateApiKey()`, karena `hashApiKey` async (Web Crypto).
- **`hashApiKey()` async** — pemanggil wajib `await`.
- **`requireApiKey`** lookup full key via `api_key_hash`, bukan prefix.
- **Web Worker 2 statis** — `packages/web` tidak punya `src/index.ts` logic; cuma serve `./dist` via `assets` binding. SPA user/admin dibuild lalu di-copy ke `web/dist`.
- **API_URL di SPA** — pakai `import.meta.env.VITE_API_URL` (build-time), bukan wrangler vars runtime. Wrangler vars tidak terbaca di client SPA.
- **`npm run dev:all`** — jalankan `scripts/setup-local.mjs` dulu, lalu `concurrently` 4 service: api (5173), web (5174), user (5175), admin (5176). Semua bind `0.0.0.0` untuk akses LAN/testing. Setiap SPA punya `.env` dengan `VITE_API_URL=http://localhost:5173`.
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
