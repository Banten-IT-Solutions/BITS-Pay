# BITS Pay — Multi-Worker Separation Design

> Status: **DESAIN + RUNBOOK** (belum implementasi). Monolith `bits-pay-api` tidak dipecah sekarang.
> Tujuan: antisipasi traffic > 100k req/hari tanpa merusak kontrak publik.
> Sumber kebenaran konteks: `docs/ARCHITECTURE.md`, `docs/DEVOPS.md`, `docs/DATABASE.md`, `docs/PRD.md` NFR, `packages/api/wrangler.jsonc`, `packages/api/src/index.ts`.

---

## 1. Kapan Trigger Split

NFR PRD (`docs/PRD.md` §6): 1 Worker cukup 100k req/hari, uptime 99.9%, API < 500ms.
100k req/hari ≈ 1.16 req/s rata-rata. Trigger split BUKAN di angka rata-rata, tapi di **headroom + tail latency + kontensi tulis D1**.

| Metric                                                | Threshold trigger                          | Sumber                     |
| ----------------------------------------------------- | ------------------------------------------ | -------------------------- |
| Req/hari total (`/v1/*` utama)                        | sustained > 70k req/hari (70% dari 100k)   | Workers Metrics            |
| RPS puncak `/v1/charges` + `/v1/payments/:id/confirm` | p95 > 20 req/s burst berulang              | Workers Metrics / Logpush  |
| Latency p95 non-OCR                                   | > 350ms sustained (NFR 500ms)              | Workers Metrics — duration |
| Latency OCR (`confirm`)                               | > 2.5s sustained (NFR 3s)                  | Workers Metrics — duration |
| CPU time per invocation                               | mendekati limit plan Worker (cek plan)     | Workers Metrics — CPU time |
| D1 write contention / `SQLITE_BUSY`                   | error rate D1 naik, query duration > 100ms | D1 Analytics               |
| Queue backlog `payment-callback`                      | backlog ratusan + retry naik tajam         | Queues Metrics             |

**Kesimpulan penting:** bottleneck nyata di skenario ini bukan CPU Worker, melainkan **D1 single-writer** (SQLite). Split worker TIDAK menaikkan kapasitas tulis D1. Split berguna untuk: isolasi hot path (`/v1`), isolasi letupan OCR/callback, dan fault blast radius — bukan untuk scale D1. (Lihat §7.)

---

## 2. Strategi Split

Usulan: **3 worker API internal + 1 gateway publik**. Worker static `bits-pay-web` (pay.bits.co.id) TIDAK diubah.

```
                          internet
                              │
              api.pay.bits.co.id  (custom domain)
                              │
                    ┌─────────▼──────────┐
                    │ bits-pay-router     │  gateway publik (satu-satunya yang kena request)
                    │ (service bindings) │  — tidak berisi business logic
                    └──┬──────┬──────┬───┘
        env.AUTH.fetch │      │      │ env.BILLING.fetch
                       │      │      │
      ┌────────────────▼┐ ┌───▼────────┐ ┌──────────────────┐
      │ bits-pay-auth    │ │bits-pay-   │ │ bits-pay-billing  │
      │ /auth, /app      │ │payment     │ │ /billing, /admin, │
      └──────────────────┘ │/v1         │ │ queue consumer,   │
                           └────────────┘ │ cron billing      │
                                          └──────────────────┘
```

### 2.1 Batas & justifikasi tiap worker

| Worker                 | Tanggung jawab                                                                                                  | Kenapa batas ini                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`bits-pay-auth`**    | `/auth/*` (signup, login, logout, google, verify, reset) + `/app/*` (workspaces, apps, members). Isu JWT.       | Auth+tenant saling bergandengan (apps & member = konteks tenant). Traffic rendah, tapi sensitif (credential). Masalah di sini tidak boleh menjatuhkan hot path.                              |
| **`bits-pay-payment`** | `/v1/*` (charges, payments, confirm). QRIS, unique-code, OCR (Workers AI), upload bukti (R2), enqueue callback. | Ini hot path (>90% request). Miliki latensi paling ketat + dependensi berat (AI, R2). Isolasi agar bug/burst OCR tidak mengganggu auth/admin.                                                |
| **`bits-pay-billing`** | `/billing/*`, `/admin/*`, **consumer queue `payment-callback`**, **cron subscription/reminder**.                | Billing+admin+callback = lalu lintas "back-office" rendah frekuensi tapi penting. Consumer callback dipisah biar pengiriman webhook (retry 3x, bisa lambat/timeout) tidak memblok `confirm`. |
| **`bits-pay-router`**  | Route request masuk ke 3 worker internal via service binding. `/health` sendiri.                                | Preservasi kontrak publik: client tetap 1 base URL `api.pay.bits.co.id/v1`. Service binding same-thread, overhead ~0.                                                                        |

