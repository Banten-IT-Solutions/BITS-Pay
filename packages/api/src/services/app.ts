import { z } from 'zod';
import { generateApiKey, type AppPublic, type MemberRole, type UserTier } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { validateCallbackUrl } from '../lib/ssrf';
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
  private static async requireMember(
    env: Env,
    workspaceId: string,
    userId: string,
    write = false,
  ): Promise<{ role: MemberRole }> {
    const member = await env.DB.prepare(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    )
      .bind(workspaceId, userId)
      .first<{ role: MemberRole }>();
    if (!member) throw AppError.notFound('Workspace');
    if (write && member.role !== 'owner' && member.role !== 'admin') {
      throw AppError.unauthorized('Hanya owner/admin yang bisa melakukan aksi ini');
    }
    return member;
  }

  static async list(env: Env, userId: string, workspaceId: string): Promise<AppPublic[]> {
    await this.requireMember(env, workspaceId, userId);
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
    await this.requireMember(env, workspaceId, userId, true);

    const callbackUrl = input.callback_url || null;
    if (callbackUrl) validateCallbackUrl(callbackUrl);

    const user = await env.DB.prepare('SELECT tier FROM users WHERE id = ?')
      .bind(userId)
      .first<{ tier: UserTier }>();
    if (!user) throw AppError.notFound('User');

    const features = await TierService.getTierFeatures(env, user.tier);
    if (callbackUrl && !features.callback_allowed) {
      throw AppError.badRequest('tier_limit', 'Callback URL hanya tersedia untuk premium');
    }
    const existing = await this.list(env, userId, workspaceId);
    TierService.checkLimit('max_apps', existing.length, features.max_apps);

    const { key, prefix, hash } = await generateApiKey();
    const id = crypto.randomUUID();
    const app = await env.DB.prepare(
      'INSERT INTO apps (id, workspace_id, name, api_key_hash, api_key_prefix, callback_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at',
    )
      .bind(id, workspaceId, input.name, hash, prefix, callbackUrl)
      .first<AppPublic>();
    if (!app) throw AppError.internal('Gagal membuat app');

    return { ...app, api_key: key };
  }

  static async get(
    env: Env,
    userId: string,
    workspaceId: string,
    appId: string,
  ): Promise<AppPublic> {
    await this.requireMember(env, workspaceId, userId);
    const app = await env.DB.prepare(
      'SELECT id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at FROM apps WHERE id = ? AND workspace_id = ?',
    )
      .bind(appId, workspaceId)
      .first<AppPublic>();
    if (!app) throw AppError.notFound('App');
    return app;
  }

  static async update(
    env: Env,
    userId: string,
    workspaceId: string,
    appId: string,
    input: z.infer<typeof updateAppSchema>,
  ): Promise<AppPublic> {
    await this.requireMember(env, workspaceId, userId, true);
    const app = await this.get(env, userId, workspaceId, appId);

    const name = input.name ?? app.name;
    const callbackUrl =
      input.callback_url !== undefined ? input.callback_url || null : app.callback_url;
    if (callbackUrl) validateCallbackUrl(callbackUrl);
    const isActive = input.is_active !== undefined ? (input.is_active ? 1 : 0) : app.is_active;

    const updated = await env.DB.prepare(
      "UPDATE apps SET name = ?, callback_url = ?, is_active = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, workspace_id, name, api_key_prefix, callback_url, is_active, created_at, updated_at",
    )
      .bind(name, callbackUrl, isActive, appId)
      .first<AppPublic>();
    if (!updated) throw AppError.internal('Gagal update app');
    return updated;
  }

  static async rotateKey(
    env: Env,
    userId: string,
    workspaceId: string,
    appId: string,
  ): Promise<AppPublic & { api_key: string }> {
    await this.requireMember(env, workspaceId, userId, true);
    await this.get(env, userId, workspaceId, appId);

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
