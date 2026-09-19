import { z } from 'zod';
import { isValidQris } from 'bits-qris';
import {
  generateApiKey,
  generateToken,
  type AppPublic,
  type AppWithSecrets,
  type MemberRole,
  type UserTier,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { validateCallbackUrl } from '../lib/ssrf';
import { TierService } from './tier';

export const createAppSchema = z.object({
  name: z.string().min(1, 'Nama app wajib diisi'),
  callback_url: z.string().url('URL callback tidak valid').optional().or(z.literal('')),
});

// Kolom QRIS dipilih eksplisit (bukan SELECT *) supaya response stabil.
const APP_PUBLIC_COLS =
  'id, workspace_id, name, api_key_prefix, callback_url, is_active, qris_static, created_at, updated_at';

export const updateAppSchema = z.object({
  name: z.string().min(1).optional(),
  callback_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  // null / string kosong = hapus QRIS. Non-empty wajib payload QRIS valid.
  qris_static: z
    .string()
    .max(512, 'QRIS static maksimal 512 karakter')
    .nullable()
    .optional()
    .refine((v) => !v || isValidQris(v), { message: 'Format QRIS static tidak valid' }),
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
      `SELECT ${APP_PUBLIC_COLS} FROM apps WHERE workspace_id = ? ORDER BY created_at DESC`,
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
  ): Promise<AppWithSecrets> {
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
    const callbackSecret = generateToken(32);
    const id = crypto.randomUUID();
    const app = await env.DB.prepare(
      `INSERT INTO apps (id, workspace_id, name, api_key_hash, api_key_prefix, callback_url, callback_secret) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${APP_PUBLIC_COLS}`,
    )
      .bind(id, workspaceId, input.name, hash, prefix, callbackUrl, callbackSecret)
      .first<AppPublic>();
    if (!app) throw AppError.internal('Gagal membuat app');

    return { ...app, api_key: key, callback_secret: callbackSecret };
  }

  static async get(
    env: Env,
    userId: string,
    workspaceId: string,
    appId: string,
  ): Promise<AppPublic> {
    await this.requireMember(env, workspaceId, userId);
    const app = await env.DB.prepare(
      `SELECT ${APP_PUBLIC_COLS} FROM apps WHERE id = ? AND workspace_id = ?`,
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
    // undefined = tidak diubah; null/string kosong = hapus QRIS.
    const qrisStatic =
      input.qris_static !== undefined ? input.qris_static || null : app.qris_static;

    const updated = await env.DB.prepare(
      `UPDATE apps SET name = ?, callback_url = ?, is_active = ?, qris_static = ?, updated_at = datetime('now') WHERE id = ? RETURNING ${APP_PUBLIC_COLS}`,
    )
      .bind(name, callbackUrl, isActive, qrisStatic, appId)
      .first<AppPublic>();
    if (!updated) throw AppError.internal('Gagal update app');
    return updated;
  }

  static async rotateKey(
    env: Env,
    userId: string,
    workspaceId: string,
    appId: string,
  ): Promise<AppWithSecrets> {
    await this.requireMember(env, workspaceId, userId, true);
    await this.get(env, userId, workspaceId, appId);

    const { key, prefix, hash } = await generateApiKey();
    const updated = await env.DB.prepare(
      `UPDATE apps SET api_key_hash = ?, api_key_prefix = ?, updated_at = datetime('now') WHERE id = ? RETURNING ${APP_PUBLIC_COLS}`,
    )
      .bind(hash, prefix, appId)
      .first<AppPublic>();
    if (!updated) throw AppError.internal('Gagal rotate key');

    // Secret tidak ikut RETURNING (dipakai list/detail) — ambil eksplisit di sini
    // supaya bisa ditampilkan sekali bersama api_key baru.
    const secret = await env.DB.prepare('SELECT callback_secret FROM apps WHERE id = ?')
      .bind(appId)
      .first<{ callback_secret: string | null }>();

    return { ...updated, api_key: key, callback_secret: secret?.callback_secret ?? '' };
  }
}
