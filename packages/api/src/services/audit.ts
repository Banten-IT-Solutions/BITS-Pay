import type { AuditLog } from '@bits-pay/shared';
import type { Env } from '../config';

export interface AuditLogInput {
  userId?: string | null;
  workspaceId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: string | null;
  ipAddress?: string | null;
}

export class AuditService {
  static async log(env: Env, e: AuditLogInput): Promise<void> {
    await env.DB.prepare(
      'INSERT INTO audit_logs (id, user_id, workspace_id, action, entity_type, entity_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        crypto.randomUUID(),
        e.userId ?? null,
        e.workspaceId ?? null,
        e.action,
        e.entityType,
        e.entityId ?? null,
        e.detail ?? null,
        e.ipAddress ?? null,
      )
      .run();
  }

  static async list(
    env: Env,
    page: number,
    perPage: number,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const offset = (page - 1) * perPage;
    const count = await env.DB.prepare('SELECT COUNT(*) as total FROM audit_logs').first<{
      total: number;
    }>();
    const { results } = await env.DB.prepare(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
      .bind(perPage, offset)
      .all<AuditLog>();
    return { data: results ?? [], total: count?.total ?? 0 };
  }
}
