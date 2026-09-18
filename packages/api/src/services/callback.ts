import {
  signCallbackPayload,
  type Callback,
  type CallbackPayload,
  type CallbackEvent,
  type CallbackStatus,
  type PublicCallback,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { dbTime, toIso } from '../lib/time';
import { validateCallbackUrl } from '../lib/ssrf';
import { AppError } from '../lib/errors';

// DTO public API (/v1/callbacks): payload & response_body tidak diekspos
// (bisa memuat data internal/integrator). Timestamp ISO-8601.
export function toPublicCallback(cb: Callback): PublicCallback {
  return {
    id: cb.id,
    payment_id: cb.payment_id,
    event: cb.event,
    url: cb.url,
    status: cb.status,
    attempts: cb.attempt,
    max_attempts: cb.max_attempts,
    response_code: cb.response_code,
    next_retry_at: toIso(cb.next_retry_at),
    created_at: toIso(cb.created_at),
    // Row lama / INSERT baru belum set updated_at → fallback created_at.
    updated_at: toIso(cb.updated_at ?? cb.created_at),
  };
}

export class CallbackService {
  // Gate pengiriman: kembalikan URL hanya jika app aktif DAN tier pemilik
  // mengizinkan callback. Dipakai semua jalur enqueue (confirm user, confirm/
  // reject admin, payment expired) supaya user free / app beku tak menerima webhook.
  static async resolveTarget(env: Env, appId: string): Promise<string | null> {
    const row = await env.DB.prepare(
      `SELECT a.callback_url, a.is_active, COALESCE(tf.callback_allowed, 0) AS allowed
       FROM apps a
       JOIN workspaces w ON w.id = a.workspace_id
       JOIN users u ON u.id = w.user_id
       LEFT JOIN tier_features tf ON tf.tier = u.tier
       WHERE a.id = ?`,
    )
      .bind(appId)
      .first<{ callback_url: string | null; is_active: number; allowed: number }>();
    if (!row?.callback_url || !row.is_active || !row.allowed) return null;
    return row.callback_url;
  }

  static async enqueueCallback(
    env: Env,
    paymentId: string,
    appId: string | null,
    url: string,
    event: CallbackEvent,
    payload: CallbackPayload,
  ): Promise<void> {
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);

    await env.DB.prepare(
      'INSERT INTO callbacks (id, payment_id, app_id, url, event, payload) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, paymentId, appId, url, event, payloadStr)
      .run();

    await env.CALLBACK_QUEUE.send({ callbackId: id });
  }

  static async processCallback(env: Env, callbackId: string): Promise<void> {
    const callback = await env.DB.prepare('SELECT * FROM callbacks WHERE id = ?')
      .bind(callbackId)
      .first<Callback>();
    if (!callback) return;
    if (callback.status === 'success' || callback.status === 'dead') return;

    // SSRF defense-in-depth: jangan fetch URL tidak valid.
    try {
      validateCallbackUrl(callback.url);
    } catch {
      await env.DB.prepare(
        "UPDATE callbacks SET status = 'dead', last_error = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind('Callback URL tidak valid', callbackId)
        .run();
      return;
    }

    const app = await env.DB.prepare('SELECT callback_secret, api_key_hash FROM apps WHERE id = ?')
      .bind(callback.app_id)
      .first<{ callback_secret: string | null; api_key_hash: string }>();

    // Backward-compat: row lama callback_secret NULL → pakai api_key_hash.
    const secret = app ? (app.callback_secret ?? app.api_key_hash) : '';
    const signature = await signCallbackPayload(callback.payload, secret);

    const attempt = callback.attempt + 1;
    const maxAttempts = callback.max_attempts || 3;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const resp = await fetch(callback.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BITS-Signature': signature,
          'X-BITS-Event': callback.event,
        },
        body: callback.payload,
        signal: controller.signal,
      });

      const responseBody = await resp.text();
      if (resp.ok) {
        await env.DB.prepare(
          "UPDATE callbacks SET status = ?, response_code = ?, response_body = ?, attempt = ?, updated_at = datetime('now') WHERE id = ?",
        )
          .bind('success', resp.status, responseBody, attempt, callbackId)
          .run();
        return;
      }

      await this.fail(
        env,
        callbackId,
        attempt,
        maxAttempts,
        `HTTP ${resp.status}`,
        responseBody,
        resp.status,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.fail(env, callbackId, attempt, maxAttempts, msg, null, null);
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async fail(
    env: Env,
    callbackId: string,
    attempt: number,
    maxAttempts: number,
    lastError: string,
    responseBody: string | null,
    responseCode: number | null,
  ): Promise<void> {
    const dead = attempt >= maxAttempts;
    const nextRetryAt = dead
      ? null
      : dbTime(new Date(Date.now() + Math.pow(2, attempt) * 60 * 1000));

    await env.DB.prepare(
      `UPDATE callbacks SET
        status = ?, attempt = ?, next_retry_at = ?, last_error = ?,
        response_code = COALESCE(?, response_code), response_body = COALESCE(?, response_body),
        updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(
        dead ? 'dead' : 'failed',
        attempt,
        nextRetryAt,
        lastError,
        responseCode,
        responseBody,
        callbackId,
      )
      .run();

    if (!dead) {
      await env.CALLBACK_QUEUE.send(
        { callbackId },
        { delaySeconds: Math.min(Math.pow(2, attempt) * 60, 3600) },
      );
    }
  }

  // Enqueue webhook payment.expired untuk SATU payment. Dipakai cron
  // scheduled() dan route cancel (cancel = expire-now).
  // Gate sama dengan cron: app aktif + callback_url + tier callback_allowed.
  // Flag callback_queued diklaim atomik → event terkirim tepat sekali
  // walau cron & cancel balapan. Gagal enqueue → flag dirollback supaya
  // cron berikutnya retry.
  static async enqueueExpiredForPayment(env: Env, paymentId: string): Promise<void> {
    const row = await env.DB.prepare(
      `SELECT p.id, p.app_id, a.callback_url, p.order_id, p.amount, p.amount_due
       FROM payments p
       JOIN apps a ON a.id = p.app_id
       JOIN workspaces w ON w.id = a.workspace_id
       JOIN users u ON u.id = w.user_id
       JOIN tier_features tf ON tf.tier = u.tier
       WHERE p.id = ? AND p.status = 'expired' AND p.callback_queued = 0
       AND p.app_id IS NOT NULL AND a.callback_url IS NOT NULL
       AND a.is_active = 1 AND tf.callback_allowed = 1`,
    )
      .bind(paymentId)
      .first<{
        id: string;
        app_id: string;
        callback_url: string;
        order_id: string | null;
        amount: number;
        amount_due: number;
      }>();
    if (!row) return;

    const claimed = await env.DB.prepare(
      'UPDATE payments SET callback_queued = 1 WHERE id = ? AND callback_queued = 0',
    )
      .bind(row.id)
      .run();
    if (claimed.meta.changes === 0) return;

    try {
      await this.enqueueCallback(env, row.id, row.app_id, row.callback_url, 'payment.expired', {
        event: 'payment.expired',
        transaction: {
          id: row.id,
          order_id: row.order_id,
          amount: row.amount,
          amount_due: row.amount_due,
          status: 'expired',
          paid_at: null,
        },
      });
    } catch (err) {
      await env.DB.prepare('UPDATE payments SET callback_queued = 0 WHERE id = ?')
        .bind(row.id)
        .run();
      throw err;
    }
  }

  // List callbacks untuk PUBLIC API (/v1/callbacks) — scope ke app pemilik key.
  static async listAppCallbacks(
    env: Env,
    appId: string,
    page: number,
    perPage: number,
    status?: CallbackStatus,
    paymentId?: string,
  ): Promise<{ data: Callback[]; total: number }> {
    const offset = (page - 1) * perPage;
    let where = 'WHERE app_id = ?';
    const params: unknown[] = [appId];
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (paymentId) {
      where += ' AND payment_id = ?';
      params.push(paymentId);
    }

    const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM callbacks ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(
      `SELECT * FROM callbacks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all<Callback>();

    return { data: results ?? [], total: count?.total ?? 0 };
  }

  // Retry manual untuk PUBLIC API: hanya callback milik app & status 'failed'.
  // attempt TIDAK direset (beda dengan retry admin) supaya retry manual tak
  // bisa bypass max_attempts tanpa batas. Claim atomik failed → pending.
  static async retryAppCallback(env: Env, appId: string, callbackId: string): Promise<Callback> {
    const callback = await env.DB.prepare('SELECT * FROM callbacks WHERE id = ? AND app_id = ?')
      .bind(callbackId, appId)
      .first<Callback>();
    if (!callback) throw AppError.notFound('Callback');
    if (callback.status !== 'failed') {
      throw AppError.conflict('invalid_status', `Status callback: ${callback.status}`);
    }

    const claimed = await env.DB.prepare(
      "UPDATE callbacks SET status = 'pending', next_retry_at = NULL, updated_at = datetime('now') WHERE id = ? AND status = 'failed'",
    )
      .bind(callbackId)
      .run();
    if (claimed.meta.changes === 0) {
      throw AppError.conflict('invalid_status', 'Callback sudah diproses');
    }

    await env.CALLBACK_QUEUE.send({ callbackId });
    return { ...callback, status: 'pending', next_retry_at: null };
  }
}
