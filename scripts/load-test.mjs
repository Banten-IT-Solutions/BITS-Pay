#!/usr/bin/env node
/**
 * BITS Pay — Load test sederhana (zero dependency, Node >= 18).
 *
 * Cara pakai:
 *   pnpm load-test                                  # default: http://localhost:7001, 20 worker, 15s, skenario mixed
 *   node scripts/load-test.mjs --url https://api.pay.bits.co.id --scenario health
 *   node scripts/load-test.mjs --scenario auth --workers 50 --duration 30
 *   node scripts/load-test.mjs --requests 5000      # berhenti setelah N request (override --duration)
 *
 * Skenario:
 *   health  — GET /health (throughput murni, tanpa auth).
 *   auth    — POST /v1/charges dengan API key palsu → expect 401.
 *             Menguji jalur auth middleware + rate limit tanpa perlu seed DB.
 *   mixed   — 80% health + 20% auth (default).
 *
 * Menambah skenario charge sukses (butuh D1 + app valid): set env BITS_API_KEY
 * dengan API key asli, lalu tambah skenario baru yang POST /v1/charges dengan
 * header `X-Api-Key: ${process.env.BITS_API_KEY}` dan body charge valid.
 * Jangan jalankan skenario ini ke produksi tanpa izin — membuat row payments asli.
 *
 * Env:
 *   BASE_URL   — target (sama dengan --url)
 *   WORKERS    — konkurensi (default 20)
 *   DURATION_S — durasi detik (default 15)
 *   P99_MS     — threshold p99, exit 1 bila terlampaui (default 2000)
 *
 * Exit code: 1 bila p99 > P99_MS atau error 5xx > 1% total request. 429 (rate
 * limit) dihitung terpisah, bukan error.
 */

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  const head = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//);
  console.log(head ? head[1].trim() : 'Lihat komentar header file.');
  process.exit(0);
}

import { readFileSync } from 'node:fs';

const BASE_URL = (args.url || process.env.BASE_URL || 'http://localhost:7001').replace(/\/$/, '');
const WORKERS = Number(args.workers || process.env.WORKERS || 20);
const DURATION_S = Number(args.duration || process.env.DURATION_S || 15);
const MAX_REQUESTS = Number(args.requests || 0); // 0 = mode durasi
const P99_MS = Number(process.env.P99_MS || 2000);
const SCENARIO = args.scenario || 'mixed';

const FAKE_KEY = 'bits_test_load_invalid_key';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--'))
      out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

/** Satu request, return { latencyMs, status } */
async function fire(kind) {
  const start = performance.now();
  let status = 0;
  try {
    let res;
    if (kind === 'auth') {
      res = await fetch(`${BASE_URL}/v1/charges`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': FAKE_KEY },
        body: JSON.stringify({ order_id: 'load-test', amount: 10000 }),
      });
    } else {
      res = await fetch(`${BASE_URL}/health`);
    }
    status = res.status;
    await res.arrayBuffer(); // habiskan body supaya koneksi reuse
  } catch {
    status = -1; // network error
  }
  return { latencyMs: performance.now() - start, status };
}

function pickKind() {
  if (SCENARIO === 'mixed') return Math.random() < 0.8 ? 'health' : 'auth';
  return SCENARIO;
}

/** Statistik per skenario */
function makeStats() {
  return { total: 0, latencies: [], byStatus: new Map(), err5xx: 0, err429: 0, errNet: 0 };
}

const stats = { health: makeStats(), auth: makeStats() };
let issued = 0;
const stopAt = MAX_REQUESTS > 0 ? Infinity : Date.now() + DURATION_S * 1000;

async function worker() {
  while (Date.now() < stopAt && (MAX_REQUESTS === 0 || issued < MAX_REQUESTS)) {
    const kind = pickKind();
    issued++;
    const { latencyMs, status } = await fire(kind);
    const s = stats[kind];
    s.total++;
    s.latencies.push(latencyMs);
    s.byStatus.set(status, (s.byStatus.get(status) || 0) + 1);
    if (status === 429) s.err429++;
    else if (status === -1) s.errNet++;
    else if (status >= 500) s.err5xx++;
  }
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

function report(name, s, elapsedS) {
  const sorted = [...s.latencies].sort((a, b) => a - b);
  const statuses = [...s.byStatus.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, n]) => `${code === -1 ? 'NET_ERR' : code}:${n}`)
    .join(' ');
  console.log(`\n[${name}] total=${s.total} rps=${(s.total / elapsedS).toFixed(1)}`);
  console.log(
    `  latency ms: p50=${pct(sorted, 50).toFixed(0)} p95=${pct(sorted, 95).toFixed(0)} p99=${pct(sorted, 99).toFixed(0)} max=${(sorted.at(-1) || 0).toFixed(0)}`,
  );
  console.log(`  status: ${statuses}`);
  console.log(`  429=${s.err429} 5xx=${s.err5xx} net_err=${s.errNet}`);
  return { p99: pct(sorted, 99), err5xx: s.err5xx };
}

console.log(
  `Target=${BASE_URL} scenario=${SCENARIO} workers=${WORKERS} ${MAX_REQUESTS > 0 ? `requests=${MAX_REQUESTS}` : `duration=${DURATION_S}s`} p99_threshold=${P99_MS}ms`,
);

const startAll = Date.now();
await Promise.all(Array.from({ length: WORKERS }, worker));
const elapsedS = (Date.now() - startAll) / 1000;

let worstP99 = 0;
let totalAll = 0;
let err5xxAll = 0;
for (const [name, s] of Object.entries(stats)) {
  if (s.total === 0) continue;
  const r = report(name, s, elapsedS);
  worstP99 = Math.max(worstP99, r.p99);
  totalAll += s.total;
  err5xxAll += r.err5xx;
}

const err5xxRate = totalAll > 0 ? err5xxAll / totalAll : 0;
console.log(
  `\nTOTAL=${totalAll} rps=${(totalAll / elapsedS).toFixed(1)} 5xx_rate=${(err5xxRate * 100).toFixed(2)}%`,
);

let fail = false;
if (worstP99 > P99_MS) {
  console.error(`FAIL: p99 ${worstP99.toFixed(0)}ms > threshold ${P99_MS}ms`);
  fail = true;
}
if (err5xxRate > 0.01) {
  console.error(`FAIL: 5xx rate ${(err5xxRate * 100).toFixed(2)}% > 1%`);
  fail = true;
}
process.exit(fail ? 1 : 0);
