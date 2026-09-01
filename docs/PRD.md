# BITS Pay — Product Requirements Document

## 1. Ringkasan

BITS Pay adalah **QRIS payment gateway** untuk aplikasi internal dan eksternal (SaaS). Mengubah QRIS static menjadi dinamis dengan kode unik per transaksi, ditambah OCR untuk auto-confirm pembayaran.

**Tagline:** QRIS payment gateway untuk aplikasi kamu

## 2. Tujuan

- Satu entry point payment untuk semua aplikasi internal BITS
- Otomatisasi konfirmasi pembayaran via OCR
- Multi-tenant SaaS dengan tier Free & Premium
- Dogfooding: subscription BITS Pay sendiri pakai BITS Pay

## 3. Target Audiens

- **Developer:** Mau integrasi payment lewat API, webhook
- **Bisnis/UMKM:** Mau dashboard, laporan, no coding

## 4. Fitur Utama (MVP)

### Fase 1 — Core Payment
| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| QRIS Static → Dynamic | Convert via `bits-qris` library, generate kode unik | P0 |
| Create Charge API | `POST /v1/charges` — buat transaksi baru | P0 |
| Confirm Payment | Upload bukti + OCR + auto-confirm | P0 |
| Payment Status | `GET /v1/payments/:id` — cek status | P0 |
| Callback Webhook | Notifikasi ke app via HTTP POST | P0 |
| Callback Retry | Queue + retry 3x (exponential backoff) | P0 |
| Transaksi Expire | 15 menit auto-expire via cron | P0 |

### Fase 2 — Multi-Tenant
| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| User Auth | Email/password + Google OAuth | P0 |
| Email Verification | Verifikasi email setelah signup | P0 |
| Password Reset | Lupa password via email | P0 |
| Workspace CRUD | Buat, edit, hapus workspace | P0 |
| App CRUD | Buat app per workspace, API key | P0 |
| API Key Management | Generate, rotate, revoke | P0 |
| Callback Log | Riwayat callback per app | P1 |
| Team Members | Invite, role (owner/admin/member) | P1 |

### Fase 3 — Billing & Subscription
| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| Tier Features | Free (1 wkspc, 1 app, 100 txn) vs Premium | P0 |
| Subscription | Upgrade via QRIS invoice | P0 |
| Invoice Generation | Invoice + QRIS dinamis | P0 |
| Invoice Reminder | Email H-3, H-1 via Cloudflare Email | P0 |
| Premium Expiry | Cron check + auto-downgrade | P0 |
| Subscription Invoice | Riwayat invoice user | P1 |

### Fase 4 — Admin
| Fitur | Deskripsi | Prioritas |
|-------|-----------|-----------|
| Admin Overview | Dashboard stats (total txn, users, revenue) | P0 |
| Payment Review | Queue transaksi perlu review manual | P0 |
| Approve/Reject | Confirm atau reject transaksi | P0 |
| All Transactions | Lihat semua transaksi + filter | P0 |
| User Management | Lihat, edit, suspend user | P1 |
| Callback Monitor | Lihat callback gagal, retry manual | P1 |
| OCR Config | Pilih provider Workers AI / Tesseract | P1 |
| Audit Log | Riwayat aksi admin | P1 |
| Reports | Laporan transaksi, revenue, export CSV | P2 |

## 5. User Stories

### Sebagai Developer
- "Saya mau integrasi payment lewat API, cukup 3 endpoint"
- "Saya mau tau kapan pembayaran sukses lewat webhook"
- "Saya mau test API dulu sebelum production"

### Sebagai User (Merchant)
- "Saya mau lihat semua transaksi masuk"
- "Saya mau filter transaksi berdasarkan status"
- "Saya mau export laporan transaksi"

### Sebagai Premium User
- "Saya mau upgrade ke premium biar bisa lebih banyak transaksi"
- "Saya mau bayar premium pake QRIS"
- "Saya mau tau kapan premium expired"

### Sebagai Admin
- "Saya mau review transaksi yang OCR-nya ragu"
- "Saya mau lihat total revenue dan user growth"
- "Saya mau ganti OCR provider tanpa deploy"

## 6. Non-Functional Requirements

| Aspek | Requirement |
|-------|-------------|
| **Performance** | API response < 500ms (non-OCR). OCR < 3s |
| **Availability** | 99.9% uptime target |
| **Security** | API key hashing, JWT expiry, rate limiting |
| **Scalability** | 1 Worker cukup untuk 100k req/hari |
| **SEO** | Landing page HTML static, meta tags |
| **Mobile** | Dashboard responsive, bisa dari HP |

## 7. Pricing

| Fitur | Free | Premium (Rp 50k/bln) |
|-------|------|---------------------|
| Workspace | 1 | 3 |
| App per workspace | 1 | 5 |
| Transaksi/bulan | 100 | 10.000 |
| API Rate Limit | 10 req/s | 100 req/s |
| Callback URL | ❌ | ✅ |
| Webhook Retry | - | 3x |
| Export Report | ❌ | ✅ CSV |
| Manual Review | ❌ | ✅ |
| Team Members | 1 | 5 |

## 8. Success Metrics

- **MVP Launch:** 4 minggu
- **Target user:** 10 internal apps + 5 external users (bulan 1)
- **Domain:** pay.bits.co.id (app) + api.pay.bits.co.id (API)
- **Transaksi:** 1000 transaksi/bulan (bulan 1)
- **OCR akurasi:** > 90% auto-confirm rate
