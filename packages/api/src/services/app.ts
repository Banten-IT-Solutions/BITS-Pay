import { z } from 'zod';
import { generateApiKey, type App, type AppPublic, type UserTier } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { TierService } from './tier';

export const createAppSchema = z.object({
  name: z.string().min(1, 'Nama app wajib diisi'),
  callback_url: z.string().url('URL callback tidak valid').optional().or(z.literal('')),
});

export const updateAppSchema = z.object({
  name: z.string().min(1).optional(),
  callback_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

export class AppService {
  static async list(env: Env, workspaceId: string): Promise<AppPublic[]> {
    const { results } = await env.DB.prepare(
      'SELECT id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at FROM apps WHERE workspace_id = ? ORDER BY created_at DESC',
    )
      .bind(workspaceId)
      .all<AppPublic>();
    return results ?? [];
  }

  static async create(
    env: Env,
    userId: string,
    workspaceId: string,
    input: z.infer<typeof createAppSchema>,
  ): Promise<AppPublic & { api_key: string }> {
    const user = await env.DB.prepare('SELECT tier FROM users WHERE id = ?')
      .bind(userId)
      .first<{ tier: UserTier }>();
    if (!user) throw AppError.notFound('User');

    const features = await TierService.getTierFeatures(env, user.tier);
    const existing = await this.list(env, workspaceId);
    TierService.checkLimit('max_apps', existing.length, features.max_apps);

    const { key, prefix, hash } = await generateApiKey();
    const id = crypto.randomUUID();
    const app = await env.DB.prepare(
      'INSERT INTO apps (id, workspace_id, name, api_key_hash, api_key_prefix, callback_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at',
    )
      .bind(id, workspaceId, input.name, hash, prefix, input.callback_url ?? null)
      .first<AppPublic>();
    if (!app) throw AppError.internal('Gagal membuat app');

    return { ...app, api_key: key };
  }

  static async get(env: Env, workspaceId: string, appId: string): Promise<App> {
    const app = await env.DB.prepare('SELECT * FROM apps WHERE id = ? AND workspace_id = ?')
      .bind(appId, workspaceId)
      .first<App>();
    if (!app) throw AppError.notFound('App');
    return app;
  }

  static async update(
    env: Env,
    workspaceId: string,
    appId: string,
    input: z.infer<typeof updateAppSchema>,
  ): Promise<App> {
    const app = await this.get(env, workspaceId, appId);

    const name = input.name ?? app.name;
    const callbackUrl =
      input.callback_url !== undefined ? input.callback_url || null : app.callback_url;
    const isActive = input.is_active !== undefined ? (input.is_active ? 1 : 0) : app.is_active;

    const updated = await env.DB.prepare(
      "UPDATE apps SET name = ?, callback_url = ?, is_active = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
      .bind(name, callbackUrl, isActive, appId)
      .first<App>();
    if (!updated) throw AppError.internal('Gagal update app');
    return updated;
  }

  static async rotateKey(
    env: Env,
    workspaceId: string,
    appId: string,
  ): Promise<AppPublic & { api_key: string }> {
    await this.get(env, workspaceId, appId);

    const { key, prefix, hash } = await generateApiKey();
    const updated = await env.DB.prepare(
      "UPDATE apps SET api_key_hash = ?, api_key_prefix = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at",
    )
      .bind(hash, prefix, appId)
      .first<AppPublic>();
    if (!updated) throw AppError.internal('Gagal rotate key');

    return { ...updated, api_key: key };
  }
}
