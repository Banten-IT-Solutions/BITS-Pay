import type { TierFeatures, UserTier } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';

const FALLBACK: TierFeatures = {
  tier: 'free',
  max_workspaces: 1,
  max_apps: 1,
  max_transactions_month: 300,
  max_transactions_per_day: 10,
  api_rate_limit: 10,
  callback_allowed: 0,
  callback_retry_count: 0,
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

  // Masa trial premium untuk akun baru (hari). Trial = tier premium + tier_expires_at
  // terisi + TANPA subscription aktif. Cron expireAndDowngrade menurunkannya ke free.
  static readonly TRIAL_DAYS = 14;

  // Turun ke free + bekukan resource berlebih sebagai arsip (is_active = 0).
  // Yang dipertahankan = yang tertua (created_at ASC): workspace N tertua + apps N
  // tertua per workspace. Resource beku tak terlihat di list & API key-nya 401.
  // Limit diambil dari baris 'free' (dinamis, bukan hardcode).
  static async downgradeToFree(env: Env, userId: string): Promise<void> {
    const features = await TierService.getTierFeatures(env, 'free');
    await env.DB.prepare(
      "UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(userId)
      .run();

    const ws = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC',
    )
      .bind(userId)
      .all<{ id: string }>();
    const extraWs = (ws.results ?? []).slice(features.max_workspaces);
    for (const w of extraWs) {
      await env.DB.prepare('UPDATE workspaces SET is_active = 0 WHERE id = ?').bind(w.id).run();
      await env.DB.prepare('UPDATE apps SET is_active = 0 WHERE workspace_id = ?').bind(w.id).run();
    }

    const activeWs = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC',
    )
      .bind(userId)
      .all<{ id: string }>();
    for (const w of (activeWs.results ?? []) as { id: string }[]) {
      const apps = await env.DB.prepare(
        'SELECT id FROM apps WHERE workspace_id = ? AND is_active = 1 ORDER BY created_at ASC',
      )
        .bind(w.id)
        .all<{ id: string }>();
      const extraApps = (apps.results ?? []).slice(features.max_apps);
      for (const a of extraApps) {
        await env.DB.prepare('UPDATE apps SET is_active = 0 WHERE id = ?').bind(a.id).run();
      }
    }
  }

  // Naik ke premium: aktifkan kembali semua workspace + apps milik user.
  // Trade-off: penonaktifan manual ikut menyala lagi — dianggap wajar karena
  // upgrade = "kembalikan akses penuh". Dipanggil dari activateFromInvoice & admin.
  static async reactivateAll(env: Env, userId: string): Promise<void> {
    await env.DB.prepare('UPDATE workspaces SET is_active = 1 WHERE user_id = ?')
      .bind(userId)
      .run();
    await env.DB.prepare(
      'UPDATE apps SET is_active = 1 WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)',
    )
      .bind(userId)
      .run();
  }
}
