import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireApiKey } from '../../middleware/api-key';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { validateProofFile } from '../../lib/upload';
import { PaymentService } from '../../services/payment';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireApiKey);

const confirmAmountSchema = z.object({
  amount: z.coerce.number().int().min(100),
});

router.get('/payments/:id', async (c) => {
  const app = c.get('app');
  const payment = await PaymentService.getPayment(c.env, app.workspace_id, c.req.param('id'));
  return success(c, payment);
});

router.post('/payments/:id/confirm', async (c) => {
  const app = c.get('app');
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
    validateProofFile(proofImageFile);
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

  const statusCode =
    result.status === 'pending_review'
      ? 202
      : result.status === 'success'
        ? 200
        : result.status === 'failed'
          ? 400
          : 200;
  return success(c, result, statusCode);
});

export { router as paymentsRoute };
