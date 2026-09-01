# Security Policy

## Reporting a Vulnerability

Jika kamu menemukan vulnerability security di BITS Pay, laporkan ke:

**Email:** security@bits.co.id

**Do not** buat issue di GitHub untuk security report.

## What We Expect

1. Kirim email dengan detail vulnerability
2. Kami akan merespons dalam 48 jam
3. Kami akan patch dan credit kamu (kalau mau)

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| API endpoint (`api.pay.bits.co.id`) | Landing page (static) |
| Auth flow | Third-party libraries |
| Payment processing | Client-side code |
| Data storage (D1, R2) | DNS / Cloudflare infra |
| Email sending | Rate limiting bypass (mass send) |
| Callback webhook | Social engineering |
| OAuth flow | DDoS |
| QRIS generation | Vulnerability di dependency |

## Bug Bounty

Tidak ada bounty. Tapi kami akan:
- Credit kamu di README (kalau mau)
- Fix cepat
- Notifikasi setelah patched

## Safe Harbor

Kami tidak akan legal action terhadap security researcher yang follow responsible disclosure.
