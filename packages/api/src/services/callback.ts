import {
  signCallbackPayload,
  type Callback,
  type CallbackPayload,
  type CallbackEvent,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { dbTime } from '../lib/time';
import { validateCallbackUrl } from '../lib/ssrf';

export class CallbackService {
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
      await env.DB.prepare("UPDATE callbacks SET status = 'dead', last_error = ? WHERE id = ?")
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
          'UPDATE callbacks SET status = ?, response_code = ?, response_body = ?, attempt = ? WHERE id = ?',
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
        response_code = COALESCE(?, response_code), response_body = COALESCE(?, response_body)
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
}
