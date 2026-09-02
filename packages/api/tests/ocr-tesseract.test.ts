import { describe, it, expect, vi, afterEach } from 'vitest';
import { TesseractVpsOcr } from '../src/services/ocr/tesseract-vps';
import { AppError } from '../src/lib/errors';

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TesseractVpsOcr', () => {
  describe('request construction', () => {
    it('POST JSON { image: base64 } dengan Content-Type json', async () => {
      const fetchMock = mockFetch(jsonResponse({ amount: 15000 }));
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', '');

      await ocr.extractReceipt('QkFTRTY0');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://vps.example.com/ocr');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ image: 'QkFTRTY0' }));
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('kirim Authorization Bearer kalau apiKey diset', async () => {
      const fetchMock = mockFetch(jsonResponse({}));
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', 'secret-key');

      await ocr.extractReceipt('QkFTRTY0');

      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer secret-key');
    });

    it('TIDAK ada Authorization kalau apiKey kosong', async () => {
      const fetchMock = mockFetch(jsonResponse({}));
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', '');

      await ocr.extractReceipt('QkFTRTY0');

      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect('Authorization' in headers).toBe(false);
    });
  });

  describe('parse response sukses', () => {
    it('kembalikan OcrResult sesuai payload VPS', async () => {
      mockFetch(
        jsonResponse({
          amount: 1500000001,
          confidence: 92,
          merchant: 'Toko ABC',
          raw_text: 'Toko ABC\nTotal 150.000',
        }),
      );
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', 'k');

      const result = await ocr.extractReceipt('QkFTRTY0');

      expect(result).toEqual({
        amount: 1500000001,
        confidence: 92,
        merchant: 'Toko ABC',
        rawText: 'Toko ABC\nTotal 150.000',
        provider: 'tesseract-vps',
      });
    });

    it('field hilang → fallback aman (amount null, confidence 0, rawText kosong)', async () => {
      mockFetch(jsonResponse({}));
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', 'k');

      const result = await ocr.extractReceipt('QkFTRTY0');

      expect(result).toEqual({
        amount: null,
        confidence: 0,
        merchant: null,
        rawText: '',
        provider: 'tesseract-vps',
      });
    });
  });

  describe('error handling', () => {
    it('HTTP 500 → throw AppError internal_error', async () => {
      mockFetch(jsonResponse({ error: 'boom' }, 500));
      const ocr = new TesseractVpsOcr('https://vps.example.com/ocr', 'k');

      const err = await ocr.extractReceipt('QkFTRTY0').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe('internal_error');
      expect(appErr.message).toContain('HTTP 500');
    });

    it('url kosong → throw AppError internal_error, fetch tidak dipanggil', async () => {
      const fetchMock = mockFetch(jsonResponse({}));
      const ocr = new TesseractVpsOcr('', 'k');

      const err = await ocr.extractReceipt('QkFTRTY0').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe('internal_error');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
