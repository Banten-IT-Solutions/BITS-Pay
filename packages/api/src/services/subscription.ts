import type { Payment, Invoice } from '@bits-pay/shared';
import type { Env } from '../config';
import { EmailService } from './email';

export class SubscriptionService {
  static async activateFromInvoice(env: Env, paymentId: string): Promise<void> {
    const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?')
      .bind(paymentId)
      .first<Payment>();
    if (!payment) return;
    if (payment.type !== 'invoice') return;

    const invoice = await env.DB.prepare(
      "SELECT * FROM invoices WHERE payment_id = ? AND status = 'pending'",
    )
      .bind(paymentId)
      .first<Invoice>();
    if (!invoice) return;

    await env.DB.prepare(
      "UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?",
    )
      .bind(invoice.id)
      .run();

    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(invoice.period_start, invoice.period_end, invoice.subscription_id)
      .run();

    await env.DB.prepare(
      "UPDATE users SET tier = 'premium', tier_expires_at = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(invoice.period_end, invoice.user_id)
      .run();
  }

  static async expireAndDowngrade(env: Env): Promise<void> {
    await env.DB.prepare(
      "UPDATE subscriptions SET status = 'expired', updated_at = datetime('now') WHERE status = 'active' AND current_period_end < datetime('now')",
    ).run();

    await env.DB.prepare(
      "UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = datetime('now') WHERE tier = 'premium' AND tier_expires_at IS NOT NULL AND tier_expires_at < datetime('now')",
    ).run();
  }

  static async sendInvoiceReminders(env: Env): Promise<void> {
    const { results: dueSoon3 } = await env.DB.prepare(
      "SELECT * FROM invoices WHERE status = 'pending' AND reminder_sent_3 = 0 AND due_at > datetime('now') AND due_at <= datetime('now', '+3 days')",
    ).all<Invoice>();

    for (const inv of dueSoon3 ?? []) {
      const user = await env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
        .bind(inv.user_id)
        .first<{ email: string; name: string }>();
      if (!user) continue;

      const appUrl = env.APP_URL || 'https://pay.bits.co.id';
      const fmtAmount = inv.amount_due.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const dueDate = inv.due_at.slice(0, 10);
      const text = `Halo ${user.name},\n\nIni pengingat bahwa invoice subscription kamu sebesar Rp ${fmtAmount} akan jatuh tempo pada ${dueDate}.\n\nSilakan lakukan pembayaran melalui dashboard:\n${appUrl}/billing/invoices/${inv.id}\n\nTerima kasih,\nBITS Pay`;

      try {
        await EmailService.send(env, {
          to: user.email,
          subject: 'Pengingat Pembayaran Invoice - BITS Pay',
          text,
        });
        await env.DB.prepare('UPDATE invoices SET reminder_sent_3 = 1 WHERE id = ?')
          .bind(inv.id)
          .run();
      } catch {
        // silent
      }
    }

    const { results: dueSoon1 } = await env.DB.prepare(
      "SELECT * FROM invoices WHERE status = 'pending' AND reminder_sent_1 = 0 AND due_at > datetime('now') AND due_at <= datetime('now', '+1 days')",
    ).all<Invoice>();

    for (const inv of dueSoon1 ?? []) {
      const user = await env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
        .bind(inv.user_id)
        .first<{ email: string; name: string }>();
      if (!user) continue;

      const appUrl = env.APP_URL || 'https://pay.bits.co.id';
      const fmtAmount = inv.amount_due.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const dueDate = inv.due_at.slice(0, 10);
      const text = `Halo ${user.name},\n\nIni pengingat terakhir! Invoice subscription kamu sebesar Rp ${fmtAmount} akan jatuh tempo besok (${dueDate}).\n\nSegera lakukan pembayaran melalui dashboard:\n${appUrl}/billing/invoices/${inv.id}\n\nTerima kasih,\nBITS Pay`;

      try {
        await EmailService.send(env, {
          to: user.email,
          subject: 'Pengingat Terakhir Pembayaran Invoice - BITS Pay',
          text,
        });
        await env.DB.prepare('UPDATE invoices SET reminder_sent_1 = 1 WHERE id = ?')
          .bind(inv.id)
          .run();
      } catch {
        // silent
      }
    }
  }
}
