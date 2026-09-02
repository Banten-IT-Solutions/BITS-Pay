import {
  signCallbackPayload,
  type Callback,
  type CallbackPayload,
  type CallbackEvent,
} from '@bits-pay/shared';
import type { Env } from '../config';

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

    const app = await env.DB.prepare('SELECT api_key_hash FROM apps WHERE id = ?')
      .bind(callback.app_id)
      .first<{ api_key_hash: string }>();

    const secret = app?.api_key_hash ?? '';
    const signature = await signCallbackPayload(callback.payload, secret);

    try {
      const resp = await fetch(callback.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BITS-Signature': signature,
          'X-BITS-Event': callback.event,
        },
        body: callback.payload,
      });

      const responseBody = await resp.text();
      const attempt = callback.attempt + 1;
      const status = resp.ok ? 'success' : 'failed';

      if (status === 'success') {
        await env.DB.prepare(
          'UPDATE callbacks SET status = ?, response_code = ?, response_body = ?, attempt = ? WHERE id = ?',
        )
          .bind('success', resp.status, responseBody, attempt, callbackId)
          .run();
      } else {
        const maxAttempts = callback.max_attempts;
        const nextStatus = attempt >= maxAttempts ? 'dead' : 'failed';
        const nextRetryAt =
          attempt < maxAttempts
            ? new Date(Date.now() + Math.pow(2, attempt) * 60 * 1000).toISOString()
            : null;

        await env.DB.prepare(
          'UPDATE callbacks SET status = ?, response_code = ?, response_body = ?, attempt = ?, next_retry_at = ?, last_error = ? WHERE id = ?',
        )
          .bind(
            nextStatus,
            resp.status,
            responseBody,
            attempt,
            nextRetryAt,
            `HTTP ${resp.status}`,
            callbackId,
          )
          .run();
      }
    } catch (err) {
      const attempt = callback.attempt + 1;
      const maxAttempts = callback.max_attempts;
      const nextStatus = attempt >= maxAttempts ? 'dead' : 'failed';
      const nextRetryAt =
        attempt < maxAttempts
          ? new Date(Date.now() + Math.pow(2, attempt) * 60 * 1000).toISOString()
          : null;
      const errMsg = err instanceof Error ? err.message : String(err);

      await env.DB.prepare(
        'UPDATE callbacks SET status = ?, attempt = ?, next_retry_at = ?, last_error = ? WHERE id = ?',
      )
        .bind(nextStatus, attempt, nextRetryAt, errMsg, callbackId)
        .run();
    }
  }
}
