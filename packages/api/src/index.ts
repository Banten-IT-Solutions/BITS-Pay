import { Hono } from 'hono';
import { errorHandler, setSecurityHeaders } from './middleware/error-handler';
import type { Env } from './config';
import { authRoutes } from './routes/auth';
import { appRoutes } from './routes/app';
import { apiRoutes } from './routes/api';
import { adminRoutes } from './routes/admin';
import { billingRoutes } from './routes/billing';
import { CallbackService } from './services/callback';
import { SubscriptionService } from './services/subscription';
import { corsMiddleware } from './middleware/cors';
import { publicRateLimit } from './middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// Fail-fast: JWT_SECRET kosong/lemah = token bisa dipalsukan. Tolak semua request.
app.use('*', async (c, next) => {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET wajib diset minimal 32 karakter');
  }
  await next();
});

app.use('*', corsMiddleware());
app.use('*', async (c, next) => {
  await next();
  setSecurityHeaders(c.res.headers);
});
app.use('/auth/*', publicRateLimit);
app.onError(errorHandler);

app.route('/auth', authRoutes);
app.route('/app', appRoutes);
app.route('/v1', apiRoutes);
app.route('/admin', adminRoutes);
app.route('/billing', billingRoutes);

app.get('/health', (c) => c.json({ success: true, data: { status: 'ok' } }));

export default app;

export { RateLimiter } from './durable/rate-limiter';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(
    (async () => {
      await env.DB.prepare(
        `UPDATE payments SET status = 'expired', updated_at = datetime('now')
         WHERE status = 'pending' AND expired_at < datetime('now')`,
      ).run();

      const { results: expiredPayments } = await env.DB.prepare(
        `SELECT p.id, p.app_id, a.callback_url, p.order_id, p.amount, p.amount_due
         FROM payments p
         LEFT JOIN apps a ON a.id = p.app_id
         WHERE p.status = 'expired' AND p.callback_queued = 0
         AND p.app_id IS NOT NULL AND a.callback_url IS NOT NULL`,
      ).all<{
        id: string;
        app_id: string;
        callback_url: string;
        order_id: string | null;
        amount: number;
        amount_due: number;
      }>();

      for (const p of expiredPayments ?? []) {
        await CallbackService.enqueueCallback(
          env,
          p.id,
          p.app_id,
          p.callback_url,
          'payment.expired',
          {
            event: 'payment.expired',
            transaction: {
              id: p.id,
              order_id: p.order_id,
              amount: p.amount,
              amount_due: p.amount_due,
              status: 'expired',
              paid_at: null,
            },
          },
        );
        await env.DB.prepare('UPDATE payments SET callback_queued = 1 WHERE id = ?')
          .bind(p.id)
          .run();
      }

      await SubscriptionService.expireAndDowngrade(env);
      await SubscriptionService.sendInvoiceReminders(env);
    })(),
  );
}

export async function queue(batch: MessageBatch<unknown>, env: Env, _ctx: ExecutionContext) {
  for (const msg of batch.messages) {
    const payload = msg.body as { callbackId: string };
    await CallbackService.processCallback(env, payload.callbackId);
    msg.ack();
  }
}
