# BITS Pay — Roadmap

## Phase 1: Core Payment (Sprint 1)
**Durasi:** 2 minggu
**Goal:** Produk bisa dipakai. User signup, create charge, confirm, auto-OCR.

**Deliverables:**
- Landing page live
- Auth (email + Google)
- Workspace + App CRUD
- Charge API + QRIS generate
- Confirm API + OCR + auto-confirm
- Callback + retry
- Admin review queue
- User dashboard (basic)
- Admin dashboard (basic)

---

## Phase 2: Multi-Tenant & Subscription (Sprint 2)
**Durasi:** 2 minggu
**Goal:** User bisa bayar untuk premium, feature gating.

**Deliverables:**
- Subscription system (upgrade, cancel, expiry)
- Invoice generation + QRIS billing
- Feature gating (free vs premium limits)
- Invoice reminder email (H-3, H-1)
- Premium expiry cron + auto-downgrade
- Team members (invite, roles)
- User dashboard: subscription page, invoices page
- Admin dashboard: user management, subscription management

---

## Phase 3: Admin Tools & Monitoring (Sprint 3)
**Durasi:** 2 minggu
**Goal:** Admin bisa manage sistem, lihat laporan, konfigurasi.

**Deliverables:**
- Admin: user management (suspend, edit)
- Admin: callback monitor + manual retry
- Admin: OCR config (Workers AI vs Tesseract)
- Admin: audit log viewer
- Admin: reports (transactions, revenue, charts)
- Admin: email templates editor
- Admin: tier features config
- Reports export (CSV)
- API docs lengkap (Swagger UI + guides)

---

## Phase 4: Polish & Scale (Sprint 4)
**Durasi:** 2 minggu
**Goal:** Stabil, siap untuk production skala.

**Deliverables:**
- Dogfooding: BITS Pay subscription bayar via BITS Pay
- Error rate monitoring + alerting
- Performance optimization
- Rate limiting hardening
- OCR fallback (Workers AI → Tesseract VPS)
- Dark mode for dashboards
- Mobile responsive polish
- Public status page
- Security audit

---

## Phase 5: Enterprise (Future)
**Goal:** Fitur lanjutan untuk skala besar.

**Possible features:**
- Dedicated VPS OCR (Tesseract Docker) — jika Workers AI kurang akurat
- Multi-worker separation (traffic > 100k req/hari)
- Webhook signature verification docs
- Public API documentation website
- Blog / use case articles
- Affiliate / referral program

---

## Timeline

```
Sprint 1: Core Payment          ████████████████░░░░░░░░░░░░░░  2 minggu
Sprint 2: Subscription          ░░░░░░░░░░░░░░░░████████████░░  2 minggu
Sprint 3: Admin Tools           ░░░░░░░░░░░░░░░░░░░░░░░░░░████  2 minggu
Sprint 4: Polish & Scale        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  2 minggu
                                ────────────────────────────────
                                8 minggu total → MVP Launch
```