Runtime `index.ts` sekarang punya `scheduled` + `queue` di file yang sama. Setelah split:

- `scheduled` **payment-expire** → pindah ke `bits-pay-payment` (dia yang miliki tabel `payments`).
- `scheduled` **subscription-expire + invoice-reminder** → pindah ke `bits-pay-billing` (dia yang miliki `subscriptions`, `invoices`).
- `queue` (callback) → pindah ke `bits-pay-billing`.

### 2.2 State bersama

- **D1 `bits-pay-db`** — SATU database, di-bind ke 4 worker. Batas worker adalah batas _kode_, bukan _data_; semua baca/tulis tabel yang sama.
- **Queues `payment-callback`** — producer: `bits-pay-payment`; consumer: SATU (`bits-pay-billing`). Satu consumer = satu pemilik retry.
- **R2 `bits-pay-proofs`** — dipakai `bits-pay-payment` (upload bukti). Billing/admin cuma baca `proof_path`, tidak butuh binding R2 kecuali endpoint admin butuh render ulang bukti (ralat: JANGAN bind kecuali endpoint nyata butuh object body).
- **DO `RATE_LIMITER`** — namespace DO ter-scope per worker. Lihat §7.

---

## 3. Routing (pola yang benar untuk Workers)

**Koreksi istilah:** `sozu` BUKAN mekanisme Cloudflare Workers (itu reverse-proxy Rust). Cloudflare punya dua konsep routing berbeda dan wajib tidak ketuker:

1. **Custom Domains** — pakai saat **Worker = origin** (kasus BITS Pay). Ini yang dipakai.
2. **`routes`** — pakai saat Worker hanya proxy di depan origin server eksternal (origin punya DNS sendiri). **Tidak relevan di sini.**

Karena Custom Domain memetakan **host penuh → satu Worker** (tanpa path split), memecah satu `api.pay.bits.co.id` ke banyak worker harus lewat **gateway + service bindings**. Inilah alasan `bits-pay-router` ada.

### 3.1 Mapping

| Host/path publik               | Worker tujuan             | Mekanisme             |
| ------------------------------ | ------------------------- | --------------------- |
| `api.pay.bits.co.id/*`         | `bits-pay-router`         | custom domain         |
| `api.pay.bits.co.id/auth/*`    | → `bits-pay-auth`         | service binding       |
| `api.pay.bits.co.id/app/*`     | → `bits-pay-auth`         | service binding       |
| `api.pay.bits.co.id/v1/*`      | → `bits-pay-payment`      | service binding       |
| `api.pay.bits.co.id/billing/*` | → `bits-pay-billing`      | service binding       |
| `api.pay.bits.co.id/admin/*`   | → `bits-pay-billing`      | service binding       |
| `api.pay.bits.co.id/health`    | `bits-pay-router` sendiri | local handler         |
| `pay.bits.co.id/*`             | `bits-pay-web`            | tetap, tidak disentuh |

Worker internal (`auth`/`payment`/`billing`) **tidak boleh reachable publik**: tanpa custom domain, tanpa `routes`, `workers_dev: false`.

### 3.2 Ilustrasi konfig urasi (bukan kode produksi)

`bits-pay-router/wrangler.jsonc` — caller yang deklarasi service binding:

```jsonc
{
  "name": "bits-pay-router",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-01",
  "workers_dev": false,
  "services": [
    { "binding": "AUTH", "service": "bits-pay-auth" },
    { "binding": "PAYMENT", "service": "bits-pay-payment" },
    { "binding": "BILLING", "service": "bits-pay-billing" },
  ],
}
```

Interface pakai **HTTP** (paling sedikit perubahan — tiap worker internal tetap Hono router):

