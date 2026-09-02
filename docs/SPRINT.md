# BITS Pay — Sprint 1: Core Payment + Auth

**Durasi:** 2 minggu
**Goal:** User bisa signup, login, buat workspace, buat app, create charge, confirm payment, auto-confirm via OCR.

---

## Task Breakdown

### 1. Project Setup (Day 1)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-001 | Init monorepo: package.json, tsconfig, workspaces | root | 2h | - |
| S1-002 | Setup wrangler.jsonc (Worker 1) | api | 1h | S1-001 |
| S1-003 | Setup packages/web/wrangler.jsonc (Worker 2) | web | 1h | S1-001 |
| S1-004 | Setup D1 database + run migration | api | 1h | S1-002 |
| S1-005 | Setup R2 bucket | api | 30m | S1-002 |
| S1-006 | Setup Queue (payment-callback) | api | 30m | S1-002 |
| S1-007 | Setup Cloudflare Email Sending domain | api | 30m | S1-002 |
| S1-008 | Setup shared package (types, utils) | shared | 2h | S1-001 |
| S1-009 | Setup Hono entry + middleware (auth, error, rate-limit) | api | 3h | S1-002 |

**Total: 11.5h**

### 2. Auth (Day 2-3)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-010 | POST /auth/signup (email + password) | api | 3h | S1-009 |
| S1-011 | POST /auth/login (JWT) | api | 2h | S1-010 |
| S1-012 | POST /auth/logout | api | 1h | S1-011 |
| S1-013 | Email verification flow (signup → send email → verify) | api | 3h | S1-010, S1-007 |
| S1-014 | Google OAuth login + callback | api | 4h | S1-009 |
| S1-015 | Forgot password + reset password | api | 3h | S1-013 |
| S1-016 | JWT middleware (verify token, extract user) | api | 2h | S1-011 |

**Total: 18h**

### 3. Workspace + App (Day 3-4)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-017 | POST/GET /app/workspaces | api | 3h | S1-016 |
| S1-018 | PUT/DELETE /app/workspaces/:id | api | 2h | S1-017 |
| S1-019 | POST/GET /app/workspaces/:wid/apps | api | 3h | S1-017 |
| S1-020 | PUT /app/workspaces/:wid/apps/:id | api | 1h | S1-019 |
| S1-021 | API key generation (random, hash, prefix) | api | 2h | S1-019 |
| S1-022 | API key middleware (verify for external requests) | api | 2h | S1-021 |

**Total: 13h**

### 4. Core Payment (Day 5-7)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-023 | Install bits-qris + integrasi QRIS service | api | 2h | S1-009 |
| S1-024 | Unique code generator (1-9999, cek available) | api | 2h | S1-023 |
| S1-025 | POST /v1/charges (create transaction, QRIS convert, QR image) | api | 4h | S1-024, S1-022 |
| S1-026 | GET /v1/payments/:id (status) | api | 1h | S1-025 |
| S1-027 | Upload proof to R2 + hash check | api | 3h | S1-005 |
| S1-028 | Workers AI OCR integration (vision extract nominal) | api | 3h | S1-027 |
| S1-029 | OCR provider abstraction + config table | api | 2h | S1-028 |
| S1-030 | Matching logic (user_input, OCR, amount_due, confidence) | api | 3h | S1-029 |
| S1-031 | POST /v1/payments/:id/confirm (full flow) | api | 4h | S1-030, S1-028 |
| S1-032 | Callback queue + sender service | api | 3h | S1-006 |
| S1-033 | Callback retry logic (3x, exponential backoff) | api | 2h | S1-032 |
| S1-034 | Expire cron (setiap 5 menit, update pending → expired) | api | 2h | S1-025 |

**Total: 31h**

