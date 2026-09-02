import { Context } from 'hono';
import { AppError } from '../lib/errors';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function setSecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
}

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    const res = c.json(
      {
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      },
      err.statusCode as 400,
    );
    setSecurityHeaders(res.headers);
    return res;
  }

  console.error('Unhandled error:', err);
  const res = c.json(
    {
      success: false,
      error: { code: 'internal_error', message: 'Internal server error' },
    },
    500,
  );
  setSecurityHeaders(res.headers);
  return res;
}
