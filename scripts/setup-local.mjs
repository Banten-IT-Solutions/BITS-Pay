// Setup lokal idempotent untuk BITS Pay dev.
// - packages/api/.dev.vars (JWT_SECRET >=32 char, QRIS_STATIC test, dll)
// - packages/{web,user,admin}/.env (VITE_API_URL)
// - D1 migrations --local
// Aman dijalankan berulang: file existing tidak ditimpa.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const log = (msg) => console.log(`[setup] ${msg}`);

// --- 1. packages/api/.dev.vars ---
const devVarsPath = join(root, 'packages/api/.dev.vars');
const genSecret = () => randomBytes(48).toString('hex');

const devVarsTemplate = () =>
  [
    `JWT_SECRET=${genSecret()}`,
    'JWT_EXPIRES_IN=7d',
    // QRIS static test payload (merchant test, bukan produksi)
    'QRIS_STATIC=00020101021126640012ID.CO.BITS.WWW01189360091200008080240215BITS-PAY-TEST5204000053033605802ID5914BITS Pay Test6007Banten61053630062070703A016304',
    'APP_URL=http://localhost:5173',
    'FROM_EMAIL=noreply@pay.bits.co.id',
    'TRANSACTION_EXPIRE_MINUTES=15',
    'PREMIUM_PRICE_MONTHLY=50000',
    'PREMIUM_PRICE_YEARLY=500000',
    'GOOGLE_CLIENT_ID=dummy-client-id',
    'GOOGLE_CLIENT_SECRET=dummy-client-secret',
    'GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback',
    'OCR_CONFIDENCE_THRESHOLD=85',
    'MAX_UNIQUE_CODE=9999',
    'PROOF_RETENTION_DAYS=30',
    'ADMIN_EMAILS=admin@bits.co.id',
    '',
  ].join('\n');

if (!existsSync(devVarsPath)) {
  writeFileSync(devVarsPath, devVarsTemplate());
  log('buat packages/api/.dev.vars (JWT_SECRET digenerate)');
} else {
  const content = readFileSync(devVarsPath, 'utf8');
  const match = content.match(/^JWT_SECRET=(.*)$/m);
  const secret = match?.[1]?.trim() ?? '';
  if (secret.length < 32) {
    const line = `JWT_SECRET=${genSecret()}`;
    const next = match
      ? content.replace(/^JWT_SECRET=.*$/m, line)
      : `${line}\n${content}`;
    writeFileSync(devVarsPath, next);
    log('JWT_SECRET di .dev.vars terlalu pendek/kosong — digenerate ulang');
  } else {
    log('.dev.vars OK, skip');
  }
}

// --- 2. Frontend .env ---
for (const pkg of ['web', 'user', 'admin']) {
  const envPath = join(root, `packages/${pkg}/.env`);
  if (!existsSync(envPath)) {
    writeFileSync(envPath, 'VITE_API_URL=http://localhost:8787\n');
    log(`buat packages/${pkg}/.env`);
  } else {
    log(`packages/${pkg}/.env OK, skip`);
  }
}

// --- 3. D1 migrations lokal ---
log('apply D1 migrations (--local)...');
execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], {
  cwd: join(root, 'packages/api'),
  stdio: 'inherit',
});

log('selesai');
