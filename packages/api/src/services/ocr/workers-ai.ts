import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { ocrResultJsonSchema, type OcrProvider, type OcrResult } from './index';

interface VisionResponse {
  response?: string;
}

export class WorkersAiOcr implements OcrProvider {
  name = 'workers-ai';

  constructor(private env: Env) {}

  async extractReceipt(imageBase64: string): Promise<OcrResult> {
    const image = [...new Uint8Array(toBytes(imageBase64))];
    const prompt =
      'Kamu membaca bukti pembayaran/struk transfer (IDR). ' +
      'Balas HANYA JSON valid tanpa teks lain: ' +
      '{"amount":<integer rupiah, total transfer>, "confidence":<0-100>, "merchant":"nama merchant/pengirim atau null"}. ' +
      'Jika nominal tidak terbaca, amount=null.';
    const result = (await this.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      prompt,
      image,
    })) as VisionResponse;

    const rawText = result.response ?? '';
    const jsonText = rawText.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) throw AppError.internal('OCR tidak mengembalikan JSON');
    const parsed = ocrResultJsonSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) throw AppError.internal('Format hasil OCR tidak valid');
    return { ...parsed.data, rawText, provider: this.name };
  }
}

function toBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
