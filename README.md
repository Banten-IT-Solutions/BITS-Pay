# BITS Pay

QRIS payment gateway untuk aplikasi kamu. Convert QRIS static → dynamic, auto-confirm via OCR.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup lokal (buat .dev.vars, .env, jalanin D1 migrations)
pnpm dev:setup

# 3. Jalankan semua service (API + 3 frontend)
pnpm dev:all
```

| Service                  | Port | URL                   |
| ------------------------ | ---- | --------------------- |
| API (Hono Workers)       | 7001 | http://localhost:7001 |
| Landing page (Web)       | 7002 | http://localhost:7002 |
| User dashboard (Svelte)  | 7003 | http://localhost:7003 |
| Admin dashboard (Svelte) | 7004 | http://localhost:7004 |

> Semua SPA di-root `packages/{web,user,admin}/.env` punya `VITE_API_URL=http://localhost:7001`.

## Scripts

| Script             | Fungsi                                                 |
| ------------------ | ------------------------------------------------------ |
| `pnpm dev`         | API worker saja (port 7001)                            |
| `pnpm dev:all`     | Setup + run semua service (concurrently)               |
| `pnpm dev:all:run` | Run semua service tanpa setup ulang                    |
| `pnpm dev:setup`   | Setup idempotent lokal (dev vars, .env, D1 migrations) |
| `pnpm build`       | Build shared + api                                     |
| `pnpm build:all`   | Build semua package                                    |
| `pnpm type-check`  | TypeScript check (tsc --noEmit)                        |
| `pnpm lint`        | ESLint                                                 |
| `pnpm test`        | Vitest (20 test, 4 files)                              |
| `pnpm deploy:api`  | Deploy API worker ke Cloudflare                        |
| `pnpm deploy:web`  | Deploy landing page worker ke Cloudflare               |

## Local Development

Semua dev server bind `0.0.0.0` — bisa diakses dari LAN/testing.

```bash
# Setup awal (cukup sekali)
pnpm dev:setup

# Start semua service
pnpm dev:all

# Atau satu per satu
pnpm dev              # API only
pnpm --filter @bits-pay/web dev   # Landing page only
pnpm --filter @bits-pay/user dev  # User dashboard only
pnpm --filter @bits-pay/admin dev # Admin dashboard only
```

## Testing

```bash
pnpm test                    # Semua test
pnpm test:watch          # Watch mode
pnpm test:coverage       # Coverage report
```

Test files:

- `packages/shared/tests/crypto.test.ts` — hash, JWT, API key
- `packages/shared/tests/unique-code.test.ts` — unique code generation
- `packages/api/tests/rate-limit.test.ts` — Durable Object rate limiter
- `packages/api/tests/ocr-tesseract.test.ts` — OCR tesseract-vps

## Project Structure

```
bits-pay/
├── .github/                  # CI/CD, dependabot, CODEOWNERS
├── docs/                     # PRD, architecture, API, DB, sprint, dll
├── scripts/
│   └── setup-local.mjs       # Setup lokal idempotent
├── packages/
│   ├── api/                  # Worker 1 — Hono API (api.pay.bits.co.id)
│   │   ├── src/
│   │   │   ├── config.ts     # Env interface
│   │   │   ├── index.ts      # Hono entry, cron, queue consumer
│   │   │   ├── lib/          # errors, response, validate, time, upload, ssrf
│   │   │   ├── middleware/   # auth, api-key, rate-limit, admin, cors, error-handler
│   │   │   ├── routes/       # auth(10), app(5), api(3), admin(9), billing(3)
│   │   │   ├── services/     # auth, app, payment, qr, ocr, callback, email, billing, dll
│   │   │   ├── durable/      # RateLimiter DO + window pure
│   │   │   └── db/migrations/ # 5 migrasi D1
│   │   └── wrangler.jsonc    # D1, R2, AI, Queue, DO, Cron, vars
│   ├── shared/               # Types + utils (import via @bits-pay/shared)
│   │   └── src/
│   │       ├── types/        # Semua type definitions
│   │       └── utils/        # crypto.ts, unique-code.ts
│   ├── web/                  # Worker 2 — Landing page static (pay.bits.co.id)
│   │   ├── index.html        # Landing page lengkap + modal login/signup
│   │   ├── src/              # main.ts, style.css (637 baris)
│   │   └── wrangler.jsonc    # assets binding
│   ├── user/                 # User dashboard (Svelte 5 SPA)
│   │   └── src/
│   │       ├── routes/       # 13 komponen route
│   │       ├── components/   # layout(3) + ui(11)
│   │       ├── lib/          # api.ts, toast.ts
│   │       └── stores/       # auth, payment, workspace
│   └── admin/                # Admin dashboard (Svelte 5 SPA)
│       └── src/
│           ├── routes/       # 11 komponen route
│           ├── components/   # layout(1) + ui(9)
│           ├── lib/          # api.ts, toast.ts
│           └── stores/       # auth
```

## Tech Stack

| Layer           | Teknologi                                                                      |
| --------------- | ------------------------------------------------------------------------------ |
| Runtime         | Cloudflare Workers (2 worker)                                                  |
| Framework       | Hono (API), Svelte 5 (SPA)                                                     |
| Language        | TypeScript 6                                                                   |
| Database        | Cloudflare D1 (SQLite)                                                         |
| Storage         | Cloudflare R2 (bukti bayar)                                                    |
| Queue           | Cloudflare Queues (callback retry, max 3)                                      |
| Durable Objects | RateLimiter (fixed-window)                                                     |
| Cron            | every 5 menit (expire, reminder, downgrade)                                    |
| Email           | Cloudflare Email Service                                                       |
| OCR             | Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) + fallback tesseract-vps |
| QRIS            | `bits-qris` (npm)                                                              |
| Auth            | Custom (`bcryptjs` + `jose` JWT)                                               |
| Validation      | `zod`                                                                          |
| Dashboard CSS   | Tailwind CSS v4                                                                |
| Landing CSS     | Custom (oklch colors)                                                          |
| CI/CD           | GitHub Actions (ci, deploy-api, deploy-web, uptime)                            |

## Docs

| Doc                                                  | Isi                                 |
| ---------------------------------------------------- | ----------------------------------- |
| [PRD](docs/PRD.md)                                   | Product Requirements                |
| [Architecture](docs/ARCHITECTURE.md)                 | Arsitektur teknis                   |
| [API](docs/API.md)                                   | Endpoint reference                  |
| [Database](docs/DATABASE.md)                         | Schema DDL                          |
| [UI Design](docs/UI_DESIGN.md)                       | Desain UI/UX                        |
| [DevOps](docs/DEVOPS.md)                             | CI/CD, lint, test                   |
| [Sprint](docs/SPRINT.md)                             | Task breakdown                      |
| [Roadmap](docs/ROADMAP.md)                           | Roadmap keseluruhan                 |
| [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md) | Panduan implementasi untuk AI agent |

## License

MIT — [Banten IT Solutions](https://banten-it-solutions.github.io)
