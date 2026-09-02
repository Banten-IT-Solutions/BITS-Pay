import { z } from 'zod';
import type { Env } from '../config';
import type { OcrConfigSettings } from '@bits-pay/shared';
import { getOcrProvider, type OcrResult } from './ocr';
import { AuditService } from './audit';
import { validateCallbackUrl } from '../lib/ssrf';

const KEYS = ['ocr_provider', 'vps_ocr_url', 'vps_ocr_api_key'] as const;

export const ocrConfigSchema = z.object({
  ocr_provider: z.enum(['workers-ai', 'tesseract-vps']).optional(),
  vps_ocr_url: z.string().optional(),
  vps_ocr_api_key: z.string().optional(),
});

type OcrConfigInput = z.infer<typeof ocrConfigSchema>;

export class OcrConfigService {
  static async getConfig(env: Env): Promise<OcrConfigSettings> {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM config WHERE key IN ('ocr_provider', 'vps_ocr_url', 'vps_ocr_api_key')",
    ).all<{ key: string; value: string }>();
    const map = new Map((results ?? []).map((r) => [r.key, r.value]));
    return {
      ocr_provider: map.get('ocr_provider') ?? 'workers-ai',
      vps_ocr_url: map.get('vps_ocr_url') ?? '',
      vps_ocr_api_key: map.get('vps_ocr_api_key') ?? '',
    };
  }

  static async saveConfig(
    env: Env,
    adminId: string,
    input: OcrConfigInput,
  ): Promise<OcrConfigSettings> {
    const current = await OcrConfigService.getConfig(env);
    const provider = input.ocr_provider ?? current.ocr_provider;
    const vpsUrl = input.vps_ocr_url ?? current.vps_ocr_url;
    if (provider === 'tesseract-vps' && vpsUrl) {
      // Tolak URL non-https / private IP (SSRF ke jaringan internal).
      validateCallbackUrl(vpsUrl);
    }

    for (const key of KEYS) {
      const value = input[key];
      if (value === undefined) continue;
      await env.DB.prepare(
        `INSERT INTO config (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
      )
        .bind(key, value, adminId)
        .run();
    }
    await AuditService.log(env, {
      userId: adminId,
      action: 'admin.update_ocr_config',
      entityType: 'config',
    });
    return OcrConfigService.getConfig(env);
  }

  static async test(env: Env, imageBytes: Uint8Array | ArrayBuffer): Promise<OcrResult> {
    const provider = await getOcrProvider(env);
    return provider.extractReceipt(arrayBufferToBase64(imageBytes));
  }
}

// Chunk 32KB: concat per-byte = O(n²) untuk gambar besar.
function arrayBufferToBase64(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
