# BITS Pay

QRIS payment gateway untuk aplikasi kamu. Convert QRIS static → dynamic, auto-confirm via OCR.

## Quick Start

```bash
npm install
npm run dev
```

## Docs

- [PRD](docs/PRD.md) — Product Requirements
- [Architecture](docs/ARCHITECTURE.md) — Arsitektur teknis
- [API](docs/API.md) — Endpoint reference
- [Database](docs/DATABASE.md) — Schema DDL
- [UI Design](docs/UI_DESIGN.md) — Desain UI/UX
- [DevOps](docs/DEVOPS.md) — CI/CD, lint, test
- [Sprint 1](docs/SPRINT_1.md) — Task breakdown
- [Roadmap](docs/ROADMAP.md) — Roadmap keseluruhan

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 |
| Email | Cloudflare Email Service |
| OCR | Workers AI |
| QRIS | bits-qris (npm) |
| Auth | Custom (bcrypt + JWT) |
| Dashboard | Svelte + Tailwind |
| Landing | HTML + CSS |

## License

MIT — [Banten IT Solutions](https://banten-it-solutions.github.io)
