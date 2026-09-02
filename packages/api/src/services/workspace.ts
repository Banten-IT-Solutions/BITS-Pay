import { z } from 'zod';
import type {
  Workspace,
  WorkspaceWithMemberCount,
  WorkspaceMember,
  UserTier,
} from '@bits-pay/shared';
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

export const inviteMemberSchema = z.object({
  email: z.string().email('Email tidak valid'),
  role: z.enum(['admin', 'member']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
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
    const user = await env.DB.prepare('SELECT tier FROM users WHERE id = ?')
      .bind(userId)
      .first<{ tier: UserTier }>();
    const features = await TierService.getTierFeatures(env, user?.tier ?? 'free');
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

  static async getMemberRole(
    env: Env,
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const member = await env.DB.prepare(
      'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    )
      .bind(workspaceId, userId)
      .first<WorkspaceMember>();
    return member ?? null;
  }

  static async listMembers(
    env: Env,
    userId: string,
    workspaceId: string,
  ): Promise<(WorkspaceMember & { email: string; name: string; avatar_url: string | null })[]> {
    const actor = await this.getMemberRole(env, workspaceId, userId);
    if (!actor) throw AppError.notFound('Workspace');

    const { results } = await env.DB.prepare(
      `SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.email, u.name, u.avatar_url
       FROM workspace_members wm
       INNER JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?
       ORDER BY wm.joined_at ASC`,
    )
      .bind(workspaceId)
      .all<WorkspaceMember & { email: string; name: string; avatar_url: string | null }>();
    return results ?? [];
  }

  static async inviteMember(
    env: Env,
    actorUserId: string,
    workspaceId: string,
    input: z.infer<typeof inviteMemberSchema>,
  ): Promise<WorkspaceMember & { email: string; name: string }> {
    const actorMember = await this.getMemberRole(env, workspaceId, actorUserId);
    if (!actorMember || (actorMember.role !== 'owner' && actorMember.role !== 'admin')) {
      throw AppError.unauthorized('Hanya owner/admin yang bisa mengundang anggota');
    }

    const targetUser = await env.DB.prepare('SELECT id, email, name FROM users WHERE email = ?')
      .bind(input.email)
      .first<{ id: string; email: string; name: string }>();
    if (!targetUser) throw AppError.notFound('User dengan email tersebut');

    const owner = await env.DB.prepare(
      'SELECT tier FROM users WHERE id = (SELECT user_id FROM workspaces WHERE id = ?)',
    )
      .bind(workspaceId)
      .first<{ tier: UserTier }>();
    const features = await TierService.getTierFeatures(env, owner?.tier ?? 'free');
    const { results: currentMembers } = await env.DB.prepare(
      'SELECT COUNT(*) as c FROM workspace_members WHERE workspace_id = ?',
    )
      .bind(workspaceId)
      .all<{ c: number }>();
    const memberCount = currentMembers?.[0]?.c ?? 0;
    TierService.checkLimit('max_team_members', memberCount, features.max_team_members);

    const existing = await env.DB.prepare(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    )
      .bind(workspaceId, targetUser.id)
      .first();
    if (existing) throw AppError.conflict('member_exists', 'User sudah menjadi anggota');

    const id = crypto.randomUUID();
    const member = await env.DB.prepare(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?) RETURNING *',
    )
      .bind(id, workspaceId, targetUser.id, input.role)
      .first<WorkspaceMember>();
    if (!member) throw AppError.internal('Gagal menambahkan anggota');

    return { ...member, email: targetUser.email, name: targetUser.name };
  }

  static async updateMemberRole(
    env: Env,
    actorUserId: string,
    workspaceId: string,
    memberId: string,
    role: z.infer<typeof updateMemberRoleSchema>['role'],
  ): Promise<WorkspaceMember> {
    const actorMember = await this.getMemberRole(env, workspaceId, actorUserId);
    if (!actorMember || actorMember.role !== 'owner') {
      throw AppError.unauthorized('Hanya owner yang bisa mengubah peran anggota');
    }

    const target = await env.DB.prepare(
      'SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ?',
    )
      .bind(memberId, workspaceId)
      .first<WorkspaceMember>();
    if (!target) throw AppError.notFound('Anggota');
    if (target.role === 'owner')
      throw AppError.badRequest('invalid_role', 'Tidak bisa mengubah peran owner');

    const updated = await env.DB.prepare(
      'UPDATE workspace_members SET role = ? WHERE id = ? AND workspace_id = ? RETURNING *',
    )
      .bind(role, memberId, workspaceId)
      .first<WorkspaceMember>();
    if (!updated) throw AppError.internal('Gagal mengubah peran');
    return updated;
  }

  static async removeMember(
    env: Env,
    actorUserId: string,
    workspaceId: string,
    memberId: string,
  ): Promise<void> {
    const actorMember = await this.getMemberRole(env, workspaceId, actorUserId);
    if (!actorMember || (actorMember.role !== 'owner' && actorMember.role !== 'admin')) {
      throw AppError.unauthorized('Hanya owner/admin yang bisa menghapus anggota');
    }

    const target = await env.DB.prepare(
      'SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ?',
    )
      .bind(memberId, workspaceId)
      .first<WorkspaceMember>();
    if (!target) throw AppError.notFound('Anggota');
    if (target.role === 'owner')
      throw AppError.badRequest('invalid_role', 'Tidak bisa menghapus owner');

    await env.DB.prepare('DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?')
      .bind(memberId, workspaceId)
      .run();
  }
}
