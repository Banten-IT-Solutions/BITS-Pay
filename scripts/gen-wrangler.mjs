// Generate packages/<pkg>/wrangler.jsonc dari wrangler.template.jsonc + env.
// Usage: node scripts/gen-wrangler.mjs <api|web>
// CI: nilai dari GitHub Variables/Secrets (di-inject workflow deploy-*.yml).
// Lokal: default di DEFAULTS dipakai; secret lewat .dev.vars (bukan vars).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = process.argv[2];

// Default untuk dev lokal. CI selalu override via env.
const DEFAULTS = {
  api: {
    WORKER_NAME: 'bits-pay-api',
    API_DOMAIN: 'api.pay.bits.co.id',
    D1_DATABASE_NAME: 'bits-pay-db',
    D1_DATABASE_ID: 'local-bits-pay-db',
    R2_BUCKET_NAME: 'bits-pay-proofs',
    CALLBACK_QUEUE_NAME: 'payment-callback',
    APP_URL: 'https://pay.bits.co.id',
    FROM_EMAIL: 'noreply@pay.bits.co.id',
    TRANSACTION_EXPIRE_MINUTES: '15',
    PREMIUM_PRICE_MONTHLY: '50000',
    PREMIUM_PRICE_YEARLY: '500000',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_REDIRECT_URI: 'https://api.pay.bits.co.id/auth/google/callback',
    JWT_EXPIRES_IN: '7d',
    ADMIN_EMAILS: '',
    OCR_CONFIDENCE_THRESHOLD: '85',
    MAX_UNIQUE_CODE: '999',
    PROOF_RETENTION_DAYS: '30',
  },
  web: {
    WORKER_NAME: 'bits-pay-web',
    WEB_DOMAIN: 'pay.bits.co.id',
  },
};

const defaults = DEFAULTS[pkg];
if (!defaults) {
  console.error(`Unknown package: ${pkg} (expected: ${Object.keys(DEFAULTS).join('|')})`);
  process.exit(1);
}

const pkgDir = resolve(root, 'packages', pkg);
const template = readFileSync(resolve(pkgDir, 'wrangler.template.jsonc'), 'utf8');
const output = template.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => {
  // `||` (bukan `??`): env kosong dari CI jatuh ke default.
  const value = process.env[key] || defaults[key];
  if (value === undefined) {
    console.error(`Missing value for \${${key}} (no env, no default)`);
    process.exit(1);
  }
  return JSON.stringify(String(value)).slice(1, -1);
});

writeFileSync(resolve(pkgDir, 'wrangler.jsonc'), output);

const leftover = output.match(/\$\{[A-Za-z0-9_]+\}/g);
if (leftover) {
  console.error(`Unreplaced placeholders: ${leftover.join(', ')}`);
  process.exit(1);
}

console.log(`✓ Generated packages/${pkg}/wrangler.jsonc`);
console.log(`  Worker: ${process.env.WORKER_NAME || defaults.WORKER_NAME}`);
