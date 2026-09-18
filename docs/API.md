# BITS Pay — API Documentation

**Base URL:** `https://api.pay.bits.co.id`

> Path di dokumen ini sudah termasuk prefix `/v1` untuk public API (mis. `POST /v1/charges`
> → `https://api.pay.bits.co.id/v1/charges`). Jangan gandakan prefix.

## Format Response

Semua response JSON dibungkus envelope yang sama:

```json
// Sukses
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "validation_error", "message": "...", "details": {} } }
```

- `details` opsional — map `field → string[]` untuk `validation_error`.
- Response paginated: `data` berisi `{ "items": [...], "page", "per_page", "total" }`.

**Timestamp:** semua field waktu di public API (`/v1/*`) berformat ISO-8601 UTC,
mis. `2026-09-02T12:45:00Z`.

**Batas ukuran request:**

| Request                            | Batas                                  |
| ---------------------------------- | -------------------------------------- |
| Body JSON `POST /v1/charges`       | 64 KB (`metadata` maks 4 KB)           |
| `proof_image` (confirm)            | 5 MB, JPG/PNG                          |
| Total multipart `POST .../confirm` | 6 MB — lebih → `413 payload_too_large` |

## Authentication

### API Key (untuk external apps, semua endpoint `/v1/*`)

```
Header: Authorization: Bearer sk_xxxxxxxxxxxxxxxx
```

> API key full (`sk_...`) hanya ditampilkan sekali saat create/rotate. DB hanya simpan
> `api_key_hash` (SHA-256) + `api_key_prefix`. Lookup app via `api_key_hash`, bukan prefix.
> Response `401` selalu menyertakan header `WWW-Authenticate: Bearer`.

### JWT (untuk user dashboard)

```
Header: Authorization: Bearer eyJhbGci...
```

## Endpoints

### 1. Charges

#### Create Charge

```
POST /v1/charges
```

**Request (application/json):**

```json
{
  "order_id": "ORD-001",
  "amount": 150000,
  "currency": "IDR",
  "description": "Pembayaran invoice #001",
  "metadata": {}
}
```

- `order_id` — wajib, unik per app untuk transaksi aktif (idempotency).
- `amount` — wajib, integer, min `100`, max `1_000_000_000`.
- `currency` — opsional, default `"IDR"`.
- `metadata` — opsional, object bebas, maks 4 KB (disimpan sebagai JSON string).

> `app_id` tidak ada di body. App diidentifikasi dari API key (`Authorization: Bearer sk_...`).

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "9b1f2c3e-...",
    "amount": 150000,
    "amount_due": 150001,
    "unique_code": 1,
    "currency": "IDR",
    "status": "pending",
    "qr_image": "data:image/png;base64,...",
    "qris_dynamic": "000201010212...",
    "expired_at": "2026-09-02T12:45:00Z",
    "created_at": "2026-09-02T12:30:00Z"
  }
}
```

**Unique Code — Rumus:**

```
amount_due = amount + unique_code
Contoh: 150000 + 1 = 150001
```

Range: `001` – `999` (env `MAX_UNIQUE_CODE`). Kode dicek available dari transaksi pending
yang belum expired. `amount_due` tidak bisa di-decompose balik — `amount` dan `unique_code`
selalu tersimpan sebagai kolom terpisah.

**Error:**

| HTTP | Code              | Penyebab                                                |
| ---- | ----------------- | ------------------------------------------------------- |
| 400  | validation_error  | Field tidak valid (cek `error.details`), metadata > 4KB |
| 400  | no_unique_code    | Semua kode unik terpakai                                |
| 401  | unauthorized      | API key salah / app nonaktif                            |
| 409  | duplicate_order   | `order_id` sudah dipakai transaksi aktif                |
| 409  | no_unique_code    | Gagal mengalokasikan kode unik (race) — coba lagi       |
| 413  | payload_too_large | Body > 64KB                                             |
| 429  | rate_limited      | Rate limit / kuota transaksi harian / bulanan tercapai  |

Contoh body error:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Validasi gagal",
    "details": { "amount": ["Amount minimal 100"] }
  }
}
```

### 2. Payments

#### List Payments

```
GET /v1/payments
```

Daftar transaksi milik app (scope dari API key), urut `created_at` terbaru dulu.
Berguna untuk rekonsiliasi (mis. lookup `order_id` setelah webhook terlewat).

**Query params:**

