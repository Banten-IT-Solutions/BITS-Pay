import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireApiKey } from '../../middleware/api-key';
import { apiRateLimit } from '../../middleware/rate-limit';
import { success, paginated } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { validateQuery } from '../../lib/validate';
import { validateProofFile, MAX_PROOF_BYTES } from '../../lib/upload';
import { PaymentService, toPublicPayment } from '../../services/payment';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireApiKey, apiRateLimit);

const confirmAmountSchema = z.object({
  amount: z.coerce.number().int().min(100).max(1_000_000_000),
});

const listQuerySchema = z.object({
  order_id: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed', 'expired', 'pending_review']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

// Batas payload multipart: bukti maks 5MB + overhead form/field.
const MAX_CONFIRM_BODY = MAX_PROOF_BYTES + 1024 * 1024;

router.get('/payments', async (c) => {
  const app = c.get('app');
  const query = validateQuery(c, listQuerySchema);
  const result = await PaymentService.listAppPayments(
    c.env,
    app.workspace_id,
    app.id,
    query.page,
    query.per_page,
    query.status,
    query.order_id,
  );
  return paginated(c, result.data.map(toPublicPayment), result.total, query.page, query.per_page);
});

router.get('/payments/:id', async (c) => {
  const app = c.get('app');
  const payment = await PaymentService.getPayment(
    c.env,
    app.workspace_id,
    app.id,
    c.req.param('id'),
  );
  return success(c, toPublicPayment(payment));
});

router.post('/payments/:id/confirm', async (c) => {
  const app = c.get('app');

  // Gate sebelum parseBody: tolak payload oversize sebelum masuk memory.
  // 413 dicek duluan: oversize ditolak apa pun Content-Type-nya.
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > MAX_CONFIRM_BODY) {
    throw AppError.payloadTooLarge('Payload maksimal 6MB');
  }

  // parseBody menerima multipart ATAU urlencoded — keduanya boleh.
  const contentType = c.req.header('content-type');
  if (
    contentType &&
    !contentType.includes('multipart/form-data') &&
    !contentType.includes('application/x-www-form-urlencoded')
  ) {
    throw AppError.unsupportedMediaType('Content-Type harus multipart/form-data');
  }

  const body = await c.req.parseBody();

  const amountRaw = body.amount;
  if (typeof amountRaw !== 'string' && typeof amountRaw !== 'number') {
    throw AppError.badRequest('validation_error', 'amount wajib disertakan');
  }
  const amountParsed = confirmAmountSchema.safeParse({ amount: amountRaw });
  if (!amountParsed.success) {
    throw AppError.badRequest('validation_error', 'amount tidak valid');
  }

  const proofImageFile = body.proof_image;
  let proofImage: ArrayBuffer | null = null;
  let proofMime: string | null = null;

  if (proofImageFile instanceof File) {
    await validateProofFile(proofImageFile);
    proofImage = await proofImageFile.arrayBuffer();
    proofMime = proofImageFile.type || 'image/jpeg';
  }

  const result = await PaymentService.confirmPayment(
    c.env,
    app.workspace_id,
    app.id,
    c.req.param('id'),
    {
      amount: amountParsed.data.amount,
      proofImage,
      proofMime,
    },
  );

  // Selalu 200 untuk request valid — hasil konfirmasi ada di data.status
  // ('success' | 'pending_review' | 'failed').
  return success(c, result);
});

export { router as paymentsRoute };