```ts
// bits-pay-router/src/index.ts (ilustrasi)
const app = new Hono<{ Bindings: Env }>();
app.route('/auth', (c) => c.env.AUTH.fetch(c.req.raw));
app.route('/app', (c) => c.env.AUTH.fetch(c.req.raw));
app.route('/v1', (c) => c.env.PAYMENT.fetch(c.req.raw));
app.route('/billing', (c) => c.env.BILLING.fetch(c.req.raw));
app.route('/admin', (c) => c.env.BILLING.fetch(c.req.raw));
```

> Custom domain `api.pay.bits.co.id` dipasang via dashboard/API ke `bits-pay-router`. Urutan deploy: **worker target dulu, baru caller** (service binding gagal deploy kalau target belum ada).

---

## 4. Shared State & Binding per Worker

### 4.1 D1 tabel per worker (baca/tulis)

Full schema: `docs/DATABASE.md`.

| Worker             | Baca                                                                                                                                | Tulis                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `bits-pay-auth`    | `users`, `workspaces`, `workspace_members`, `apps`, `email_verifications`, `password_reset_tokens`, `oauth_states`, `tier_features` | `users`, `workspaces`, `workspace_members`, `apps`, `email_verifications`, `password_reset_tokens`, `oauth_states`, `audit_logs` |
| `bits-pay-payment` | `apps` (API key auth + `callback_url`), `workspaces`, `tier_features` (limits), `payments`, `users`                                 | `payments`, `callbacks` (INSERT via enqueue flow), `audit_logs`                                                                  |
| `bits-pay-billing` | `subscriptions`, `invoices`, `users`, `apps`, `payments`, `callbacks`, `config`, `notifications`                                    | `subscriptions`, `invoices`, `callbacks`, `notifications`, `audit_logs`, `config`                                                |
| `bits-pay-router`  | — (tidak bind D1)                                                                                                                   | —                                                                                                                                |

Catatan tumpang-tindih yang wajar: `apps` dibaca auth (CRUD) + payment (auth API key) tunggal, sumber kebenaran tetap D1. Karena D1 **single-writer**, tidak ada konflik antar-worker; yang ada adalah antrean tulis di satu writer (lihat §7).

### 4.2 Queue producer/consumer split

```jsonc
// bits-pay-payment/wrangler.jsonc — PRODUCER saja
{
  "queues": {
    "producers": [{ "binding": "CALLBACK_QUEUE", "queue": "payment-callback" }]
  }
}

// bits-pay-billing/wrangler.jsonc — CONSUMER saja
{
  "queues": {
    "consumers": [{ "queue": "payment-callback", "max_retries": 3, "max_batch_size": 10 }]
  }
}
```

Satu consumer logis. Kalau volume callback meledak, tambah worker `bits-pay-callback` dedicated (opsi, bukan sekarang).

### 4.3 Binding lain per worker (least privilege)

| Binding             | auth              | payment         | billing                            | router |
| ------------------- | ----------------- | --------------- | ---------------------------------- | ------ |
| `DB` (D1)           | ✅                | ✅              | ✅                                 | ❌     |
| `R2`                | ❌                | ✅              | ❌ (baca `proof_path` string saja) | ❌     |
| `AI` (Workers AI)   | ❌                | ✅              | ❌                                 | ❌     |
| `EMAIL`             | ✅ (verify/reset) | ❌              | ✅ (invoice/reminder)              | ❌     |
| `CALLBACK_QUEUE`    | ❌                | ✅ producer     | ✅ consumer                        | ❌     |
| `RATE_LIMITER` (DO) | ✅ public-IP      | ✅ api-key tier | ❌                                 | ❌     |

### 4.4 Secret & vars

- **`JWT_SECRET`** → duplikat di `bits-pay-auth` (issue) + `bits-pay-payment` + `bits-pay-billing` (verify). Lihat §7.
- **`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`** → hanya `bits-pay-auth`.
- **`QRIS_STATIC`, `OCR_CONFIDENCE_THRESHOLD`, `MAX_UNIQUE_CODE`, `TRANSACTION_EXPIRE_MINUTES`, `PROOF_RETENTION_DAYS`** → `bits-pay-payment` (+ `billing` hanya `TRANSACTION_EXPIRE_MINUTES` jika cron expire pindah; kalau cron expire di payment, billing tidak butuh).
- **`PREMIUM_PRICE_MONTHLY/YEARLY`, `ADMIN_EMAILS`** → `bits-pay-billing`.
- **`APP_URL`, `FROM_EMAIL`** → auth (redirect/link) + billing (email).
- Secret dipasang per worker via `wrangler secret put --env production`. Tidak ada mekanisme "sekali set, dipakai semua" — tiap deploy unit punya secret sendiri.

