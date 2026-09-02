# OCR Server (Tesseract) — BITS Pay

Server HTTP kecil pembungkus Tesseract OCR. Dipakai provider `tesseract-vps`
(`packages/api/src/services/ocr/tesseract-vps.ts`).

## Kontrak

```
POST /
Authorization: Bearer <OCR_API_KEY>   # hanya bila OCR_API_KEY diset
{"image": "<base64>"}

200 {"amount": 15000, "confidence": 87.5, "merchant": "TOKO ABC", "raw_text": "..."}
```

`amount` integer rupiah atau `null`. `confidence` 0-100. HTTP non-2xx = gagal.

## Run

```bash
cd infra/ocr
export OCR_API_KEY=rahasia-panjang-acak   # opsional tapi disarankan
docker compose up -d --build
```

Cloudflare Worker lalu dikonfigurasi: `vps_ocr_url=http://<host>:8080/`,
`vps_ocr_api_key=<OCR_API_KEY>`.

## Healthcheck

```bash
curl localhost:8080/healthz
# {"ok":true}

curl -X POST localhost:8080/ \
  -H "Authorization: Bearer $OCR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"image":"<base64 png/jpg struk>"}'
```

## Env

| Var           | Default | Keterangan                             |
| ------------- | ------- | -------------------------------------- |
| `OCR_API_KEY` | kosong  | Bila diset, POST / wajib Bearer token. |
| `PORT`        | `8080`  | Port listen di dalam container.        |

## Catatan operasional

- Bahasa terpasang: `eng` saja. Tambah `tesseract-ocr-ind` di Dockerfile bila
  struk Indonesia banyak istilah non-Inggris (umumnya `eng` cukup untuk
  angka/nominal).
- `--psm 6` default (struk kolom tunggal). Tune di `server.py` bila akurasi jelek.
- Heuristic `amount`/`merchant` sengaja sederhana — lihat komentar `ponytail:`
  di `server.py` untuk batas dan kapan memperbaiki.
- Container jalan non-root, limit 1 CPU / 512 MB. OCR gambar besar memakan CPU;
  naikkan limit di `docker-compose.yml` bila perlu.
- Jangan expose port publik tanpa `OCR_API_KEY`. Idealnya di belakang reverse
  proxy TLS + firewall (hanya Cloudflare yang boleh akses).

## Rollback

```bash
docker compose down
git checkout <ref-sebelumnya> -- infra/ocr && docker compose up -d --build
```
