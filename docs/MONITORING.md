# BITS Pay — Monitoring & Observability Runbook

Runbook observability produksi. Stack: Cloudflare Workers (api + web), D1, R2, Queues, Durable Objects, Cron 5 menit.

## 1. Yang Sudah Ada

| Komponen             | Status                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /health`        | Endpoint liveness di Worker api (`packages/api/src/index.ts`). Return `{ success, data.status }`.      |
| Workers Analytics    | Bawaan Cloudflare: request count, status code, CPU time per route. Dashboard → Workers → bits-pay-api. |
| Cron safety net      | Cron `*/5 * * * *` re-claim callback `failed` → `pending` via `next_retry_at` (lihat `src/index.ts`).  |
| CI + deploy workflow | `.github/workflows/ci.yml`, `deploy-api.yml`, `deploy-web.yml`.                                        |

**Catatan jujur:** `docs/DEVOPS.md` menyebut `.github/workflows/uptime.yml`, tapi file itu **belum ada** di repo. Belum ada uptime check eksternal maupun halaman `/status` publik. Keduanya masuk rekomendasi di bawah.

## 2. Aktifkan Workers Logs (tanpa infrastruktur baru)

Tambah di `packages/api/wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1,   // 1 = 100% request tercatat; turunkan (mis. 0.1) bila volume besar
},
```

Efek: Workers Logs (log request + `console.*` + exception, persist, bisa difilter di dashboard) dan binding ke Analytics/Logpush. Tanpa ini, log hilang begitu request selesai kecuali `wrangler tail` sedang jalan.

## 3. Uptime Check Eksternal (rekomendasi)

Butuh monitor di luar Cloudflare supaya tahu saat worker/edge down total. Opsi termurah: workflow GitHub Actions terjadwal (buat `.github/workflows/uptime.yml` — sekaligus menutup gap dengan DEVOPS.md):

```yaml
name: uptime
on:
  schedule: [{ cron: '*/5 * * * *' }]
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://api.pay.bits.co.id/health)
          [ "$code" = "200" ] || { echo "health check gagal: $code"; exit 1; }
```

Notifikasi kegagalan via GitHub (email ke watcher / CODEOWNERS). Alternatif gratis: Better Stack, UptimeRobot. **Belum diimplementasikan** — buat saat go-live.

## 4. Alert via Cloudflare Notifications

Dashboard → Notifications → Add. Alert bawaan yang relevan, tanpa config kode:

| Alert                            | Threshold awal               |
| -------------------------------- | ---------------------------- |
| Workers — invocations error rate | > 1% selama 5 menit          |
| Workers — CPU time per request   | > 30 ms rata-rata 5 menit    |
| Queues — consumer errors         | > 0 selama 5 menit           |
| D1 — query errors                | > 0 selama 5 menit           |
| Usage-based billing spike        | request > 2× baseline harian |

## 5. Metrik Kunci & Cara Cek

| Metrik                  | Sumber                                         | Cara cek / query                                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error rate `/v1/*`      | Workers Analytics (filter status 5xx per path) | Dashboard → bits-pay-api → Metrics, group by status + path. Target < 0.5%.                                                                                                                                                                                       |
| Latency p95             | Workers Analytics (duration percentiles)       | Target p95 < 500 ms untuk `/v1/charges`.                                                                                                                                                                                                                         |
| Callback stuck          | D1 query                                       | `SELECT COUNT(*) FROM callbacks WHERE status='failed' AND next_retry_at < datetime('now','-15 minutes')` — harus 0; cron retry (5 menit) adalah safety net, angka > 0 berarti retry gagal terus → cek `packages/api/src/index.ts` cron handler + Queue consumer. |
| Queue depth / consumer  | Queue metrics di dashboard                     | Backlog naik terus = consumer error atau callback endpoint merchant lambat. Consumer: `max_retries: 3, max_batch_size: 10`.                                                                                                                                      |
| D1 rows / query latency | D1 dashboard                                   | Pantau growth tabel `payments`, `callbacks`, `audit_logs`; query latency p95 < 50 ms.                                                                                                                                                                            |
| DO RateLimiter          | Workers Analytics (filter DO class)            | 429 rate tinggi di luar burst wajar = abuse atau limit terlalu ketat.                                                                                                                                                                                            |
| R2 storage              | R2 dashboard                                   | Growth vs `PROOF_RETENTION_DAYS=30` — pastikan cleanup jalan.                                                                                                                                                                                                    |
| Cron run                | Workers Logs                                   | Filter `cron` event tiap 5 menit; absence = trigger gagal.                                                                                                                                                                                                       |

## 6. Load Test Pre-Deploy

Jalankan `scripts/load-test.mjs` (lihat header file untuk cara pakai):

```bash
pnpm load-test                                        # lokal, mixed, 15s
node scripts/load-test.mjs --url https://api.pay.bits.co.id --scenario health --workers 50 --duration 30
```

Exit 1 bila p99 > `P99_MS` (default 2000) atau 5xx > 1%. 429 dihitung terpisah. **Jangan** tembak produksi dengan konkurensi besar tanpa koordinasi — rate limiter dan D1 punya batas.

## 7. Opsi Berbayar (belum diimplementasikan)

| Opsi                           | Isi                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Workers Logpush                | Kirim Workers Logs/Trace Events ke R2 atau HTTP endpoint → tarik ke Grafana Cloud Loki untuk dasbor + alert custom.     |
| Workers Trace Events (OTel)    | Export trace ke backend OTLP (Grafana Cloud Tempo).                                                                     |
| Grafana Cloud free tier        | Bisa jadi sink Logpush tanpa bayar sampai limit; dasbor contoh: error rate, p95 latency, queue backlog, callback stuck. |
| Status page publik (`/status`) | Belum ada. Bisa pakai instansi open-source atau halaman statis sederhana yang membaca `/health`.                        |

Implementasikan hanya bila alert bawaan Cloudflare (bagian 4) tidak cukup.

## 8. Respon Insiden Ringkas

1. Cek Cloudflare Status (statuscloudflare.net) — outages edge di luar kendali kita.
2. Dashboard Workers → error spike? Lihat Workers Logs untuk stack trace.
3. Rollback cepat: `pnpm deploy:api` dari commit terakhir yang baik, atau dashboard → Deployments → rollback ke versi sebelumnya.
4. Callback gagal massal: cek queue consumer error; cron 5 menit akan retry otomatis — verifikasi via query callback stuck di bagian 5.
