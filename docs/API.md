# BITS Pay — API Documentation

**Base URL:** `https://api.pay.bits.co.id/v1`

## Authentication

### API Key (untuk external apps)

```
Header: Authorization: Bearer sk_xxxxxxxxxxxxxxxx
```

> API key full (`sk_...`) hanya ditampilkan sekali saat create/rotate. DB hanya simpan `api_key_hash` (SHA-256) + `api_key_prefix`. Lookup app via `api_key_hash`, bukan prefix.

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

**Request:**

```json
{
  "order_id": "ORD-001",
  "amount": 150000,
  "currency": "IDR",
  "description": "Pembayaran invoice #001",
  "metadata": {}
}
```

> `app_id` tidak ada di body. App diidentifikasi dari API key (`Authorization: Bearer sk_...`).

**Response (201):**

```json
{
  "id": "uuid-trx",
  "amount": 150000,
  "amount_due": 1500000001,
  "unique_code": 1,
  "currency": "IDR",
  "status": "pending",
  "qr_image": "data:image/png;base64,...",
  "qris_dynamic": "000201010212...",
  "expired_at": "2025-09-01T12:45:00Z",
  "created_at": "2025-09-01T12:30:00Z"
}
```

**Unique Code — Rumus:**

```
amount_due = amount × 10000 + unique_code
Contoh: 150000 × 10000 + 1 = 1500000001

Extract amount asli: Math.floor(amount_due / 10000)  → 150000
Extract kode:        amount_due % 10000              → 1
```

Range: `0001` – `9999`. Kode dicek available dari transaksi pending yang belum expired.

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "invalid_amount",
    "message": "Amount harus minimal Rp 100"
  }
}
```

### 2. Payments

#### Get Payment Status

```
GET /v1/payments/:id
```

**Response:**

```json
{
  "id": "uuid-trx",
  "app_id": "uuid-app",
  "order_id": "ORD-001",
  "amount": 150000,
  "amount_due": 1500000001,
  "status": "pending",
  "created_at": "2025-09-01T12:30:00Z",
  "paid_at": null,
  "expired_at": "2025-09-01T12:45:00Z"
}
```

#### Confirm Payment

```
POST /v1/payments/:id/confirm
```

**Request (multipart/form-data):**

```
proof_image: File (jpg/png, max 5MB)
amount: 1500000001
```

**Response (200):**

```json
{
  "id": "uuid-trx",
  "status": "success",
  "match_result": "auto_confirm",
  "ocr_amount": 1500000001,
  "ocr_confidence": 91,
  "paid_at": "2025-09-01T12:32:00Z"
}
```

**Response (202 — pending review):**

```json
{
  "id": "uuid-trx",
  "status": "pending_review",
  "match_result": "low_confidence",
  "ocr_amount": 150000,
  "ocr_confidence": 72,
  "message": "OCR confidence rendah, perlu review admin"
}
```

**Response (400 — mismatch):**

```json
{
  "id": "uuid-trx",
  "status": "failed",
  "match_result": "mismatch",
  "message": "Nominal tidak cocok"
}
```

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
    "amount_due": 1500000001,
    "status": "success",
    "paid_at": "2025-09-01T12:32:00Z"
  }
}
```

> Contoh `amount_due` di atas fix: `1500000001` (bukan `150001`), konsisten rumus `amount × 10000 + unique_code`.

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

`callback_secret` di-generate otomatis saat app dibuat (`POST /app/workspaces/:wid/apps`). Nilainya 64 karakter hex random. **Secret hanya ditampilkan sekali saat create app** (field ini tidak di-expose di response `GET` atau `UPDATE` app). Simpan di environment variable / secret manager sisi Anda.

> Jika Anda tidak menyimpan `callback_secret` saat create, Anda perlu rotate atau buat app baru.

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

**Contoh handler — Hono / Cloudflare Worker:**

```typescript
app.post('/webhook/bits-pay', async (c) => {
  const secret = c.env.BITS_CALLBACK_SECRET; // simpan di env/secret
  const signature = c.req.header('X-BITS-Signature');
  const event = c.req.header('X-BITS-Event');

  // 1. Baca raw body (jangan .json())
  const rawBody = await c.req.text();

  // 2. Verifikasi signature
  if (!verifySignature(rawBody, signature, secret)) {
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
- **Selalu pakai constant-time comparison** (`crypto.timingSafeEqual` di Node.js, `crypto.subtle.timingSafeEqual` atau manual XOR di Web Crypto). `===` biasa bocor via timing side-channel.
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

#### List Callbacks

```
GET /admin/callbacks
```

**Query:** `page`, `per_page`, `status`

> Response paginated `callbacks` dengan meta `{ page, per_page, total }`.

#### Retry Callback

```
POST /admin/callbacks/:id/retry
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "pending",
    "attempt": 1
  }
}
```

#### Get OCR Settings

```
GET /admin/settings/ocr
```

**Response (200):**

```json
{
  "ocr_provider": "workers-ai",
  "vps_ocr_url": "",
  "vps_ocr_api_key": ""
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
  "amount": 150000,
  "confidence": 91,
  "merchant": "Toko X",
  "rawText": "...",
  "provider": "workers-ai"
}
```

#### Get Email Templates

```
GET /admin/settings/email-templates
```

**Response (200):**

```json
{
  "verify": "...",
  "reset": "...",
  "invoice_reminder": "..."
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

> Response paginated `audit_logs`.

#### Transaction Report

```
GET /admin/reports/transactions
```

**Query:** `days=30`

**Response (200):**

```json
[
  { "day": "2025-08-02", "count": 12, "revenue": 1500000 },
  { "day": "2025-08-03", "count": 8, "revenue": 900000 }
]
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
  "free": { "max_workspaces": 1, "max_apps": 1 },
  "premium": { "max_workspaces": 3, "max_apps": 5 }
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

| Code           | HTTP | Arti                   | Solusi                   |
| -------------- | ---- | ---------------------- | ------------------------ |
| invalid_amount | 400  | Amount tidak valid     | Minimal Rp 100           |
| invalid_app    | 400  | App ID tidak ditemukan | Cek app_id               |
| unauthorized   | 401  | API key salah          | Cek API key              |
| expired        | 410  | Transaksi expired      | Buat baru                |
| duplicate_hash | 409  | Bukti sudah dipakai    | Upload bukti lain        |
| rate_limited   | 429  | Limit tercapai         | Tunggu, cek tier         |
| internal_error | 500  | Error server           | Coba lagi, hubungi admin |

## Rate Limits

| Tier    | Limit     |
| ------- | --------- |
| Free    | 10 req/s  |
| Premium | 100 req/s |

Header response: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
