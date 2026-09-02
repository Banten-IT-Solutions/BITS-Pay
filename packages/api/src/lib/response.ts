import { Context } from 'hono';

export function success<T>(c: Context, data: T, status = 200, meta?: object) {
  return c.json({ success: true, data, ...(meta ? { meta } : {}) }, status as 200);
}

export function paginated<T>(c: Context, data: T[], total: number, page: number, perPage: number) {
  return success(c, data, 200, { page, per_page: perPage, total });
}
