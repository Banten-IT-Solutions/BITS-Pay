import { z } from 'zod';
import type { AdminOverview, Payment, UserPublic } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { CallbackService } from './callback';

export const updateUserSchema = z.object({
  tier: z.enum(['free', 'premium']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  name: z.string().min(1).optional(),
});

export class AdminService {
  static async overview(env: Env): Promise<AdminOverview> {
    const totalUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{
      c: number;
    }>();
    const totalPayments = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM payments WHERE status IN ('success','failed','expired')",
    ).first<{ c: number }>();
    const totalRevenue = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'success'",
    ).first<{ s: number }>();
    const pendingReview = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM payments WHERE status = 'pending_review'",
    ).first<{ c: number }>();
    const todayPayments = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM payments WHERE status = 'success' AND date(paid_at) = date('now')",
    ).first<{ c: number }>();
    const todayRevenue = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'success' AND date(paid_at) = date('now')",
    ).first<{ s: number }>();
    const activeSubs = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'",
    ).first<{ c: number }>();
    const lastMonth = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM users WHERE created_at < date('now', '-30 days')",
    ).first<{ c: number }>();
    const userGrowth =
      totalUsers && lastMonth && totalUsers.c > 0
        ? Math.round(((totalUsers.c - lastMonth.c) / totalUsers.c) * 100)
        : 0;

    return {
      total_users: totalUsers?.c ?? 0,
      total_payments: totalPayments?.c ?? 0,
      total_revenue: totalRevenue?.s ?? 0,
      pending_review_count: pendingReview?.c ?? 0,
      today_payments: todayPayments?.c ?? 0,
      today_revenue: todayRevenue?.s ?? 0,
      active_subscriptions: activeSubs?.c ?? 0,
      user_growth: userGrowth,
    };
  }

  static async listPayments(
    env: Env,
    page: number,
    perPage: number,
    status?: string,
    search?: string,
  ): Promise<{ data: Payment[]; total: number }> {
    const offset = (page - 1) * perPage;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (id LIKE ? OR order_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM payments ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(
      `SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all<Payment>();

    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async reviewQueue(
    env: Env,
    page: number,
    perPage: number,
  ): Promise<{ data: Payment[]; total: number }> {
    const offset = (page - 1) * perPage;
    const count = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM payments WHERE status = 'pending_review'",
    ).first<{ total: number }>();
    const { results } = await env.DB.prepare(
      "SELECT * FROM payments WHERE status = 'pending_review' ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
      .bind(perPage, offset)
      .all<Payment>();
    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async confirmPayment(env: Env, paymentId: string, adminId: string): Promise<Payment> {
    const payment = await env.DB.prepare(
      "SELECT * FROM payments WHERE id = ? AND status = 'pending_review'",
    )
      .bind(paymentId)
      .first<Payment>();
    if (!payment) throw AppError.notFound('Payment pending review');

    const updated = await env.DB.prepare(
      "UPDATE payments SET status = 'success', match_result = 'manual_confirm', confirmed_by = ?, confirmed_at = datetime('now'), paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
      .bind(adminId, paymentId)
      .first<Payment>();
    if (!updated) throw AppError.internal('Gagal konfirmasi payment');

    if (payment.app_id) {
      const app = await env.DB.prepare('SELECT id, callback_url FROM apps WHERE id = ?')
        .bind(payment.app_id)
        .first<{ id: string; callback_url: string | null }>();
      if (app?.callback_url) {
        await CallbackService.enqueueCallback(
          env,
          paymentId,
          payment.app_id,
          app.callback_url,
          'payment.success',
          {
            event: 'payment.success',
            transaction: {
              id: paymentId,
              order_id: payment.order_id,
              amount: payment.amount,
              amount_due: payment.amount_due,
              status: 'success',
              paid_at: updated.paid_at,
            },
          },
        );
      }
    }

    return updated;
  }

  static async rejectPayment(env: Env, paymentId: string, adminId: string): Promise<Payment> {
    const payment = await env.DB.prepare(
      "SELECT * FROM payments WHERE id = ? AND status = 'pending_review'",
    )
      .bind(paymentId)
      .first<Payment>();
    if (!payment) throw AppError.notFound('Payment pending review');

    const updated = await env.DB.prepare(
      "UPDATE payments SET status = 'failed', match_result = 'manual_reject', confirmed_by = ?, confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
      .bind(adminId, paymentId)
      .first<Payment>();
    if (!updated) throw AppError.internal('Gagal reject payment');

    if (payment.app_id) {
      const app = await env.DB.prepare('SELECT id, callback_url FROM apps WHERE id = ?')
        .bind(payment.app_id)
        .first<{ id: string; callback_url: string | null }>();
      if (app?.callback_url) {
        await CallbackService.enqueueCallback(
          env,
          paymentId,
          payment.app_id,
          app.callback_url,
          'payment.failed',
          {
            event: 'payment.failed',
            transaction: {
              id: paymentId,
              order_id: payment.order_id,
              amount: payment.amount,
              amount_due: payment.amount_due,
              status: 'failed',
              paid_at: null,
            },
          },
        );
      }
    }

    return updated;
  }

  static async listUsers(
    env: Env,
    page: number,
    perPage: number,
  ): Promise<{ data: UserPublic[]; total: number }> {
    const offset = (page - 1) * perPage;
    const count = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{
      total: number;
    }>();
    const { results } = await env.DB.prepare(
      'SELECT id, email, name, avatar_url, tier, status FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
      .bind(perPage, offset)
      .all<UserPublic>();
    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async updateUser(
    env: Env,
    userId: string,
    input: z.infer<typeof updateUserSchema>,
  ): Promise<UserPublic> {
    const user = await env.DB.prepare(
      'SELECT id, email, name, avatar_url, tier, status FROM users WHERE id = ?',
    )
      .bind(userId)
      .first<UserPublic>();
    if (!user) throw AppError.notFound('User');

    const tier = input.tier ?? user.tier;
    const status = input.status ?? user.status;
    const name = input.name ?? user.name;

    const updated = await env.DB.prepare(
      "UPDATE users SET tier = ?, status = ?, name = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, email, name, avatar_url, tier, status",
    )
      .bind(tier, status, name, userId)
      .first<UserPublic>();
    if (!updated) throw AppError.internal('Gagal update user');
    return updated;
  }
}
