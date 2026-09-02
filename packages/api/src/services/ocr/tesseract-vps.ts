import { AppError } from '../../lib/errors';
import { validateCallbackUrl } from '../../lib/ssrf';
import type { OcrProvider, OcrResult } from './index';

/**
 * OCR via VPS (Tesseract) HTTP endpoint.
 * ponytail: kontrak endpoint diasumsikan `POST {url}` body `{ image: base64 }`
 * → `{ amount, confidence, merchant, raw_text }`. Sesuaikan saat VPS jadi.
 */
export class TesseractVpsOcr implements OcrProvider {
  name = 'tesseract-vps';

  constructor(
    private url: string,
    private apiKey: string,
  ) {}

  async extractReceipt(imageBase64: string): Promise<OcrResult> {
    if (!this.url) {
      throw AppError.internal('vps_ocr_url belum dikonfigurasi');
    }
    validateCallbackUrl(this.url);

    const resp = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ image: imageBase64 }),
    });

    if (!resp.ok) {
      throw AppError.internal(`VPS OCR gagal: HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as {
      amount?: number;
      confidence?: number;
      merchant?: string;
      raw_text?: string;
    };

    return {
      amount: typeof data.amount === 'number' ? data.amount : null,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      merchant: data.merchant ?? null,
      rawText: data.raw_text ?? '',
      provider: this.name,
    };
  }
}
