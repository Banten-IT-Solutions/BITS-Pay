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

- Shared types (`packages/shared/src/types/index.ts`)
- Shared utils: `crypto.ts`, `unique-code.ts`
- DB migration lengkap (`0001_initial.sql`)
- Config root: tsconfig, eslint, prettier, husky, commitlint, vitest
- CI/CD workflows

**Belum jadi (hole besar):**

- Semua route handler API (`packages/api/src/routes/*`) — kosong
- Semua middleware (`packages/api/src/middleware/*`) — kosong
- Semua service (`packages/api/src/services/*`) — kosong
- Semua frontend (web, user, admin) — kosong, cuma scaffolding
- Semua tests — kosong

## Urutan Implementasi (Sprint 1)

1. `packages/api/src/lib/` — `errors.ts`, `response.ts`, `validate.ts`
2. `packages/api/src/index.ts` — Hono entry + `errorHandler` + routing mount
3. `middleware/auth.ts`, `middleware/api-key.ts`, `middleware/rate-limit.ts`
4. `routes/auth/*` — signup, login, logout, google, verify, reset
5. `routes/app/*` — workspaces, apps, members
6. `routes/api/*` — charges, payments, confirm
7. `services/*` — qr, ocr, callback, email, auth, payment
8. `routes/admin/*`, `routes/billing/*`
9. Frontend: web → user → admin
10. Tests

## Catatan Teknis yang Gampang Salah

- **`generateApiKey()` async** — `await generateApiKey()`, karena `hashApiKey` async (Web Crypto).
- **`hashApiKey()` async** — pemanggil wajib `await`.
- **`requireApiKey`** lookup full key via `api_key_hash`, bukan prefix.
- **Web Worker 2 statis** — `packages/web` tidak punya `src/index.ts` logic; cuma serve `./dist` via `assets` binding. SPA user/admin dibuild lalu di-copy ke `web/dist`.
- **API_URL di SPA** — pakai `import.meta.env.VITE_API_URL` (build-time), bukan wrangler vars runtime. Wrangler vars tidak terbaca di client SPA.

## Verifikasi Sebelum Selesai

```bash
npm run type-check   # tsc --noEmit — harus bersih
npm run lint         # eslint — harus bersih
npm test             # vitest — harus pass
```
