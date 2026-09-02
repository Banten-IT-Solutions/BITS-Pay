import { z } from 'zod';
import { Context } from 'hono';
import { AppError } from './errors';

function zodDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!details[path]) details[path] = [];
    details[path].push(issue.message);
  }
  return details;
}

export async function validateBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw AppError.badRequest('validation_error', 'Body harus JSON valid');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw AppError.badRequest('validation_error', 'Validasi gagal', zodDetails(result.error));
  }
  return result.data;
}

export function validateQuery<T>(c: Context, schema: z.ZodType<T>): T {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw AppError.badRequest('validation_error', 'Validasi query gagal', zodDetails(result.error));
  }
  return result.data;
}
