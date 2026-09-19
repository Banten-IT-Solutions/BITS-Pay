import { convertQris } from 'bits-qris';
import QRCode from 'qrcode';
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

  // Render QR sebagai SVG data URL — QRCode.create murni JS (tanpa canvas),
  // jadi aman di Cloudflare Workers. makeQrDataUrl dari bits-qris tidak dipakai
  // karena qrcode.toDataURL butuh DOM canvas.
  static async generateQrImage(qrisDynamic: string, _amountDue: number): Promise<string> {
    try {
      const qr = QRCode.create(qrisDynamic, { errorCorrectionLevel: 'M' });
      const { size, data } = qr.modules;
      const margin = 2;
      const dim = size + margin * 2;
      let path = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (data[r * size + c]) path += `M${c + margin} ${r + margin}h1v1h-1z`;
        }
      }
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
        `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
        `<path d="${path}" fill="#000000"/></svg>`;
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    } catch (err) {
      console.error('QR image generation failed:', err);
      throw AppError.internal('Gagal membuat gambar QR');
    }
  }
}