---

## 5. Observability

### 5.1 Log

- `wrangler tail <worker>` per worker, atau Workers Logpush ke tujuan sentral.
- Label minimal: `worker`, `route`, `status_code`, `duration_ms`. Jangan emit secret/R2 object/aku payload callback.
- D1 slow query: D1 Analytics ada query duration per worker; tandai tulis > 100ms.

### 5.2 Metrics per worker

| Sinyal                      | Minta                                               | Alert kalau                                         |
| --------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Worker invocations          | split per route `/auth`, `/v1`, `/billing`          | drop mendadak → routing rusak                       |
| Duration p95/p99            | driver utama                                        | p95 > 350ms non-OCR; p95 > 2.5s OCR                 |
| CPU time                    | Workers Metrics                                     | mendekati limit plan                                |
| Subrequests                 | Workers Metrics (service binding hitung subrequest) | > 20/request → ada chaining berlebih                |
| Error rate                  | per worker                                          | > 1% (5xx) 15 menit                                 |
| D1 query duration + error   | D1 Analytics                                        | `SQLITE_BUSY`/error naik, tulis > 100ms             |
| Queue backlog + dead letter | Queues Metrics                                      | backlog > 200 atau dead letter > 0 baru dalam 1 jam |
| Cron run                    | log scheduled                                       | gagal 2 run berturut                                |

### 5.3 Uptime / health

- `uptime.yml` (sudah ada) tambah probe per public host: `api.pay.bits.co.id/health`, `pay.bits.co.id`.
- Internal worker tidak punya health publik — pantau lewat metric, bukan probe HTTP.
- SLO: 99.9% = ≤ 43.2 menit downtime/bulan; error budget dashboard opsional.

---

## 6. Migration Runbook (staged rollout)

Prinsip: **tiap fase balik-able**, dan `bits-pay-router` jadi titik cutover + titik rollback.

### Fase 0 — Persiapan (no behavior change)

1. Pastikan `bits-pay-db` D1 bisa di-bind lintas worker (D1 multi-worker read/write sudah didukung; single-writer).
2. Tambah label observability ke handler (worker name) sebelum pecah.
3. Freeze schema: selesaikan migrasi yang pending dulu. Jangan pecah sambil migrasi.

### Fase 1 — Gateway + potong custom domain

4. Deploy `bits-pay-router` — route semua path ke `bits-pay-api` (monolith) via SATU service binding `MONO`.
5. Pasang custom domain `api.pay.bits.co.id` ke `bits-pay-router` (dashboard/API).
6. Verifikasi: semua `/v1/*`, `/auth/*`, `/app/*`, `/billing/*`, `/admin/*`, `/health` tembus.
   Rollback: kembalikan custom domain ke `bits-pay-api` langsung.

### Fase 2 — Keluarkan auth/tenant (monolith → 2 jalur)

7. Deploy `bits-pay-auth` (target dulu). Isi: `/auth/*` + `/app/*` + JWT issue.
8. Update `bits-pay-router`: `/auth`, `/app` → `AUTH.fetch`; sisanya tetap `MONO`.
9. Canary: Gradual Deployments (versions) di `bits-pay-router` 10% → 50% → 100%. Pantau error rate auth.
   Rollback: kembalikan versi router sebelumnya (fallback ke `MONO` untuk `/auth`/`/app`).

### Fase 3 — Keluarkan payment hot path

10. Deploy `bits-pay-payment` (target dulu). Isi: `/v1/*` + enqueue callback + cron payment-expire.
11. UPDATE: matikan cron payment-expire di `bits-pay-api` SEBELUM menyalakan di `bits-pay-payment` (hindari double-expire).
12. Update router: `/v1` → `PAYMENT.fetch`.
13. Canary lagi lewat Gradual Deployments. Pantau `SQLITE_BUSY`, p95 `/v1`, queue producer enqueue.

### Fase 4 — Keluarkan billing/admin/consumer/cron + pensiun monolith

