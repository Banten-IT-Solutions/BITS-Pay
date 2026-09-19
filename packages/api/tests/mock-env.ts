import type { Env } from '../src/config';

export interface MockAppRow {
  id: string;
  workspace_id: string;
  is_active: number;
  api_rate_limit: number;
  qris_static?: string | null;
}

/** DB mock: prepare().bind().first() selalu return row yang sama. */
export function mockDb(firstRow: unknown): D1Database {
  return {
    prepare: () => ({
      bind: () => ({ first: () => Promise.resolve(firstRow) }),
    }),
  } as unknown as D1Database;
}

export interface SqlRoute {
  /** Substring / RegExp yang dicocokkan ke SQL. Urutan array = prioritas (first match menang) — taruh query spesifik sebelum prefix generiknya. */
  match: string | RegExp;
  /** Hasil .first() (default null). */
  first?: (params: unknown[]) => unknown;
  /** Hasil .all().results (default []). */
  all?: (params: unknown[]) => unknown[];
  /** .run() → meta.changes (default 1). */
  run?: (params: unknown[]) => number;
}

/** DB mock berbasis routing SQL: cocokkan query ke handler per statement. */
export function mockDbDispatch(routes: SqlRoute[]): D1Database {
  const prepare = (sql: string) => {
    const route = routes.find((r) =>
      typeof r.match === 'string' ? sql.includes(r.match) : r.match.test(sql),
    );
    if (!route) throw new Error(`mockDbDispatch: tidak ada route untuk SQL: ${sql}`);
    const stmt = (params: unknown[]) => ({
      first: <T = unknown>() => Promise.resolve((route.first ? route.first(params) : null) as T),
      all: <T = unknown>() =>
        Promise.resolve({ results: (route.all ? route.all(params) : []) as T[] }),
      run: () => Promise.resolve({ meta: { changes: route.run ? route.run(params) : 1 } }),
    });
    // Spread stmt([]) → dukung prepare(...).first()/.all()/.run() tanpa .bind().
    return { bind: (...params: unknown[]) => stmt(params), ...stmt([]) };
  };
  return { prepare } as unknown as D1Database;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/** RATE_LIMITER DO mock: return result tetap, atau reject bila dikasih Error. */
export function mockRateLimiter(result: RateLimitResult | Error): DurableObjectNamespace {
  return {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: () => {
        if (result instanceof Error) return Promise.reject(result);
        return Promise.resolve(Response.json(result));
      },
    }),
  } as unknown as DurableObjectNamespace;
}

export function mockEnv(overrides: Partial<Record<keyof Env, unknown>> = {}): Env {
  return { ...overrides } as unknown as Env;
}
