# BITS Pay — Sprint Delegation Map

Peta delegasi task → agent opencode. Dibaca **build orchestrator** (`@build`) sebelum mulai tiap task.

## Agent yang tersedia (dari `~/.config/opencode/agents/`)

| Agent           | Model          | Mode      | Cocok untuk                               |
| --------------- | -------------- | --------- | ----------------------------------------- |
| `@architect`    | `9router/satu` | write     | Desain sistem, batas komponen, data flow  |
| `@backend`      | `9router/dua`  | write     | API, service, auth, business logic        |
| `@database`     | `9router/satu` | write     | Schema, migrasi, index, query, constraint |
| `@frontend`     | `9router/dua`  | write     | UI, styling, aksesibilitas, komponen      |
| `@fullstack`    | `9router/dua`  | write     | Fitur end-to-end lintas UI+API+DB         |
| `@tester`       | `9router/dua`  | write     | Unit/integration/e2e test                 |
| `@devops`       | `9router/dua`  | write     | CI/CD, Docker, deploy, observability      |
| `@docs`         | `9router/tiga` | write     | Dokumentasi, runbook, changelog           |
| `@umum`         | `9router/tiga` | write     | Task rutin, file discovery, edit kecil    |
| `@debugger`     | `9router/satu` | write     | Repro bug, root cause, fix minimal        |
| `@tech-lead`    | `9router/satu` | write     | Standar, trade-off, review keputusan      |
| `@reviewer`     | `9router/satu` | read-only | Review diff correctness/security          |
| `@security`     | `9router/satu` | read-only | Audit vuln, secret, eksposur              |
| `@scrum-master` | `9router/dua`  | read-only | Breakdown task, deps, acceptance criteria |

## Aturan Delegasi

1. **Satu task → satu agent.** Jangan pecah task kecil ke banyak agent.
2. **Baca dulu, baru tulis.** Setiap agent wajib baca `AGENTS.md` + doc relevan sebelum edit.
3. **Read-only agent (`@reviewer`, `@security`, `@scrum-master`) tidak boleh edit.** Mereka output laporan, orchestrator yang terapkan.
4. **Delegasi independen paralel.** Task tanpa dependency sama → jalan bersamaan.
5. **Urutan wajib ada dependency** (misal route butuh schema/middleware).

## Sprint 1 — Delegation Map

### Fase 1: Project Setup (sudah jadi, verifikasi saja)

| Task                 | Agent   | Catatan                                       |
| -------------------- | ------- | --------------------------------------------- |
| S1-001..S1-009 setup | `@umum` | Verifikasi konfigurasi, tidak implement ulang |

> Foundation sudah ada: shared types, utils, migrasi, config, CI/CD. Jangan tulis ulang.

### Fase 2: Auth

| Task                         | Agent      | Alasan                                 |
| ---------------------------- | ---------- | -------------------------------------- |
| S1-010 signup                | `@backend` | Business logic + validasi + hash + JWT |
| S1-011 login                 | `@backend` | Sama, satu konteks dengan signup       |
| S1-012 logout                | `@backend` | Trivial, gabung dengan login           |
| S1-013 email verification    | `@backend` | Flow token + email send                |
| S1-014 Google OAuth          | `@backend` | OAuth state + callback + jose          |
| S1-015 forgot/reset password | `@backend` | Pakai `password_reset_tokens`          |
| S1-016 JWT middleware        | `@backend` | Middleware auth, verify JWT            |

> Auth service + route + middleware saling terkait → kerjakan S1-010..S1-016 dalam SATU delegasi `@backend` berurutan.

### Fase 3: Workspace + App

| Task                           | Agent      | Alasan                         |
| ------------------------------ | ---------- | ------------------------------ |
| S1-017 workspaces CRUD         | `@backend` | Route + service                |
| S1-018 workspace update/delete | `@backend` | Lanjutan                       |
| S1-019 apps CRUD               | `@backend` | Route + service                |
| S1-020 app update              | `@backend` | Lanjutan                       |
| S1-021 API key generation      | `@backend` | Pakai `generateApiKey()` async |
| S1-022 API key middleware      | `@backend` | `requireApiKey` + hash lookup  |

### Fase 4: Core Payment

