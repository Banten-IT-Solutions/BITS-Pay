# BITS Pay — API Documentation

**Base URL:** `https://api.pay.bits.co.id/v1`

## Authentication

### API Key (untuk external apps)
```
Header: Authorization: Bearer sk_xxxxxxxxxxxxxxxx
```

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
  "app_id": "uuid-app",
  "order_id": "ORD-001",
  "amount": 150000,
  "currency": "IDR",
  "description": "Pembayaran invoice #001",
  "metadata": {}
}
```

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
  "error": "invalid_amount",
  "message": "Amount harus minimal Rp 100"
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
  "amount_due": 150001,
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
amount: 150001
```

**Response (200):**
```json
{
  "id": "uuid-trx",
  "status": "success",
  "match_result": "auto_confirm",
  "ocr_amount": 150001,
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
X-BITS-Signature: hmac_sha256(secret, payload)
X-BITS-Event: payment.success
```

**Payload:**
```json
{
  "event": "payment.success",
  "transaction": {
    "id": "uuid-trx",
    "order_id": "ORD-001",
    "amount": 150000,
    "amount_due": 150001,
    "status": "success",
    "paid_at": "2025-09-01T12:32:00Z"
  }
}
```

**Events:**
| Event | Description |
|-------|-------------|
| payment.success | Pembayaran berhasil |
| payment.failed | Pembayaran gagal / reject |
| payment.expired | Transaksi expired |

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

## Error Codes

| Code | HTTP | Arti | Solusi |
|------|------|------|--------|
| invalid_amount | 400 | Amount tidak valid | Minimal Rp 100 |
| invalid_app | 400 | App ID tidak ditemukan | Cek app_id |
| unauthorized | 401 | API key salah | Cek API key |
| expired | 410 | Transaksi expired | Buat baru |
| duplicate_hash | 409 | Bukti sudah dipakai | Upload bukti lain |
| rate_limited | 429 | Limit tercapai | Tunggu, cek tier |
| internal_error | 500 | Error server | Coba lagi, hubungi admin |

## Rate Limits

| Tier | Limit |
|------|-------|
| Free | 10 req/s |
| Premium | 100 req/s |

Header response: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
