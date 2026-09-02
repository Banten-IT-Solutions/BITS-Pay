import { z } from 'zod';
import type { Env } from '../config';
import type { EmailTemplates } from '@bits-pay/shared';
import { AuditService } from './audit';

const MAP: ReadonlyArray<readonly [string, 'verify' | 'reset' | 'invoice_reminder']> = [
  ['email_template_verify', 'verify'],
  ['email_template_reset', 'reset'],
  ['email_template_invoice_reminder', 'invoice_reminder'],
];

export const emailTemplatesSchema = z.object({
  verify: z.string().optional(),
  reset: z.string().optional(),
  invoice_reminder: z.string().optional(),
});

type EmailTemplatesInput = z.infer<typeof emailTemplatesSchema>;

export class EmailTemplateService {
  static async getAll(env: Env): Promise<EmailTemplates> {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM config WHERE key IN ('email_template_verify', 'email_template_reset', 'email_template_invoice_reminder')",
    ).all<{ key: string; value: string }>();
    const map = new Map((results ?? []).map((r) => [r.key, r.value]));
    return {
      verify: map.get('email_template_verify') ?? '',
      reset: map.get('email_template_reset') ?? '',
      invoice_reminder: map.get('email_template_invoice_reminder') ?? '',
    };
  }

  static async update(
    env: Env,
    adminId: string,
    input: EmailTemplatesInput,
  ): Promise<EmailTemplates> {
    for (const [key, field] of MAP) {
      const value = input[field];
      if (value === undefined) continue;
      await env.DB.prepare(
        `INSERT INTO config (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
      )
        .bind(key, value, adminId)
        .run();
    }
    await AuditService.log(env, {
      userId: adminId,
      action: 'admin.update_email_templates',
      entityType: 'config',
    });
    return EmailTemplateService.getAll(env);
  }
}
