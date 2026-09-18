// E2E smoke BITS Pay (landing statis packages/web).
//
// Cara jalan:
//   pnpm --filter @bits-pay/web build   # sekali saja (serve dari dist/)
//   pnpm test:e2e
//
// Server dist/ di-start otomatis via webServer (python3 http.server).
// Override target: E2E_BASE_URL=https://pay.bits.co.id pnpm test:e2e
//   (webServer di-skip otomatis bila port sudah terpakai / server existing).
// Browser: channel 'chrome' (google-chrome terinstall) — TANPA `playwright install`.
// Test /docs/ butuh internet (CDN jsdelivr untuk Scalar).
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:7002';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
  },
  projects: [{ name: 'chrome', use: { channel: 'chrome' } }],
  webServer: {
    command: 'python3 -m http.server 7002 --bind 127.0.0.1 -d packages/web/dist',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
