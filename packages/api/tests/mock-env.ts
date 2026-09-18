import type { Env } from '../src/config';

export interface MockAppRow {
  id: string;
  workspace_id: string;
  is_active: number;
  api_rate_limit: number;
}

/** DB mock: prepare().bind().first() selalu return row yang sama. */
export function mockDb(firstRow: unknown): D1Database {
  return {
    prepare: () => ({
      bind: () => ({ first: () => Promise.resolve(firstRow) }),
    }),
  } as unknown as D1Database;
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
