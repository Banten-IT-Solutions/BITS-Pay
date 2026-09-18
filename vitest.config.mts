import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Modul runtime Workers — tidak resolvable di Node. Stub agar
      // packages/api/src/index.ts bisa di-import utuh di test.
      'cloudflare:workers': fileURLToPath(
        new URL('./packages/api/tests/stubs/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // tests-e2e/ sengaja TIDAK di-include — itu Playwright, dijalankan via `pnpm test:e2e`.
    include: ['packages/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
