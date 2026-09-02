import { z } from 'zod';
import type { Env } from '../config';
import type { TierFeatures, TierFeaturesUpdateInput, UserTier } from '@bits-pay/shared';
import { AuditService } from './audit';

const COLUMNS = [
  'max_workspaces',
  'max_apps',
  'max_transactions_month',
  'max_transactions_per_day',
  'api_rate_limit',
  'callback_allowed',
  'callback_retry_count',
  'report_export',
  'priority_review',
  'max_team_members',
] as const;

export const tierConfigSchema = z.object({
  free: z
    .object({
      max_workspaces: z.coerce.number().int().min(0).optional(),
      max_apps: z.coerce.number().int().min(0).optional(),
      max_transactions_month: z.coerce.number().int().min(0).optional(),
      max_transactions_per_day: z.coerce.number().int().min(0).optional(),
      api_rate_limit: z.coerce.number().int().min(0).optional(),
      callback_allowed: z.coerce.number().int().min(0).max(1).optional(),
      callback_retry_count: z.coerce.number().int().min(0).optional(),
      report_export: z.coerce.number().int().min(0).max(1).optional(),
      priority_review: z.coerce.number().int().min(0).max(1).optional(),
      max_team_members: z.coerce.number().int().min(0).optional(),
    })
    .optional(),
  premium: z
    .object({
      max_workspaces: z.coerce.number().int().min(0).optional(),
      max_apps: z.coerce.number().int().min(0).optional(),
      max_transactions_month: z.coerce.number().int().min(0).optional(),
      max_transactions_per_day: z.coerce.number().int().min(0).optional(),
      api_rate_limit: z.coerce.number().int().min(0).optional(),
      callback_allowed: z.coerce.number().int().min(0).max(1).optional(),
      callback_retry_count: z.coerce.number().int().min(0).optional(),
      report_export: z.coerce.number().int().min(0).max(1).optional(),
      priority_review: z.coerce.number().int().min(0).max(1).optional(),
      max_team_members: z.coerce.number().int().min(0).optional(),
    })
    .optional(),
});

const DEFAULTS: Record<UserTier, TierFeatures> = {
  free: {
    tier: 'free',
    max_workspaces: 1,
    max_apps: 1,
    max_transactions_month: 100,
    max_transactions_per_day: 10,
    api_rate_limit: 10,
    callback_allowed: 0,
    callback_retry_count: 0,
    report_export: 0,
    priority_review: 0,
    max_team_members: 1,
  },
  premium: {
    tier: 'premium',
    max_workspaces: 3,
    max_apps: 5,
    max_transactions_month: 10000,
    max_transactions_per_day: 500,
    api_rate_limit: 100,
    callback_allowed: 1,
    callback_retry_count: 3,
    report_export: 1,
    priority_review: 1,
    max_team_members: 5,
  },
};

export class TierConfigService {
  static async getAll(env: Env): Promise<Record<UserTier, TierFeatures>> {
    const { results } = await env.DB.prepare('SELECT * FROM tier_features').all<TierFeatures>();
    const out: Record<UserTier, TierFeatures> = { ...DEFAULTS };
    for (const row of results ?? []) {
      out[row.tier] = row;
    }
    return out;
  }

  static async update(
    env: Env,
    adminId: string,
    input: TierFeaturesUpdateInput,
  ): Promise<Record<UserTier, TierFeatures>> {
    for (const tier of ['free', 'premium'] as const) {
      const patch = input[tier];
      if (!patch) continue;
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const col of COLUMNS) {
        const value = patch[col];
        if (value === undefined) continue;
        sets.push(`${col} = ?`);
        params.push(value);
      }
      if (sets.length === 0) continue;
      params.push(tier);
      await env.DB.prepare(`UPDATE tier_features SET ${sets.join(', ')} WHERE tier = ?`)
        .bind(...params)
        .run();
    }
    await AuditService.log(env, {
      userId: adminId,
      action: 'admin.update_tier_features',
      entityType: 'tier_features',
      detail: JSON.stringify(input),
    });
    return TierConfigService.getAll(env);
  }
}
