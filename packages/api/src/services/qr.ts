import { convertQris, makeQrDataUrl } from 'bits-qris';
import type { Env } from '../config';
import { AppError } from '../lib/errors';

export class QrService {
  static convertStaticToDynamic(env: Env, amountDue: number): string {
    const qrisStatic = env.QRIS_STATIC?.trim();
    if (!qrisStatic) {
      throw AppError.internal('QRIS_STATIC belum dikonfigurasi');
    }
    try {
      return convertQris(qrisStatic, { amount: amountDue });
    } catch (err) {
      console.error('QRIS convert failed:', err);
      throw AppError.internal('Gagal konversi QRIS static ke dynamic');
    }
  }

  // amountDue wajib: makeQrDataUrl menjalankan convertQris internal (re-inject amount yang sama = idempotent).
  static async generateQrImage(qrisDynamic: string, amountDue: number): Promise<string> {
    try {
      return await makeQrDataUrl(qrisDynamic, { amount: amountDue });
    } catch (err) {
      console.error('QR image generation failed:', err);
      // Fallback untuk local dev Workers (qrcode canvas tidak tersedia)
      // Return placeholder 1x1 PNG agar flow tidak blokir lokal
      console.warn('QR fallback placeholder untuk local dev');
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
    }
  }
}
