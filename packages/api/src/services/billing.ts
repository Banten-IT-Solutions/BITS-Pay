import { z } from 'zod';
import {
  calculateAmountDue,
  findAvailableCode,
  type Subscription,
  type Invoice,
  type Payment,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { dbTime } from '../lib/time';
import { QrService } from './qr';

export const upgradeSchema = z.object({
  tier: z.enum(['premium_monthly', 'premium_yearly']),
  workspace_id: z.string().min(1),
});

export class BillingService {
  static async upgrade(
    env: Env,
    userId: string,
    input: z.infer<typeof upgradeSchema>,
  ): Promise<{
    subscription: Subscription;
    invoice: Invoice;
    qr: { qris_dynamic: string; qr_image: string; amount_due: number };
  }> {
    const existing = await env.DB.prepare(
      "SELECT id FROM subscriptions WHERE user_id = ? AND status IN ('active', 'pending')",
    )
      .bind(userId)
      .first();
    if (existing) throw AppError.conflict('subscription_exists', 'Sudah punya subscription aktif');

    const price =
      input.tier === 'premium_monthly'
        ? parseInt(env.PREMIUM_PRICE_MONTHLY, 10) || 50000
        : parseInt(env.PREMIUM_PRICE_YEARLY, 10) || 500000;

    const { results: usedCodes } = await env.DB.prepare(
      `SELECT unique_code FROM payments WHERE status = 'pending' AND expired_at > datetime('now')`,
    ).all<{ unique_code: number }>();
    const usedCodeNumbers = (usedCodes ?? []).map((r) => r.unique_code);
    const maxCode = parseInt(env.MAX_UNIQUE_CODE, 10) || 9999;
    const uniqueCode = findAvailableCode(usedCodeNumbers, maxCode);
    if (uniqueCode === null)
      throw AppError.badRequest('no_unique_code', 'Semua kode unik terpakai');
    const amountDue = calculateAmountDue(price, uniqueCode);

    const qrisDynamic = QrService.convertStaticToDynamic(env, amountDue);
    const qrImage = await QrService.generateQrImage(qrisDynamic, amountDue);

    const now = new Date();
    const periodStart = dbTime(now);
    const periodEnd = dbTime(
      new Date(
        input.tier === 'premium_yearly'
          ? now.setFullYear(now.getFullYear() + 1)
          : now.setMonth(now.getMonth() + 1),
      ),
    );

    const subscriptionId = crypto.randomUUID();
    const subscription = await env.DB.prepare(
      `INSERT INTO subscriptions (id, user_id, workspace_id, tier, status, amount, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?) RETURNING *`,
    )
      .bind(subscriptionId, userId, input.workspace_id, input.tier, price, periodStart, periodEnd)
      .first<Subscription>();
    if (!subscription) throw AppError.internal('Gagal membuat subscription');

    const dueAt = dbTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const expiredAt = dbTime(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    const invoiceId = crypto.randomUUID();
    const invoice = await env.DB.prepare(
      `INSERT INTO invoices (id, subscription_id, user_id, amount, amount_due, unique_code, tier, period_start, period_end, qris_dynamic, qr_image, due_at, expired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
      .bind(
        invoiceId,
        subscriptionId,
        userId,
        price,
        amountDue,
        uniqueCode,
        input.tier,
        periodStart,
        periodEnd,
        qrisDynamic,
        qrImage,
        dueAt,
        expiredAt,
      )
      .first<Invoice>();
    if (!invoice) throw AppError.internal('Gagal membuat invoice');

    return {
      subscription,
      invoice,
      qr: { qris_dynamic: qrisDynamic, qr_image: qrImage, amount_due: amountDue },
    };
  }

  static async current(env: Env, userId: string): Promise<Subscription | null> {
    const sub = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active', 'pending') ORDER BY created_at DESC LIMIT 1",
    )
      .bind(userId)
      .first<Subscription>();
    return sub ?? null;
  }

  static async cancel(env: Env, userId: string): Promise<Subscription> {
    const sub = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    )
      .bind(userId)
      .first<Subscription>();
    if (!sub) throw AppError.notFound('Subscription aktif');

    const updated = await env.DB.prepare(
      "UPDATE subscriptions SET status = 'canceled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ? RETURNING *",
    )
      .bind(sub.id)
      .first<Subscription>();
    if (!updated) throw AppError.internal('Gagal cancel subscription');

    await env.DB.prepare(
      "UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(userId)
      .run();

    return updated;
  }

  static async listInvoices(
    env: Env,
    userId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: Invoice[]; total: number }> {
    const offset = (page - 1) * perPage;
    const count = await env.DB.prepare('SELECT COUNT(*) as total FROM invoices WHERE user_id = ?')
      .bind(userId)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
      .bind(userId, perPage, offset)
      .all<Invoice>();
    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async getInvoice(env: Env, userId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?')
      .bind(invoiceId, userId)
      .first<Invoice>();
    if (!invoice) throw AppError.notFound('Invoice');
    return invoice;
  }

  static async payInvoice(env: Env, userId: string, invoiceId: string): Promise<Payment> {
    const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?')
      .bind(invoiceId, userId)
      .first<Invoice>();
    if (!invoice) throw AppError.notFound('Invoice');
    if (invoice.status !== 'pending') {
      throw AppError.badRequest('invalid_status', 'Invoice sudah dibayar atau expired');
    }
    if (invoice.expired_at && invoice.expired_at < dbTime(new Date())) {
      await env.DB.prepare(
        "UPDATE invoices SET status = 'expired' WHERE id = ? AND status = 'pending'",
      )
        .bind(invoiceId)
        .run();
      throw AppError.badRequest('expired', 'Invoice sudah kedaluwarsa');
    }
    if (invoice.payment_id) {
      const existing = await env.DB.prepare('SELECT * FROM payments WHERE id = ?')
        .bind(invoice.payment_id)
        .first<Payment>();
      if (existing && (existing.status === 'pending' || existing.status === 'success')) {
        return existing;
      }
    }

    let workspaceId: string | null = null;
    if (invoice.subscription_id) {
      const sub = await env.DB.prepare('SELECT workspace_id FROM subscriptions WHERE id = ?')
        .bind(invoice.subscription_id)
        .first<{ workspace_id: string }>();
      if (sub) workspaceId = sub.workspace_id;
    }
    if (!workspaceId) {
      const member = await env.DB.prepare(
        'SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1',
      )
        .bind(userId)
        .first<{ workspace_id: string }>();
      workspaceId = member?.workspace_id ?? null;
    }
    if (!workspaceId) throw AppError.badRequest('no_workspace', 'Tidak ada workspace');

    const paymentId = crypto.randomUUID();
    const payment = await env.DB.prepare(
      `INSERT INTO payments (id, workspace_id, user_id, type, amount, amount_due, unique_code, currency, qris_dynamic, qr_image, expired_at, created_at, updated_at)
       VALUES (?, ?, ?, 'invoice', ?, ?, ?, 'IDR', ?, ?, ?, datetime('now'), datetime('now')) RETURNING *`,
    )
      .bind(
        paymentId,
        workspaceId,
        userId,
        invoice.amount,
        invoice.amount_due,
        invoice.unique_code,
        invoice.qris_dynamic,
        invoice.qr_image,
        invoice.expired_at,
      )
      .first<Payment>();
    if (!payment) throw AppError.internal('Gagal membuat pembayaran');

    await env.DB.prepare('UPDATE invoices SET payment_id = ? WHERE id = ?')
      .bind(paymentId, invoiceId)
      .run();

    return payment;
  }
}