14. Deploy `bits-pay-billing` (target dulu). Isi: `/billing/*`, `/admin/*`, consumer queue, cron subscription+reminder.
15. UPDATE produser: `CALLBACK_QUEUE` producer tetap di `bits-pay-payment`; consumer dipindah ke `bits-pay-billing`. Pastikan tidak ada DUA consumer aktif (double delivery).
16. UPDATE cron: subscription-expire + reminder pindah ke `bits-pay-billing`; pastikan cron di monolith dimatikan.
17. Update router: `/billing`, `/admin` → `BILLING.fetch`.
18. Verifikasi end-to-end: create charge → confirm → OCR → callback delivered → invoice premium flow → cron.
19. Hapus `bits-pay-api` (monolith). Update `.github/workflows/deploy-api.yml` untuk deploy 4 worker (atau matrix deploy).

### Checklist rollback global

- Custom domain = satu tombol cutover (balik ke worker lama).
- Gradual Deployments `versions` di router + tiap worker internal = canary tanpa DNS.
- Jangan hapus worker lama sampai Fase 4 benar-benar green minimal 1 minggu.

---

## 7. Risiko & Catatan

1. **`JWT_SECRET` shared.** JWT diterbitkan auth, diverifikasi payment/billing. Wajib nilainya IDENTIK di semua worker itu. Opsi A (dipakai sekarang): duplikasi secret; konsekuensi rotasi = update semua worker serentak. Opsi B (hardening, nanti): auth expose `verify()` via service binding RPC sehingga `JWT_SECRET` hanya hidup di auth — bayar 1 subrequest per call yang butuh auth.
2. **DO `RATE_LIMITER` scope per worker.** DO namespace ter-bind ke (worker, class_name). `RATE_LIMITER` milik `bits-pay-payment` untuk rate-limit API key per-app; auth punya DO sendiri (misal `PUBLIC_RATE_LIMITER`) untuk rate-limit IP di `/auth`. JANGAN berbagi satu DO lintas worker langsung — kalau butuh limiter global lintas worker, semuanya harus panggil lewat worker pemilik DO via service binding. Migrasi `migrations.new_classes` harus ada di wrangler worker yang memiliki DO itu.
3. **Cron stay di worker mana.** Cron adalah trigger per worker. Tiap job harus ada **tepat satu** worker pemilik, kalau tidak job jalan dobel. Pembagian: `payment-expire` → payment; `subscription-expire` + `invoice-reminder` → billing. Saat pindah, matikan job lama dulu baru nyalakan job baru.
4. **D1 single-writer = ceiling sebenarnya.** Pemisahan worker tidak menambah throughput tulis D1. Kalau D1 jadi bottleneck (banyak `SQLITE_BUSY`), langkah berikutnya bukan tambah worker, tapi: kurangi write amplification, batch write, atau evaluasi D1 read replicas (masih eksperimental). Tulis itu di backlog.
5. **Service binding subrequest limit.** Satu request maks 32 Worker invocations; gateway menambah 1 per call. Aman untuk topologi ini (1 hop). Hindari chaining internal worker saling panggil.
6. **Secret & vars tidak ter-share otomatis.** `wrangler secret put` per worker. Risiko drift konfig (nilai beda antar worker) → mitigasi: satu template `wrangler.jsonc` + dokumentasi daftar var per worker (§4.4).
7. **Consumer queue tunggal.** Dua consumer di queue yang sama = delivery dobel/retry membingungkan. Selalu satu pemilik consumer per queue.
8. **`workers_dev: false` + tanpa route** untuk worker internal, supaya tidak bisa diakses dari luar selain gateway.
9. **Kompatibilitas kontrak.** Client tidak berubah (base URL tetap `api.pay.bits.co.id`). `@bits-pay/shared` shared type = mencegah drift signature antar worker. Satu-satunya breaking internal adalah file `scheduled`/`queue` tidak lagi di satu `index.ts`.

---

## Ringkasan Keputusan Utama

- **Berapa worker:** 1 gateway (`bits-pay-router`) + 3 worker domain (`auth`, `payment`, `billing`) = **4 worker API** (web static tidak dihitung, tidak diubah).
- **Boundary:** auth+tenant (`/auth`,`/app`) | payment+OCR (`/v1`) | billing+admin+callback+queue-consumer+cron-billing (`/billing`,`/admin`).
- **Mekanisme routing:** custom domain → gateway → service bindings (HTTP interface). Bukan `routes`, bukan `sozu`.
- **Trigger split:** 70k req/hari / p95 > 350ms / kontensi tulis D1 naik — bukan semata angka 100k.
