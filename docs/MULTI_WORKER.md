# BITS Pay — Panduan Deploy Production (Multi-Worker)

> Runbook deployment untuk arsitektur **2 worker yang berjalan sekarang**:
>
> | Worker         | Domain               | Isi                                                                     |
> | -------------- | -------------------- | ----------------------------------------------------------------------- |
> | `bits-pay-api` | `api.pay.bits.co.id` | Hono API + D1 + R2 + Queue + Durable Object + Workers AI + Cron + Email |
> | `bits-pay-web` | `pay.bits.co.id`     | Static assets: landing page + SPA `user` + SPA `admin` (via `assets`)   |
>
> Sumber kebenaran: `packages/api/wrangler.template.jsonc`, `packages/web/wrangler.template.jsonc`,
> `scripts/gen-wrangler.mjs`, `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-web.yml`.
>
> **PENTING:** `wrangler.jsonc` di kedua package adalah file **generated** (gitignored) dari
> `wrangler.template.jsonc` oleh `scripts/gen-wrangler.mjs`. Jangan edit langsung — ubah template
> atau set env lalu jalankan `pnpm cf:config`.

---

## 1. Prasyarat

| Kebutuhan           | Detail                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Akun Cloudflare     | Zone `bits.co.id` aktif (nameserver mengarah ke Cloudflare) di akun yang sama — wajib untuk custom domain |
| Node + pnpm         | Node >= 24, pnpm 12.4.2 (`packageManager` di root `package.json`)                                         |
| Wrangler auth lokal | `npx wrangler login` (deploy manual), atau CI pakai `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`      |
| API token (CI)      | Scope akun, minimal: Workers Scripts Edit, D1 Edit, Workers R2 Storage Edit, Queues Edit                  |
| Email               | Domain `FROM_EMAIL` diverifikasi di Cloudflare Email Routing (binding `send_email`)                       |

Provisioning resource (satu kali, dari `packages/api`):

```bash
cd packages/api
npx wrangler d1 create bits-pay-db            # catat database_id dari output
npx wrangler r2 bucket create bits-pay-proofs
npx wrangler queues create payment-callback
```

Tidak perlu provisioning manual untuk:

- **Durable Object `RateLimiter`** — dibuat saat deploy via `migrations: [{ tag: "v1", new_classes: ["RateLimiter"] }]`.
- **Cron `*/5 * * * *`** — otomatis dari `triggers`.
- **Workers AI** — binding `AI` otomatis aktif.
- **Custom domain** — wrangler attach otomatis saat deploy (entri `routes` dengan `custom_domain: true`).

---

## 2. Secrets & Vars

Aturan: **kredensial → secret** (`wrangler secret`), **konfigurasi non-sensitif → `vars`** di template.

### Secrets API (`wrangler secret put` / `secret bulk`)

| Secret                 | Isi                                  | Cara generate                      |
| ---------------------- | ------------------------------------ | ---------------------------------- |
| `JWT_SECRET`           | Kunci sign/verify JWT (>= 32 char)   | `openssl rand -hex 32`             |
| `GOOGLE_CLIENT_SECRET` | Secret OAuth Google Cloud Console    | Google Cloud Console → Credentials |
| `QRIS_STATIC`          | QRIS static string merchant produksi | Dari penyedia QRIS merchant        |

Set manual (dari `packages/api`):

```bash
npx wrangler secret put JWT_SECRET
# atau sekaligus:
echo '{"JWT_SECRET":"...","GOOGLE_CLIENT_SECRET":"...","QRIS_STATIC":"..."}' > .worker-secrets.json
npx wrangler secret bulk .worker-secrets.json && rm .worker-secrets.json
```

CI (`deploy-api.yml`) melakukan `wrangler secret bulk` dari GitHub Secrets dengan nama yang sama.

### Vars API (di `wrangler.template.jsonc`, non-secret)

