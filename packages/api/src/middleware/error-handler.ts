import { Context } from 'hono';
import { AppError } from '../lib/errors';

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      },
      err.statusCode as 400,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: { code: 'internal_error', message: 'Internal server error' },
    },
    500,
  );
}
