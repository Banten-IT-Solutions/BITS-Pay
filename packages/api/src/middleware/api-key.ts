import { createMiddleware } from 'hono/factory';
import { hashApiKey } from '@bits-pay/shared';
import { AppError } from '../lib/errors';

declare module 'hono' {
  interface ContextVariableMap {
    app: { id: string; workspace_id: string };
  }
}

export const requireApiKey = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer sk_')) {
    throw AppError.unauthorized('API key tidak valid');
  }
  const key = header.slice(7);
  const hash = await hashApiKey(key);
  const app = (await c.env.DB.prepare(
    'SELECT id, workspace_id, is_active FROM apps WHERE api_key_hash = ?',
  )
    .bind(hash)
    .first()) as { id: string; workspace_id: string; is_active: number } | null;
  if (!app || !app.is_active) throw AppError.unauthorized('API key tidak dikenal');
  c.set('app', { id: app.id, workspace_id: app.workspace_id });
  await next();
});
