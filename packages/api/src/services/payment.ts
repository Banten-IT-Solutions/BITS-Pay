import { z } from 'zod';
import {
  calculateAmountDue,
  findAvailableCode,
  type Payment,
  type ChargeCreateResponse,
  type PaymentConfirmResponse,
  type MatchResult,
  type UserTier,
} from '@bits-pay/shared';
import type { Env } from '../config';
import { AppError } from '../lib/errors';
import { dbTime } from '../lib/time';
import { QrService } from './qr';
import { getOcrProvider } from './ocr';
import { TierService } from './tier';
import { SubscriptionService } from './subscription';

export const chargeSchema = z.object({
  order_id: z.string().min(1, 'order_id wajib diisi'),
  amount: z.number().int().min(100, 'Amount minimal Rp 100'),
  currency: z.string().default('IDR'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export class PaymentService {
  static async createCharge(
    env: Env,
    app: { id: string; workspace_id: string },
    input: z.infer<typeof chargeSchema>,
  ): Promise<ChargeCreateResponse> {
    const existing = await env.DB.prepare(
      "SELECT id FROM payments WHERE app_id = ? AND order_id = ? AND status != 'expired'",
    )
      .bind(app.id, input.order_id)
      .first();
    if (existing) {
      throw AppError.conflict('duplicate_order', 'order_id sudah digunakan untuk transaksi aktif');
    }

    await this.checkQuota(env, app.workspace_id);

    const { results: usedCodes } = await env.DB.prepare(
      `SELECT unique_code FROM payments WHERE status = 'pending' AND expired_at > datetime('now')`,
    ).all<{ unique_code: number }>();
    const usedCodeNumbers = (usedCodes ?? []).map((r) => r.unique_code);
    const maxCode = parseInt(env.MAX_UNIQUE_CODE, 10) || 9999;
    const uniqueCode = findAvailableCode(usedCodeNumbers, maxCode);
    if (uniqueCode === null)
      throw AppError.badRequest('no_unique_code', 'Semua kode unik terpakai');

    const amountDue = calculateAmountDue(input.amount, uniqueCode);

    const qrisDynamic = QrService.convertStaticToDynamic(env, amountDue);
    const qrImage = await QrService.generateQrImage(qrisDynamic, amountDue);

    const expireMinutes = parseInt(env.TRANSACTION_EXPIRE_MINUTES, 10) || 15;
    const expiredAt = dbTime(new Date(Date.now() + expireMinutes * 60 * 1000));

    const id = crypto.randomUUID();
    let payment: Payment | null;
    try {
      payment = await env.DB.prepare(
        `INSERT INTO payments (id, workspace_id, app_id, order_id, amount, amount_due, unique_code, currency, description, metadata, qris_dynamic, qr_image, expired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
        .bind(
          id,
          app.workspace_id,
          app.id,
          input.order_id,
          input.amount,
          amountDue,
          uniqueCode,
          input.currency,
          input.description ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          qrisDynamic,
          qrImage,
          expiredAt,
        )
        .first<Payment>();
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        throw AppError.conflict(
          'duplicate_order',
          'order_id sudah digunakan untuk transaksi aktif',
        );
      }
      throw err;
    }
    if (!payment) throw AppError.internal('Gagal membuat charge');

    return {
      id: payment.id,
      amount: payment.amount,
      amount_due: payment.amount_due,
      unique_code: payment.unique_code,
      currency: payment.currency,
      status: payment.status as ChargeCreateResponse['status'],
      qr_image: payment.qr_image!,
      qris_dynamic: payment.qris_dynamic!,
      expired_at: payment.expired_at!,
      created_at: payment.created_at,
    };
  }

  static async getPayment(env: Env, workspaceId: string, paymentId: string): Promise<Payment> {
    const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ? AND workspace_id = ?')
      .bind(paymentId, workspaceId)
      .first<Payment>();
    if (!payment) throw AppError.notFound('Payment');
    return payment;
  }

  private static async checkQuota(env: Env, workspaceId: string): Promise<void> {
    const owner = await env.DB.prepare(
      'SELECT u.tier FROM workspaces w JOIN users u ON u.id = w.user_id WHERE w.id = ?',
    )
      .bind(workspaceId)
      .first<{ tier: UserTier }>();
    const features = await TierService.getTierFeatures(env, owner?.tier ?? 'free');

    const today = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM payments WHERE workspace_id = ? AND date(created_at) = date('now')",
    )
      .bind(workspaceId)
      .first<{ c: number }>();
    const month = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM payments WHERE workspace_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m','now')",
    )
      .bind(workspaceId)
      .first<{ c: number }>();

    if ((today?.c ?? 0) >= features.max_transactions_per_day) {
      throw AppError.tooMany('Batas transaksi harian tercapai, upgrade ke premium');
    }
    if ((month?.c ?? 0) >= features.max_transactions_month) {
      throw AppError.tooMany('Batas transaksi bulanan tercapai, upgrade ke premium');
    }
  }

  static async confirmPayment(
    env: Env,
    workspaceId: string,
    appId: string | null,
    paymentId: string,
    formData: { amount: number; proofImage: ArrayBuffer | null; proofMime: string | null },
  ): Promise<PaymentConfirmResponse> {
    const payment = appId
      ? await env.DB.prepare(
          'SELECT * FROM payments WHERE id = ? AND workspace_id = ? AND app_id = ?',
        )
          .bind(paymentId, workspaceId, appId)
          .first<Payment>()
      : await env.DB.prepare('SELECT * FROM payments WHERE id = ? AND workspace_id = ?')
          .bind(paymentId, workspaceId)
          .first<Payment>();
    if (!payment) throw AppError.notFound('Payment');
    if (payment.status !== 'pending') {
      throw AppError.badRequest('invalid_status', `Status transaksi: ${payment.status}`);
    }
    if (payment.expired_at && payment.expired_at < dbTime(new Date())) {
      throw AppError.badRequest('expired', 'Transaksi sudah kedaluwarsa');
    }

    if (formData.amount !== payment.amount_due) {
      await env.DB.prepare(
        "UPDATE payments SET status = 'failed', match_result = 'mismatch', user_input_amount = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(formData.amount, paymentId)
        .run();
      return {
        id: paymentId,
        status: 'failed',
        match_result: 'mismatch',
        ocr_amount: null,
        ocr_confidence: null,
        paid_at: null,
        message: 'Nominal tidak cocok',
      };
    }

    if (formData.proofImage) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', formData.proofImage);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const dupProof = await env.DB.prepare('SELECT id FROM payments WHERE proof_hash = ?')
        .bind(hash)
        .first();
      if (dupProof) {
        throw AppError.conflict('duplicate_hash', 'Bukti bayar sudah digunakan');
      }

      const proofPath = `proofs/${paymentId}/${crypto.randomUUID()}`;
      await env.R2.put(proofPath, formData.proofImage, {
        httpMetadata: { contentType: formData.proofMime ?? 'image/jpeg' },
      });

      const base64 = arrayBufferToBase64(formData.proofImage);
      const ocrProvider = await getOcrProvider(env);
      const ocrResult = await ocrProvider.extractReceipt(base64);

      const threshold = parseInt(env.OCR_CONFIDENCE_THRESHOLD, 10) || 85;
      let status: Payment['status'];
      let matchResult: MatchResult;

      if (ocrResult.amount === payment.amount_due && ocrResult.confidence >= threshold) {
        status = 'success';
        matchResult = 'auto_confirm';
      } else if (ocrResult.amount === payment.amount_due && ocrResult.confidence < threshold) {
        status = 'pending_review';
        matchResult = 'low_confidence';
      } else {
        status = 'failed';
        matchResult = 'mismatch';
      }

      const paidAt = status === 'success' ? dbTime(new Date()) : null;
      const confirmedAt = status === 'success' ? dbTime(new Date()) : null;

      await env.DB.prepare(
        `UPDATE payments SET
          status = ?, proof_hash = ?, proof_path = ?, proof_mime = ?, user_input_amount = ?,
          ocr_amount = ?, ocr_confidence = ?, ocr_merchant = ?, ocr_raw_text = ?, ocr_provider = ?,
          match_result = ?, paid_at = ?, confirmed_at = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(
          status,
          hash,
          proofPath,
          formData.proofMime,
          formData.amount,
          ocrResult.amount,
          ocrResult.confidence,
          ocrResult.merchant,
          ocrResult.rawText,
          ocrResult.provider,
          matchResult,
          paidAt,
          confirmedAt,
          paymentId,
        )
        .run();

      if (status === 'success') {
        await SubscriptionService.activateFromInvoice(env, paymentId);
      }

      return {
        id: paymentId,
        status,
        match_result: matchResult,
        ocr_amount: ocrResult.amount,
        ocr_confidence: ocrResult.confidence,
        paid_at: paidAt,
        ...(status === 'pending_review'
          ? { message: 'OCR confidence rendah, perlu review admin' }
          : {}),
      };
    }

    await env.DB.prepare(
      "UPDATE payments SET status = 'failed', match_result = 'mismatch', user_input_amount = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(formData.amount, paymentId)
      .run();
    return {
      id: paymentId,
      status: 'failed',
      match_result: 'mismatch',
      ocr_amount: null,
      ocr_confidence: null,
      paid_at: null,
      message: 'Bukti bayar tidak ditemukan',
    };
  }

  static async listPayments(
    env: Env,
    workspaceId: string,
    page: number,
    perPage: number,
    status?: string,
  ): Promise<{ data: Payment[]; total: number }> {
    const offset = (page - 1) * perPage;
    let countSql = 'SELECT COUNT(*) as total FROM payments WHERE workspace_id = ?';
    let dataSql =
      'SELECT * FROM payments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const countParams: unknown[] = [workspaceId];
    const dataParams: unknown[] = [workspaceId];

    if (status) {
      countSql += ' AND status = ?';
      dataSql = dataSql.replace('WHERE workspace_id = ?', 'WHERE workspace_id = ? AND status = ?');
      countParams.push(status);
      dataParams.push(status);
    }

    dataParams.push(perPage, offset);

    const countResult = await env.DB.prepare(countSql)
      .bind(...countParams)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(dataSql)
      .bind(...dataParams)
      .all<Payment>();

    return { data: results ?? [], total: countResult?.total ?? 0 };
  }

  static async listUserPayments(
    env: Env,
    userId: string,
    page: number,
    perPage: number,
    status?: string,
    search?: string,
  ): Promise<{ data: Payment[]; total: number }> {
    const offset = (page - 1) * perPage;
    let where = `WHERE wm.user_id = ?`;
    const params: unknown[] = [userId];
    if (status) {
      where += ' AND p.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (p.order_id LIKE ? OR p.id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const count = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM payments p INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id ${where}`,
    )
      .bind(...params)
      .first<{ total: number }>();
    const { results } = await env.DB.prepare(
      `SELECT p.* FROM payments p INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all<Payment>();

    return { data: results ?? [], total: count?.total ?? 0 };
  }

  static async userStats(
    env: Env,
    userId: string,
  ): Promise<{
    total_payments: number;
    today_payments: number;
    pending_count: number;
    success_count: number;
  }> {
    const row = await env.DB.prepare(
      `SELECT
         COUNT(*) as total_payments,
         SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
         SUM(CASE WHEN p.status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN p.status = 'success' AND date(p.paid_at) = date('now') THEN 1 ELSE 0 END) as today_payments
       FROM payments p
       INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
       WHERE wm.user_id = ?`,
    )
      .bind(userId)
      .first<{
        total_payments: number;
        today_payments: number;
        pending_count: number;
        success_count: number;
      }>();

    return {
      total_payments: row?.total_payments ?? 0,
      today_payments: row?.today_payments ?? 0,
      pending_count: row?.pending_count ?? 0,
      success_count: row?.success_count ?? 0,
    };
  }

  static async getUserPayment(env: Env, userId: string, paymentId: string): Promise<Payment> {
    const payment = await env.DB.prepare(
      `SELECT p.* FROM payments p
       INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
       WHERE p.id = ? AND wm.user_id = ?`,
    )
      .bind(paymentId, userId)
      .first<Payment>();
    if (!payment) throw AppError.notFound('Payment');
    return payment;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