| Param    | Tipe    | Default | Keterangan                                                          |
| -------- | ------- | ------- | ------------------------------------------------------------------- |
| order_id | string  | —       | Lookup exact                                                        |
| status   | enum    | —       | `pending` \| `success` \| `failed` \| `expired` \| `pending_review` |
| page     | integer | 1       | Min 1                                                               |
| per_page | integer | 20      | Min 1, maks 100                                                     |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "9b1f2c3e-...",
        "order_id": "ORD-001",
        "amount": 150000,
        "unique_code": 1,
        "amount_due": 150001,
        "currency": "IDR",
        "status": "pending",
        "description": "Pembayaran invoice #001",
        "metadata": {},
        "paid_at": null,
        "expired_at": "2026-09-02T12:45:00Z",
        "created_at": "2026-09-02T12:30:00Z"
      }
    ],
    "page": 1,
    "per_page": 20,
    "total": 42
  }
}
```

#### Get Payment Status

```
GET /v1/payments/:id
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "9b1f2c3e-...",
    "order_id": "ORD-001",
    "amount": 150000,
    "unique_code": 1,
    "amount_due": 150001,
    "currency": "IDR",
    "status": "pending",
    "description": "Pembayaran invoice #001",
    "metadata": {},
    "paid_at": null,
    "expired_at": "2026-09-02T12:45:00Z",
    "created_at": "2026-09-02T12:30:00Z"
  }
}
```

> Objek payment publik hanya berisi field di atas — field internal (proof, OCR, hash)
> tidak diekspos. `metadata` dikembalikan sebagai object (atau `null`).

#### Confirm Payment

```
POST /v1/payments/:id/confirm
```

**Request (multipart/form-data):**

```
proof_image: File (JPG/PNG, maks 5MB) — opsional
amount: 150001  — wajib, harus sama persis dengan amount_due
```

**Request valid SELALU dijawab HTTP 200.** Hasil konfirmasi ada di `data.status` —
jangan andalkan status code HTTP:

| `data.status`    | `data.match_result` | Arti                                            |
| ---------------- | ------------------- | ----------------------------------------------- |
| `success`        | `auto_confirm`      | OCR cocok + confidence ≥ threshold — lunas      |
| `pending_review` | `low_confidence`    | Nominal cocok, confidence rendah — review admin |
| `failed`         | `mismatch`          | Nominal tidak cocok / bukti tidak disertakan    |

**Response (200) — sukses:**

```json
{
  "success": true,
  "data": {
    "id": "9b1f2c3e-...",
    "status": "success",
    "match_result": "auto_confirm",
    "ocr_amount": 150001,
    "ocr_confidence": 91,
    "paid_at": "2026-09-02T12:32:00Z"
  }
}
```

**Response (200) — pending review:**

```json
{
  "success": true,
  "data": {
    "id": "9b1f2c3e-...",
    "status": "pending_review",
    "match_result": "low_confidence",
    "ocr_amount": 150001,
    "ocr_confidence": 72,
    "paid_at": null,
    "message": "OCR confidence rendah, perlu review admin"
  }
}
```

**Response (200) — gagal:**

```json
{
  "success": true,
  "data": {
    "id": "9b1f2c3e-...",
    "status": "failed",
    "match_result": "mismatch",
    "ocr_amount": null,
    "ocr_confidence": null,
    "paid_at": null,
    "message": "Nominal tidak cocok"
  }
}
```

**Error (request tidak valid):**

| HTTP | Code              | Penyebab                                             |
| ---- | ----------------- | ---------------------------------------------------- |
| 400  | validation_error  | `amount` tidak disertakan / tidak valid              |
| 400  | invalid_status    | Transaksi bukan `pending` (sudah success/failed/...) |
| 400  | expired           | Transaksi sudah kedaluwarsa — buat charge baru       |
| 400  | invalid_proof     | Bukti bukan JPG/PNG valid (cek magic bytes)          |
| 400  | proof_too_large   | Bukti > 5MB                                          |
| 404  | not_found         | Transaksi tidak ditemukan                            |
| 409  | duplicate_hash    | Bukti bayar sudah dipakai transaksi lain             |
| 409  | invalid_status    | Race: transaksi sudah diproses request lain          |
| 413  | payload_too_large | Total multipart > 6MB                                |

### 3. Webhook / Callback

#### Callback Event (from BITS Pay to App)

```
POST {app_callback_url}
```

**Headers:**

```
Content-Type: application/json
X-BITS-Signature: <hex HMAC-SHA256>
X-BITS-Event: payment.success
```

**Payload (raw JSON string):**

```json
{
  "event": "payment.success",
  "transaction": {
    "id": "uuid-trx",
    "order_id": "ORD-001",
    "amount": 150000,
    "amount_due": 150001,
    "status": "success",
    "paid_at": "2026-09-02T12:32:00Z"
  }
}
```

**Events:**

| Event           | Description               |
| --------------- | ------------------------- |
| payment.success | Pembayaran berhasil       |
| payment.failed  | Pembayaran gagal / reject |
| payment.expired | Transaksi expired         |

#### Verifikasi Signature

Setiap callback dikirim dengan header `X-BITS-Signature` yang berisi HMAC-SHA256 dari body request. **Wajib diverifikasi** untuk memastikan callback benar-benar dikirim oleh BITS Pay.

**Header yang dikirim:**

| Header             | Value                                |
| ------------------ | ------------------------------------ |
| `Content-Type`     | `application/json`                   |
| `X-BITS-Signature` | Hex HMAC-SHA256 dari raw body string |
| `X-BITS-Event`     | Nama event (mis. `payment.success`)  |

**Algoritma signing:**

```
signature = HMAC-SHA256(secret, raw_body_string) → hex lowercase (64 karakter)
```

- **Input signing** = raw body string persis seperti yang diterima (bukan parsed object, bukan formatted ulang).
- **Secret** = `callback_secret` milik app Anda. Jika `callback_secret` tidak di-set (row lama), fallback ke `api_key_hash` app.
- **Output** = hex lowercase tanpa prefix (contoh: `a1b2c3d4e5...`, bukan `sha256=a1b2c3...`).

> Algoritma ini identik dengan `signCallbackPayload()` di `packages/shared/src/utils/crypto.ts`.

**Mendapatkan `callback_secret`:**

`callback_secret` di-generate otomatis saat app dibuat (`POST /app/workspaces/:wid/apps`).
Nilainya 64 karakter hex random. Response **create** dan **rotate-key**
(`POST /app/workspaces/:wid/apps/:id/rotate-key`) sama-sama mengembalikan
`api_key` DAN `callback_secret` — **hanya sekali** di response tersebut:

```json
{
  "success": true,
  "data": {
    "id": "uuid-app",
    "name": "Toko Saya",
    "api_key_prefix": "sk_ab12",
    "callback_url": "https://toko.id/webhook",
    "is_active": 1,
    "api_key": "sk_xxxxxxxxxxxxxxxx",
    "callback_secret": "64-karakter-hex..."
  }
}
```

Field `api_key` dan `callback_secret` tidak pernah di-expose di response `GET`/`UPDATE`.
Simpan di environment variable / secret manager sisi Anda.

> Rotate-key **tidak** mengubah `callback_secret` — ia menampilkan kembali secret yang sama
> bersama `api_key` BARU (key lama langsung tidak berlaku). Jika `callback_secret` hilang,
> panggil rotate-key untuk melihatnya lagi.

**Langkah verifikasi (di sisi Anda):**

1. Baca raw body sebagai string — **jangan parse JSON dulu**. Parsing mengubah urutan/spasi key, menghasilkan string berbeda dari yang di-sign.
2. Hitung `HMAC-SHA256(callback_secret, raw_body_string)`.
3. Bandingkan hasilnya dengan header `X-BITS-Signature` menggunakan **constant-time comparison** (timing-safe). Jangan pakai `===` biasa — rentan timing attack.
4. Jika cocok → proses callback. Jika tidak → reject (HTTP 403).

**Contoh verifikasi — Node.js / TypeScript (server-side):**

```typescript
import crypto from 'node:crypto';

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('hex'); // hex lowercase, 64 karakter

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  } catch {
    return false; // panjang beda → langsung reject
  }
}
```

**Contoh verifikasi — Web Crypto (Cloudflare Workers, browser, Node ≥ 18 tanpa `node:crypto`):**

```typescript
async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !/^[0-9a-f]{64}$/.test(signatureHeader)) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = new Uint8Array(signatureHeader.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

  // crypto.subtle.verify membandingkan MAC secara constant-time di dalam engine —
  // tidak ada early-exit, aman dari timing attack.
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(rawBody));
}
```

**Contoh handler — Hono / Cloudflare Worker:**

```typescript
app.post('/webhook/bits-pay', async (c) => {
  const secret = c.env.BITS_CALLBACK_SECRET; // simpan di env/secret
  const signature = c.req.header('X-BITS-Signature');
  const event = c.req.header('X-BITS-Event');

  // 1. Baca raw body (jangan .json())
  const rawBody = await c.req.text();

  // 2. Verifikasi signature
  if (!(await verifySignature(rawBody, signature ?? null, secret))) {
    return c.json({ error: 'Invalid signature' }, 403);
  }

  // 3. Baru parse payload
  const payload = JSON.parse(rawBody);
  console.log(`Event: ${event}, Order: ${payload.transaction.order_id}`);

  // 4. Proses sesuai event
  // ...

  return c.json({ received: true }, 200);
});
```

**Catatan keamanan:**

- **Jangan log raw body** di production. Body berisi data transaksi, logging berlebihan melanggar keamanan data.
- **Selalu pakai constant-time comparison** (`crypto.timingSafeEqual` di Node.js, `crypto.subtle.verify` di Web Crypto). `===` biasa bocor via timing side-channel.
- **Reject jika header `X-BITS-Signature` tidak ada.** Jangan skip verifikasi "untuk testing".
- **Simpan `callback_secret` di secret manager** (Cloudflare Secrets, Vault, env var), bukan di kode sumber atau database yang di-log.
- **URL callback harus HTTPS.** BITS Pay menolak HTTP URLs saat create/update app (SSRF defense).

### 4. Workspaces

#### List Workspaces

```
GET /app/workspaces
```

#### Create Workspace

```
POST /app/workspaces
```

#### Get Workspace

```
GET /app/workspaces/:id
```

#### Update Workspace

```
PUT /app/workspaces/:id
```

#### Delete Workspace

```
DELETE /app/workspaces/:id
```

#### List Members

```
GET /app/workspaces/:wid/members
```

#### Add Member

```
POST /app/workspaces/:wid/members
```

#### Update Member Role

```
PUT /app/workspaces/:wid/members/:id
```

#### Remove Member

```
DELETE /app/workspaces/:wid/members/:id
```

### 5. Apps

#### List Apps

```
GET /app/workspaces/:wid/apps
```

#### Create App

```
POST /app/workspaces/:wid/apps
```

Response (201) menyertakan `api_key` dan `callback_secret` — **hanya sekali**,
lihat [Mendapatkan `callback_secret`](#verifikasi-signature).

#### Get App

```
GET /app/workspaces/:wid/apps/:id
```

#### Update App

```
PUT /app/workspaces/:wid/apps/:id
```

#### Rotate API Key

```
POST /app/workspaces/:wid/apps/:id/rotate-key
```

Response (200) menyertakan `api_key` baru dan `callback_secret` — hanya sekali.
Key lama langsung tidak berlaku.

### 6. Subscriptions

#### Upgrade

```
POST /billing/subscriptions/upgrade
```

#### Current Subscription

```
GET /billing/subscriptions/current
```

#### Cancel

```
POST /billing/subscriptions/cancel
```

### 7. Invoices

#### List Invoices

```
GET /billing/invoices
```

#### Get Invoice

```
GET /billing/invoices/:id
```

#### Pay Invoice

```
POST /billing/invoices/:id/pay
```

### 8. Admin

#### Overview

```
GET /admin/overview
```

#### All Payments

```
GET /admin/payments
```

#### Payment Review Queue

```
GET /admin/payments/review
```

#### Confirm Payment

```
POST /admin/payments/:id/confirm
```

#### Reject Payment

```
POST /admin/payments/:id/reject
```

#### All Users

```
GET /admin/users
```

#### Update User

```
PUT /admin/users/:id
```

#### OCR Settings

```
GET /admin/settings/ocr
PUT /admin/settings/ocr
POST /admin/settings/ocr/test
```

### 9. Admin Tools (Sprint 3)

> Semua endpoint butuh `Authorization: Bearer <admin JWT>`. Admin diidentifikasi via `ADMIN_EMAILS` (wrangler vars).
> Response list paginated: `data` berisi `{ "items": [...], "page", "per_page", "total" }`.

#### List Callbacks

```
GET /admin/callbacks
```

**Query:** `page`, `per_page` (maks 100), `status` (`pending` | `success` | `failed` | `dead`)

#### Retry Callback

```
POST /admin/callbacks/:id/retry
```

**Response (200):**

```json
{
  "success": true,
  "data": { "ok": true }
}
```

#### Get OCR Settings

```
GET /admin/settings/ocr
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "ocr_provider": "workers-ai",
    "vps_ocr_url": "",
    "vps_ocr_api_key": ""
  }
}
```

> `ocr_provider`: `workers-ai` | `tesseract-vps`.

#### Update OCR Settings

```
PUT /admin/settings/ocr
```

**Request:**

```json
{
  "ocr_provider": "tesseract-vps",
  "vps_ocr_url": "http://...",
  "vps_ocr_api_key": "..."
}
```

> `vps_ocr_url` dan `vps_ocr_api_key` opsional.

#### Test OCR

```
POST /admin/settings/ocr/test
```

**Request (multipart/form-data):**

```
proof_image: File
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "amount": 150000,
    "confidence": 91,
    "merchant": "Toko X",
    "rawText": "...",
    "provider": "workers-ai"
  }
}
```

#### Get Email Templates

```
GET /admin/settings/email-templates
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "verify": "...",
    "reset": "...",
    "invoice_reminder": "..."
  }
}
```

#### Update Email Templates

```
PUT /admin/settings/email-templates
```

> Body partial: hanya kirim template yang mau diubah.

#### List Audit Logs

```
GET /admin/audit-logs
```

**Query:** `page`, `per_page`

#### Transaction Report

```
GET /admin/reports/transactions
```

**Query:** `days=30`

**Response (200):**

```json
{
  "success": true,
  "data": [
    { "day": "2026-08-02", "count": 12, "revenue": 1500000 },
    { "day": "2026-08-03", "count": 8, "revenue": 900000 }
  ]
}
```

#### Export Report (CSV)

```
GET /admin/reports/export
```

**Query:** `days=30`

> Download CSV.

#### Get Tier Features

```
GET /admin/tier-features
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "free": { "max_workspaces": 1, "max_apps": 1 },
    "premium": { "max_workspaces": 1, "max_apps": 3 }
  }
}
```

#### Update Tier Features

```
PUT /admin/tier-features
```

**Request:**

```json
{
  "free": { "max_apps": 2 },
  "premium": { "max_apps": 10 }
}
```

> Body `free` dan `premium` opsional, berisi `Partial<TierFeatures>`.

## Error Codes

Semua error: `{ "success": false, "error": { "code", "message", "details?" } }`.

| Code              | HTTP    | Arti                                         | Solusi                                   |
| ----------------- | ------- | -------------------------------------------- | ---------------------------------------- |
| validation_error  | 400     | Body/query tidak valid (cek `error.details`) | Perbaiki field yang disebut di `details` |
| invalid_status    | 400/409 | Transaksi bukan `pending` / sudah diproses   | Cek status via `GET /v1/payments/:id`    |
| expired           | 400     | Transaksi kedaluwarsa                        | Buat charge baru                         |
| invalid_proof     | 400     | Bukti bukan JPG/PNG valid                    | Upload file gambar asli                  |
| proof_too_large   | 400     | Bukti bayar > 5MB                            | Kompres gambar                           |
| unauthorized      | 401     | API key salah / app nonaktif                 | Cek API key (header `WWW-Authenticate`)  |
| not_found         | 404     | Resource tidak ditemukan                     | Cek ID                                   |
| duplicate_order   | 409     | `order_id` sudah dipakai transaksi aktif     | Pakai `order_id` lain / tunggu expired   |
| duplicate_hash    | 409     | Bukti bayar sudah dipakai                    | Upload bukti lain                        |
| no_unique_code    | 400/409 | Kode unik habis / gagal alokasi              | Coba lagi sesaat                         |
| payload_too_large | 413     | Body charge > 64KB / multipart confirm > 6MB | Kecilkan payload                         |
| rate_limited      | 429     | Rate limit / kuota transaksi tercapai        | Tunggu sesuai header `Retry-After`       |
| internal_error    | 500     | Error server                                 | Coba lagi, hubungi admin                 |

## Rate Limits

Limit endpoint `/v1/*` per app, dari `tier_features.api_rate_limit` milik pemilik app:

| Tier    | Limit     |
| ------- | --------- |
| Free    | 10 req/s  |
| Premium | 100 req/s |

Header response (selalu ada):

| Header                  | Isi                               |
| ----------------------- | --------------------------------- |
| `X-RateLimit-Limit`     | Limit req/s untuk app             |
| `X-RateLimit-Remaining` | Sisa request di window berjalan   |
| `X-RateLimit-Reset`     | Epoch detik saat window reset     |
| `Retry-After`           | Detik tunggu — **hanya pada 429** |
