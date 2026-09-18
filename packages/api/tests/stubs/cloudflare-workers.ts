// Stub minimal 'cloudflare:workers' untuk vitest — modul ini hanya ada di
// runtime Workers. Cukup agar `src/index.ts` (yang re-export RateLimiter DO)
// bisa di-import di test Node. Method DO tidak dipakai di unit test.
export class DurableObject {
  constructor(
    public ctx: unknown,
    public env: unknown,
  ) {}
}
