import { z } from 'zod';
import type { Env } from '../../config';
import type { OcrConfig } from '@bits-pay/shared';
import { WorkersAiOcr } from './workers-ai';
import { TesseractVpsOcr } from './tesseract-vps';

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
  if (provider === 'tesseract-vps') {
    const url = await readConfig(env, 'vps_ocr_url');
    const apiKey = await readConfig(env, 'vps_ocr_api_key');
    return new TesseractVpsOcr(url, apiKey);
  }
  return new WorkersAiOcr(env);
}

async function readConfig(env: Env, key: string): Promise<string> {
  const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind(key).first<{
    value: string;
  }>();
  return row?.value ?? '';
}
