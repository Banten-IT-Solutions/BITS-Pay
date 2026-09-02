import { createMiddleware } from 'hono/factory';
import { hashApiKey } from '@bits-pay/shared';
import { AppError } from '../lib/errors';

declare module 'hono' {
  interface ContextVariableMap {
    app: { id: string; workspace_id: string; api_rate_limit: number };
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
    `SELECT a.id, a.workspace_id, a.is_active, tf.api_rate_limit
     FROM apps a
     JOIN workspaces w ON w.id = a.workspace_id
     JOIN users u ON u.id = w.user_id
     JOIN tier_features tf ON tf.tier = u.tier
     WHERE a.api_key_hash = ?`,
  )
    .bind(hash)
    .first()) as {
    id: string;
    workspace_id: string;
    is_active: number;
    api_rate_limit: number;
  } | null;
  if (!app || !app.is_active) throw AppError.unauthorized('API key tidak dikenal');
  c.set('app', { id: app.id, workspace_id: app.workspace_id, api_rate_limit: app.api_rate_limit });
  await next();
});
