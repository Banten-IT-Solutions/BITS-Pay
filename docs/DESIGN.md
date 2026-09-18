# DESIGN.md — BITS Pay

Design system landing page `packages/web`. Terinspirasi dari [Sanity DESIGN.md](https://github.com/VoltAgent/awesome-design-md) (dark editorial, mono teknis, satu aksen), diadaptasi ke identitas QRIS.

## 1. Tema & Atmosfer

"Ledger / struk digital" — halaman terasa seperti artefak transaksi (stiker QRIS, terminal log, nominal mono), bukan template SaaS. Kanvas netral, satu aksen merah QRIS yang disiplin.

## 2. Warna

| Token             | Light        | Dark      | Peran                                 |
| ----------------- | ------------ | --------- | ------------------------------------- |
| `--bg`            | `#fafafa`    | `#0e0f12` | Kanvas                                |
| `--surface`       | `#ffffff`-an | `#16181d` | Kartu, panel                          |
| `--surface-2`     | `#f0f0f1`-an | `#1d2026` | Lapis kedua                           |
| `--border`        | `#e2e4e8`-an | `#262932` | Hairline 1px                          |
| `--text`          | `#17181c`    | `#ecedef` | Teks utama                            |
| `--muted`         | `#555a63`    | `#a3a8b1` | Teks sekunder                         |
| `--faint`         | `#878c96`    | `#6e737d` | Metadata                              |
| `--accent`        | `#e0272f`    | `#e0272f` | **Merah QRIS — CTA & highlight saja** |
| `--accent-strong` | `#ba1e25`    | `#f03a42` | Hover CTA                             |
| `--success`       | `#157a3e`    | —         | Status sukses                         |
| `--warning`       | `#b45309`    | —         | Status pending                        |

Aturan aksen: merah hanya untuk CTA primary, kode unik, badge Populer, kicker, panel CTA akhir. Bukan untuk hover sembarang elemen, bukan gradient.

## 3. Tipografi

| Peran             | Font          | Catatan                                                 |
| ----------------- | ------------- | ------------------------------------------------------- |
| Display/headline  | Space Grotesk | 600–700, tracking negatif (-0.02–0.035em), LH 1.05–1.18 |
| Body/UI           | IBM Plex Sans | 400–600, LH 1.5                                         |
| Teknis/angka/kode | IBM Plex Mono | Label teknis uppercase, nominal `tabular-nums`          |

- Hero: `clamp(2.4rem, 5vw, 3.5rem)` Space Grotesk 700.
- Section title: `clamp(1.6rem, 3.2vw, 2.2rem)` Space Grotesk 600.
- Kicker: IBM Plex Mono 0.72rem uppercase, tracking 0.1em, warna aksen, prefix `//`.
- Weight maks 700 (display) / 600 (UI). Tidak ada 800+.

## 4. Komponen

- **Primary CTA**: pill penuh (`border-radius: 999px`), bg aksen, teks putih. Hover → `--accent-strong`.
- **Secondary/ghost**: radius kecil (`--radius: 8px`), border hairline.
- **Radius scale**: 2px (bar) / 4–6px (input, badge, chip) / 8px (default) / 12px (kartu besar, window). **Tidak ada 13–998px** — lompat langsung ke pill.
- **Depth colorimetric**: kartu dinaikkan via border & warna surface, BUKAN offset shadow. Pengecualian: `.window` hero (artefak macOS) & modal boleh `--shadow-lg`. Featured state pakai ring `0 0 0 1px var(--accent)`.
- **Stiker QRIS** (`.qris-sticker`): selalu putih di kedua tema — artefak cetakan. QR asli 61×61 + logo merah tengah, chevron merah kiri.
- **Terminal log** (`.terminal`): panel gelap konstan di kedua tema untuk seksi "cara kerja".

## 5. Layout & Spacing

- Container max 1160px, gutter 1.5rem.
- Section padding 6rem desktop → 3.5rem di ≤900px (~40%).
- Grid fitur: 3 kolom → 1 kolom (520px). Pricing: 2 → 1 kolom (560px).
- Breakpoint: 900px, 520px.

## 6. Motion

- Odometer kode unik (hero): kolom digit 0–9, `translateY`, stagger 120ms.
- Scan-line QR: sweep 3.2s loop.
- Countdown expiry: tick 1 detik, merah saat < 1 menit.
- Reveal-on-scroll: IntersectionObserver, `.reveal` → `.visible`.
- Semua animasi mati di `prefers-reduced-motion`. Konten tetap terlihat tanpa JS (`.js` gating).

## 7. Do & Don't

**Do:** satu aksen merah disiplin · border 1px hairline · mono untuk data/angka · tracking negatif di display · konten produk nyata (formula, NMID, HMAC) sebagai elemen desain.

**Don't:** gradient warna-warni · emoji sebagai ikon · offset shadow untuk elevasi kartu · radius 13–998px · pill untuk elemen non-CTA · lebih dari satu warna aksen · hover biru (Sanity pakai, kita tidak — merah adalah identitas).