| Task                                 | Agent       | Alasan                                         |
| ------------------------------------ | ----------- | ---------------------------------------------- |
| S1-023 QRIS service                  | `@backend`  | `bits-qris` API: `convertQris`, `validateQris` |
| S1-024 unique code generator         | `@backend`  | Pakai util `findAvailableCode`                 |
| S1-025 POST /v1/charges              | `@backend`  | Endpoint inti + idempotency order_id           |
| S1-026 GET /v1/payments/:id          | `@backend`  | Lanjutan                                       |
| S1-027 upload proof R2               | `@backend`  | R2 put + hash duplicate                        |
| S1-028 Workers AI OCR                | `@backend`  | Vision model, extract nominal                  |
| S1-029 OCR provider abstraction      | `@backend`  | 1 interface, 2 impl (workers-ai/vps)           |
| S1-030 matching logic                | `@backend`  | amount_due vs OCR + confidence                 |
| S1-031 POST /v1/payments/:id/confirm | `@backend`  | Full flow, gabung S1-027..S1-030               |
| S1-032 callback queue + sender       | `@backend`  | Queue producer/consumer                        |
| S1-033 callback retry                | `@backend`  | Exponential backoff, max 3                     |
| S1-034 expire cron                   | `@backend`  | Scheduled handler                              |
| — selalu `@database` review schema   | `@database` | Verifikasi index/constraint sebelum query      |

### Fase 5-6-7: Frontend

| Task                            | Agent       | Alasan                        |
| ------------------------------- | ----------- | ----------------------------- |
| S1-035 Vite+Tailwind setup      | `@frontend` | Landing page                  |
| S1-036..S1-042 landing sections | `@frontend` | Hero, fitur, harga, SEO       |
| S1-043 user dashboard setup     | `@frontend` | Svelte+Tailwind+router        |
| S1-044..S1-051 dashboard pages  | `@frontend` | Komponen + store + api client |
| S1-052..S1-058 admin dashboard  | `@frontend` | Admin pages                   |

> `@frontend` untuk UI. Kalau fitur perlu wiring API+store+UI sekaligus → `@fullstack`.

### Fase 8: Testing + Deploy

| Task                      | Agent                     | Alasan                    |
| ------------------------- | ------------------------- | ------------------------- |
| S1-059 API tests          | `@tester`                 | Vitest, mock binding      |
| S1-060..S1-061 deploy     | `@devops`                 | Wrangler deploy           |
| S1-062 DNS                | `@devops`                 | Ikut deploy               |
| S1-063 smoke test         | `@tester`                 | End-to-end check          |
| Setelah rilis fitur besar | `@reviewer` → `@security` | Review read-only bertahap |

## Sprint 2 — Delegation Map (ringkas)

| Deliverable                 | Agent                                         |
| --------------------------- | --------------------------------------------- |
| Subscription system         | `@backend`                                    |
| Invoice + QRIS billing      | `@backend` + `@fullstack` (dashboard invoice) |
| Feature gating              | `@backend` (baca `tier_features`)             |
| Invoice reminder email      | `@backend`                                    |
| Premium expiry cron         | `@backend`                                    |
| Team members                | `@backend` + `@frontend`                      |
| Subscription/invoices pages | `@frontend`                                   |

## Sprint 3 — Delegation Map (ringkas)

| Deliverable            | Agent                             |
| ---------------------- | --------------------------------- |
| User management        | `@backend` + `@frontend`          |
| Callback monitor       | `@fullstack`                      |
| OCR config             | `@backend` (pakai `config` table) |
| Audit log              | `@backend` + `@frontend`          |
| Reports + CSV export   | `@backend` + `@frontend`          |
| Email templates editor | `@fullstack`                      |
| API docs               | `@docs`                           |

## Sprint 4 — Delegation Map (ringkas)

| Deliverable             | Agent                                      |
| ----------------------- | ------------------------------------------ |
| Dogfooding subscription | `@fullstack`                               |
| Monitoring + alerting   | `@devops`                                  |
| Rate limiting hardening | `@backend`                                 |
| OCR fallback            | `@backend`                                 |
| Dark mode + responsive  | `@frontend`                                |
| Security audit          | `@security` (read-only) + `@backend` (fix) |
| Status page             | `@frontend`                                |

## Gating (kapan pakai reviewer/security)

1. **Sebelum merge PR besar** → `@reviewer` (read-only, ordinal severity).
2. **Sebelum expose endpoint baru ke public** → `@security` (read-only).
3. **Setelah fix bug** → `@tester` buat regression test.
4. **Saat ragu keputusan teknis** → `@tech-lead` (write, tapi fokus rekomendasi).
5. **Saat scope ambigu** → `@scrum-master` (read-only, breakdown).
