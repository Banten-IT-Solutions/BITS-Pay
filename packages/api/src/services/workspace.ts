import { z } from 'zod';
import type { Workspace, WorkspaceWithMemberCount } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { TierService } from './tier';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Nama workspace wajib diisi'),
  slug: z
    .string()
    .min(1, 'Slug wajib diisi')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  description: z.string().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().optional(),
});

export class WorkspaceService {
  static async list(env: Env, userId: string): Promise<WorkspaceWithMemberCount[]> {
    const { results } = await env.DB.prepare(
      `SELECT w.*,
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM apps WHERE workspace_id = w.id) as app_count
       FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
       WHERE w.is_active = 1
       ORDER BY w.created_at DESC`,
    )
      .bind(userId)
      .all<WorkspaceWithMemberCount>();
    return results ?? [];
  }

  static async create(
    env: Env,
    userId: string,
    input: z.infer<typeof createWorkspaceSchema>,
  ): Promise<Workspace> {
    const features = await TierService.getTierFeatures(env, 'free');
    const existing = await this.list(env, userId);
    TierService.checkLimit('max_workspaces', existing.length, features.max_workspaces);

    const slugExists = await env.DB.prepare('SELECT id FROM workspaces WHERE slug = ?')
      .bind(input.slug)
      .first();
    if (slugExists) throw AppError.conflict('slug_exists', 'Slug sudah digunakan');

    const id = crypto.randomUUID();
    const workspace = await env.DB.prepare(
      'INSERT INTO workspaces (id, user_id, name, slug, description) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
      .bind(id, userId, input.name, input.slug, input.description ?? null)
      .first<Workspace>();
    if (!workspace) throw AppError.internal('Gagal membuat workspace');

    await env.DB.prepare(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), id, userId, 'owner')
      .run();

    return workspace;
  }

  static async get(env: Env, userId: string, workspaceId: string): Promise<Workspace> {
    const member = await env.DB.prepare(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    )
      .bind(workspaceId, userId)
      .first();
    if (!member) throw AppError.notFound('Workspace');

    const workspace = await env.DB.prepare('SELECT * FROM workspaces WHERE id = ?')
      .bind(workspaceId)
      .first<Workspace>();
    if (!workspace) throw AppError.notFound('Workspace');
    return workspace;
  }

  static async update(
    env: Env,
    userId: string,
    workspaceId: string,
    input: z.infer<typeof updateWorkspaceSchema>,
  ): Promise<Workspace> {
    const workspace = await this.get(env, userId, workspaceId);
    if (workspace.user_id !== userId) {
      throw AppError.unauthorized('Hanya owner yang bisa mengubah workspace');
    }

    if (input.slug && input.slug !== workspace.slug) {
      const slugExists = await env.DB.prepare(
        'SELECT id FROM workspaces WHERE slug = ? AND id != ?',
      )
        .bind(input.slug, workspaceId)
        .first();
      if (slugExists) throw AppError.conflict('slug_exists', 'Slug sudah digunakan');
    }

    const name = input.name ?? workspace.name;
    const slug = input.slug ?? workspace.slug;
    const description = input.description !== undefined ? input.description : workspace.description;

    const updated = await env.DB.prepare(
      "UPDATE workspaces SET name = ?, slug = ?, description = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
      .bind(name, slug, description, workspaceId)
      .first<Workspace>();
    if (!updated) throw AppError.internal('Gagal update workspace');
    return updated;
  }

  static async delete(env: Env, userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.get(env, userId, workspaceId);
    if (workspace.user_id !== userId) {
      throw AppError.unauthorized('Hanya owner yang bisa menghapus workspace');
    }

    await env.DB.prepare('UPDATE workspaces SET is_active = 0 WHERE id = ?')
      .bind(workspaceId)
      .run();
  }
}