| Var                          | Default                                           | Keterangan                                                                                                                 |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                    | `https://pay.bits.co.id`                          | Origin web; selalu diizinkan CORS                                                                                          |
| `FROM_EMAIL`                 | `noreply@pay.bits.co.id`                          | Pengirim email (harus terverifikasi)                                                                                       |
| `TRANSACTION_EXPIRE_MINUTES` | `15`                                              | Masa berlaku charge                                                                                                        |
| `PREMIUM_PRICE_MONTHLY`      | `50000`                                           | Harga premium bulanan (Rp)                                                                                                 |
| `PREMIUM_PRICE_YEARLY`       | `500000`                                          | Harga premium tahunan (Rp)                                                                                                 |
| `GOOGLE_CLIENT_ID`           | `""`                                              | Kosong = OAuth Google nonaktif                                                                                             |
| `GOOGLE_REDIRECT_URI`        | `https://api.pay.bits.co.id/auth/google/callback` | Harus match di Google Cloud Console                                                                                        |
| `JWT_EXPIRES_IN`             | `7d`                                              | Masa berlaku token                                                                                                         |
| `ADMIN_EMAILS`               | `""`                                              | Comma-separated email admin                                                                                                |
| `OCR_CONFIDENCE_THRESHOLD`   | `85`                                              | Ambang auto-approve OCR (%)                                                                                                |
| `MAX_UNIQUE_CODE`            | `999`                                             | Range kode unik 001–999                                                                                                    |
| `PROOF_RETENTION_DAYS`       | `30`                                              | Retensi bukti bayar di R2                                                                                                  |
| `CORS_ORIGINS`               | _(tidak di template)_                             | Opsional. Origin tambahan, comma-separated. Ada di `Env` (`config.ts`) — set via `wrangler secret`/var tambahan bila perlu |

### Vars/Secrets CI (GitHub repo settings)

Workflow membaca `vars.X || secrets.X` — set sebagai **Variable** (non-sensitif) atau **Secret**.

| Workflow     | Nama                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Keduanya     | `CLOUDFLARE_API_TOKEN` (secret, wajib), `CLOUDFLARE_ACCOUNT_ID` (secret, wajib)                                          |
| `deploy-api` | Semua vars §2 di atas + `WORKER_NAME`, `API_DOMAIN`, `D1_DATABASE_NAME`, `D1_DATABASE_ID`, `API_URL` + 3 secrets di atas |
| `deploy-web` | `WORKER_NAME`, `WEB_DOMAIN`, `APP_URL`, `VITE_API_URL` (wajib diisi — workflow gagal kalau kosong)                       |

> ⚠️ `WORKER_NAME` dibaca oleh **kedua** workflow. Kalau diset sebagai repo Variable, nilainya
> menimpa default `bits-pay-api` **dan** `bits-pay-web` sekaligus → nama worker tabrakan.
> Biarkan kosong (pakai default di `gen-wrangler.mjs`) atau pisah per-environment.

### Build-time SPA (bukan wrangler)

`VITE_API_URL` dibaca saat `vite build` (bukan runtime). Production: `https://api.pay.bits.co.id`.
Lokal: `.env` per package berisi `VITE_API_URL=http://localhost:7001` (dibuat `scripts/setup-local.mjs`).

---

## 3. Urutan Deploy (aman)

Prinsip urutan: **shared → migrasi D1 → secrets → API → SPA build → web**.

Alasan: API import `@bits-pay/shared` hasil build; kode API baru bisa bergantung kolom migrasi baru
(migrasi diapply duluan); worker tanpa `JWT_SECRET` error saat sign/verify token; SPA menanam
`VITE_API_URL` saat build sehingga API harus sudah hidup.

### Via CI (cara utama)

Kedua workflow trigger manual (`workflow_dispatch`), urutan:

1. Actions → **Deploy API** → Run workflow. Langkah di dalamnya: `cf:config` → build shared →
   type-check → test → `wrangler d1 migrations apply <db> --remote` → `wrangler secret bulk` →
   `wrangler deploy` → smoke test `GET /health`.
2. Actions → **Deploy Web** → Run workflow. Langkah: `cf:config` → build shared/web/user/admin →
   copy `packages/user/dist` → `packages/web/dist/user` dan `packages/admin/dist` →
   `packages/web/dist/admin` → `wrangler deploy` → smoke test `GET /`.

### Manual (mirror CI)

