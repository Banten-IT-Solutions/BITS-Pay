import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { success, paginated } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { validateProofFile } from '../../lib/upload';
import { PaymentService } from '../../services/payment';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const confirmAmountSchema = z.object({
  amount: z.coerce.number().int().min(100).max(1_000_000_000),
});

router.get('/stats', async (c) => {
  const user = c.get('user');
  const stats = await PaymentService.userStats(c.env, user.id);
  return success(c, stats);
});

router.get('/', async (c) => {
  const user = c.get('user');
  const query = querySchema.parse(c.req.query());
  const result = await PaymentService.listUserPayments(
    c.env,
    user.id,
    query.page,
    query.per_page,
    query.status,
    query.search,
    query.start_date,
    query.end_date,
  );
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.get('/:id', async (c) => {
  const user = c.get('user');
  const payment = await PaymentService.getUserPayment(c.env, user.id, c.req.param('id'));
  return success(c, payment);
});

router.post('/:id/confirm', async (c) => {
  const user = c.get('user');
  const payment = await PaymentService.getUserPayment(c.env, user.id, c.req.param('id'));

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
    payment.workspace_id,
    null,
    c.req.param('id'),
    {
      amount: amountParsed.data.amount,
      proofImage,
      proofMime,
    },
  );

  const statusCode =
    result.status === 'pending_review' ? 202 : result.status === 'failed' ? 400 : 200;
  return success(c, result, statusCode);
});

export { router as appPaymentsRoute };
