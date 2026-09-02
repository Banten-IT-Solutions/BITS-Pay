import { z } from 'zod';
import type { Env } from '../../config';
import type { OcrConfig } from '@bits-pay/shared';
import { AppError } from '../../lib/errors';
import { WorkersAiOcr } from './workers-ai';

export interface OcrResult {
  amount: number | null;
  confidence: number;
  merchant: string | null;
  rawText: string;
  provider: string;
}

export interface OcrProvider {
  name: string;
  extractReceipt(imageBase64: string): Promise<OcrResult>;
}

export const ocrResultJsonSchema = z.object({
  amount: z.number().int().nonnegative().nullable(),
  confidence: z.number().min(0).max(100),
  merchant: z.string().nullable(),
});

export async function getOcrProvider(env: Env): Promise<OcrProvider> {
  const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'ocr_provider'").first<{
    value: string;
  }>();
  const provider = (row?.value ?? 'workers-ai') as OcrConfig['ocr_provider'];
  switch (provider) {
    case 'workers-ai':
      return new WorkersAiOcr(env);
    default:
      // ponytail: tesseract-vps provider belum ada — add saat VPS OCR disetup
      throw AppError.internal(`OCR provider tidak didukung: ${provider}`);
  }
}