```bash
pnpm install --frozen-lockfile
pnpm --filter @bits-pay/shared build
pnpm type-check && pnpm test

# ── Worker 1: API ──
cd packages/api
# Wajib: override database_id placeholder default ('local-bits-pay-db')
export D1_DATABASE_ID=<database_id dari wrangler d1 create>
pnpm cf:config                                     # generate wrangler.jsonc
npx wrangler d1 migrations apply bits-pay-db --remote
npx wrangler secret bulk .worker-secrets.json      # atau secret put per key (lihat §2)
pnpm deploy                                        # cf:config + wrangler deploy
cd ../..

# ── Worker 2: Web (+SPA) ──
export VITE_API_URL=https://api.pay.bits.co.id     # build-time untuk SPA
pnpm --filter @bits-pay/web build
pnpm --filter @bits-pay/user build
pnpm --filter @bits-pay/admin build
cp -r packages/user/dist packages/web/dist/user
cp -r packages/admin/dist packages/web/dist/admin
pnpm --filter @bits-pay/web deploy                 # cf:config + wrangler deploy
```

Catatan script root (beda dengan versi package):

| Script root       | Perilaku sebenarnya                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm deploy:api` | = `packages/api`: `cf:config` + `wrangler deploy`. **Tidak** menjalankan migrasi D1 maupun sync secrets — jalankan manual dulu               |
| `pnpm deploy:web` | = `wrangler deploy` polos di `packages/web`. **Tanpa** `cf:config` dan **tanpa** build — gagal di fresh checkout (wrangler.jsonc gitignored) |

Untuk web, lebih aman pakai `pnpm --filter @bits-pay/web deploy` setelah build + copy SPA.

---

## 4. Domain Routing & CORS

| Host                     | Worker         | Mekanisme                                                           |
| ------------------------ | -------------- | ------------------------------------------------------------------- |
| `api.pay.bits.co.id`     | `bits-pay-api` | `routes: [{ pattern, custom_domain: true }]` di template            |
| `pay.bits.co.id`         | `bits-pay-web` | Sama — custom domain                                                |
| `pay.bits.co.id/user/*`  | `bits-pay-web` | Assets `web/dist/user/` (SPA user, hash router `svelte-spa-router`) |
| `pay.bits.co.id/admin/*` | `bits-pay-web` | Assets `web/dist/admin/` (SPA admin)                                |
| `pay.bits.co.id/*`       | `bits-pay-web` | Landing page statis                                                 |

Custom domain dipasang otomatis oleh `wrangler deploy`; syaratnya zone `bits.co.id` ada di akun.

**CORS** (`packages/api/src/middleware/cors.ts`):

- Origin diizinkan = `APP_URL` + isi `CORS_ORIGINS` (opsional, comma-separated).
- `allowHeaders`: `Content-Type`, `Authorization`, `X-BITS-Signature`, `X-BITS-Event`.
- Request server-to-server (tanpa header `Origin`) lolos otomatis — CORS hanya untuk browser SPA.
- Nilai harus persis: `https://pay.bits.co.id` (tanpa trailing slash).

SPA memanggil API via `VITE_API_URL` (build-time). Ganti URL API = rebuild SPA, bukan redeploy worker.

---

## 5. Verifikasi Pasca-Deploy

```bash
# 1. Health API (sama dengan smoke test CI)
curl -fsS https://api.pay.bits.co.id/health
# expect: {"success":true,"data":{"status":"ok"}}

# 2. Web + SPA
curl -fsS -o /dev/null -w '%{http_code}\n' https://pay.bits.co.id
curl -fsS -o /dev/null -w '%{http_code}\n' https://pay.bits.co.id/user/
curl -fsS -o /dev/null -w '%{http_code}\n' https://pay.bits.co.id/admin/
# expect: 200 semua
```

> Tidak ada endpoint `/status` — satu-satunya health check publik adalah `/health`.

Charge uji end-to-end (butuh API key: signup di dashboard → buat workspace → buat app →
salin key `sk_...` yang hanya tampil sekali):

```bash
curl -X POST https://api.pay.bits.co.id/v1/charges \
  -H "Authorization: Bearer sk_<key>" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"SMOKE-001","amount":1000}'
```

Expect `201` dengan `success: true`, `data.amount_due = 1000 + unique_code`, `data.qr_image`,
`data.expired_at`. Ulangi `order_id` yang sama → expect `409 duplicate_order` (idempotency jalan).

Cron (tiap 5 menit): pantau `npx wrangler tail bits-pay-api` atau dashboard — harus ada event
`scheduled` dalam ≤ 5 menit.

---

## 6. Rollback

```bash
# Kode worker → deployment sebelumnya (dari packages/api atau packages/web)
npx wrangler rollback
# atau pilih versi spesifik:
npx wrangler deployments list
npx wrangler rollback --version-id <id>
```

Batasan rollback:

- **Migrasi D1 tidak ikut rollback.** Kembalikan kode ke versi yang kompatibel dengan schema
  terkini; tulis migrasi backward-compatible agar window ini aman.
- **Secrets persist** antar-deploy — rollback tidak mengubah secret. Rotasi = `secret put` ulang.
- **Web**: rollback aman karena `dist` (termasuk SPA hasil copy) ikut tersimpan per deployment.
- CI: alternatif rollback = run ulang workflow dari commit lama.

---

## 7. Troubleshooting

| Gejala                                        | Penyebab umum                                                                  | Fix                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `no such table` setelah deploy                | Migrasi remote belum diapply (`deploy:api` root tidak menjalankan migrasi)     | `npx wrangler d1 migrations apply bits-pay-db --remote`; cek status: `... migrations list bits-pay-db --remote` |
| Migrasi gagal / database not found            | `database_id` masih placeholder `local-bits-pay-db`                            | `export D1_DATABASE_ID=<id asli>` lalu `pnpm cf:config` ulang sebelum migrasi/deploy                            |
| `/user/*` atau `/admin/*` 404                 | SPA belum di-copy ke `web/dist/{user,admin}`                                   | Ulangi step build SPA + `cp -r` (§3), deploy ulang web                                                          |
| Deep link SPA 404                             | SPA pakai hash router — path benar adalah `/user/#/route`, bukan `/user/route` | Akses via `/#/...`; jangan tambah `not_found_handling`                                                          |
| CORS error di browser                         | Origin tidak ada di `APP_URL`/`CORS_ORIGINS`, atau trailing slash              | Set `APP_URL=https://pay.bits.co.id` persis; tambah origin ke `CORS_ORIGINS`                                    |
| `401 unauthorized` dari `/v1`                 | Header salah format / pakai prefix key                                         | `Authorization: Bearer sk_<full key>` — key lengkap, bukan prefix                                               |
| Error JWT saat login (sign/verify)            | `JWT_SECRET` belum di-set di worker production                                 | `wrangler secret bulk` (§2), lalu verifikasi lagi                                                               |
| Google OAuth gagal                            | `GOOGLE_CLIENT_ID` kosong di vars / redirect mismatch                          | Isi vars `GOOGLE_CLIENT_ID` + `GOOGLE_REDIRECT_URI` persis sama dengan Google Console                           |
| Email tidak terkirim                          | Domain `FROM_EMAIL` belum diverifikasi                                         | Verifikasi domain di Cloudflare Email Routing                                                                   |
| Deploy gagal attach domain                    | Zone `bits.co.id` belum ada/aktif di akun Cloudflare                           | Tambahkan zone + arahkan nameserver, deploy ulang                                                               |
| Nama worker tabrakan antar workflow           | Repo Variable `WORKER_NAME` menimpa kedua workflow                             | Hapus/pisah per-environment (lihat ⚠️ §2)                                                                       |
| `wrangler deploy` web gagal: config tidak ada | `wrangler.jsonc` gitignored, belum digenerate                                  | `pnpm --filter @bits-pay/web cf:config` dulu                                                                    |

---

## Catatan

- Draft desain split lanjutan (4 worker: router/auth/payment/billing) versi sebelumnya dokumen ini
  **dihapus** — belum diimplementasi dan bukan bagian deployment saat ini. Versi lama dapat
  dilihat di git history (`git log -- docs/MULTI_WORKER.md`).
