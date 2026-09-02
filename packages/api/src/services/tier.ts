import type { TierFeatures, UserTier } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';

const FALLBACK: TierFeatures = {
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
};

export class TierService {
  static async getTierFeatures(env: Env, tier: UserTier): Promise<TierFeatures> {
    const row = await env.DB.prepare('SELECT * FROM tier_features WHERE tier = ?')
      .bind(tier)
      .first<TierFeatures>();
    return row ?? { ...FALLBACK, tier };
  }

  // current >= limit → tolak. limit 0 berarti fitur tidak tersedia di tier ini.
  static checkLimit(feature: keyof TierFeatures, current: number, limit: number): void {
    if (current >= limit) {
      throw AppError.badRequest(
        'tier_limit',
        `Limit ${String(feature)} tier ini tercapai (${current}/${limit}). Upgrade ke premium.`,
      );
    }
  }
}