### 5. Landing Page (Day 8-9)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-035 | Setup Vite + Tailwind for landing page | web | 2h | S1-003 |
| S1-036 | Hero section (tagline, CTA, ilustrasi) | web | 3h | S1-035 |
| S1-037 | Cara kerja section (4 steps) | web | 2h | S1-035 |
| S1-038 | Fitur section (6 cards) | web | 2h | S1-035 |
| S1-039 | Harga section (Free vs Premium table) | web | 2h | S1-035 |
| S1-040 | Footer + navbar | web | 2h | S1-035 |
| S1-041 | Login + Signup page (static HTML, form action ke API) | web | 3h | S1-035 |
| S1-042 | SEO meta tags, Open Graph, sitemap.xml | web | 2h | S1-041 |

**Total: 18h**

### 6. User Dashboard — Basic (Day 10-12)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-043 | Setup Svelte + Vite + Tailwind + router | user | 2h | S1-001 |
| S1-044 | Dashboard layout (sidebar + navbar + content) | user | 4h | S1-043 |
| S1-045 | Shared components (button, input, card, table, badge, modal) | user | 6h | S1-043 |
| S1-046 | Auth flow (JWT token, login page, redirect) | user | 3h | S1-044, S1-011 |
| S1-047 | Overview page (stat cards, recent transactions) | user | 4h | S1-045 |
| S1-048 | Workspace list + create + edit pages | user | 4h | S1-045, S1-017 |
| S1-049 | App list + create + detail + key display pages | user | 4h | S1-045, S1-019 |
| S1-050 | Payments list page (table, filter, search, pagination) | user | 6h | S1-045, S1-025 |
| S1-051 | Payment detail page (status, QR, proof, OCR result) | user | 4h | S1-045, S1-026 |

**Total: 37h**

### 7. Admin Dashboard — Basic (Day 13-14)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-052 | Setup Svelte + Vite + Tailwind + router | admin | 2h | S1-001 |
| S1-053 | Admin layout (sidebar + navbar + content) | admin | 3h | S1-052 |
| S1-054 | Admin auth (login, JWT) | admin | 2h | S1-053 |
| S1-055 | Overview page (total users, payments, revenue) | admin | 3h | S1-054 |
| S1-056 | All payments list (table, filter, search) | admin | 4h | S1-054, S1-025 |
| S1-057 | Payment review queue (cards with proof + OCR + confirm/reject) | admin | 6h | S1-054, S1-031 |
| S1-058 | Payment detail + manual confirm/reject | admin | 4h | S1-057 |

**Total: 24h**

### 8. Testing + Deploy (Day 14)

| ID | Task | Package | Estimasi | Dependencies |
|----|------|---------|----------|--------------|
| S1-059 | API tests (auth, charges, confirm) | tests | 4h | Semua |
| S1-060 | Deploy Worker 1 (api.pay.bits.co.id) | api | 1h | Semua |
| S1-061 | Deploy Worker 2 (pay.bits.co.id) | web | 1h | Semua |
| S1-062 | Setup DNS + domain | root | 1h | S1-060, S1-061 |
| S1-063 | Smoke test end-to-end | root | 2h | S1-062 |

**Total: 9h**

---

## Summary

| Phase | Total Hours | Days |
|-------|------------|------|
| Project Setup | 11.5h | 1 |
| Auth | 18h | 2 |
| Workspace + App | 13h | 1.5 |
| Core Payment | 31h | 3 |
| Landing Page | 18h | 2 |
| User Dashboard | 37h | 3 |
| Admin Dashboard | 24h | 2 |
| Testing + Deploy | 9h | 1 |
| **Total** | **161.5h** | **14 days** |

## Milestone

**End of Sprint 1:**
- User bisa signup/login via email + Google
- User bisa buat workspace + app + API key
- Developer bisa call POST /v1/charges → dapat QRIS
- User bisa upload bukti → OCR → auto-confirm
- Landing page live: pay.bits.co.id
- API live: api.pay.bits.co.id
- Admin bisa review transaksi & confirm/reject
