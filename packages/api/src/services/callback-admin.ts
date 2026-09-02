import type { Callback, CallbackStatus } from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';

export interface CallbackAdminRow extends Callback {
  order_id: string | null;
}

const RETRYABLE: ReadonlySet<CallbackStatus> = new Set(['failed', 'dead', 'pending']);

export class CallbackAdminService {
  static async list(
    env: Env,
    page: number,
    perPage: number,
    status?: CallbackStatus,
  ): Promise<{ data: CallbackAdminRow[]; total: number }> {
    const offset = (page - 1) * perPage;
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (status) {
      where += ' AND cb.status = ?';
      params.push(status);
    }

    const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM callbacks cb ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(
      `SELECT cb.*, p.order_id AS order_id
       FROM callbacks cb
       LEFT JOIN payments p ON p.id = cb.payment_id
       ${where}
       ORDER BY cb.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all<CallbackAdminRow>();
    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async retry(env: Env, callbackId: string): Promise<void> {
    const callback = await env.DB.prepare('SELECT * FROM callbacks WHERE id = ?')
      .bind(callbackId)
      .first<Callback>();
    if (!callback) throw AppError.notFound('Callback');
    if (!RETRYABLE.has(callback.status)) return;

    await env.DB.prepare(
      "UPDATE callbacks SET attempt = 0, status = 'pending', last_error = NULL, next_retry_at = NULL WHERE id = ?",
    )
      .bind(callbackId)
      .run();

    await env.CALLBACK_QUEUE.send({ callbackId });
  }
}
