import { Hono } from 'hono';
import type { Env } from '../../config';
import { requireApiKey } from '../../middleware/api-key';
import { apiRateLimit } from '../../middleware/rate-limit';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { PaymentService, chargeSchema } from '../../services/payment';

// Batas body JSON create charge (64KB — metadata dibatasi 4KB di schema).
const MAX_CHARGE_BODY = 64 * 1024;

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireApiKey, apiRateLimit);

router.post('/charges', async (c) => {
  const app = c.get('app');
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > MAX_CHARGE_BODY) {
    throw AppError.payloadTooLarge('Body maksimal 64KB');
  }
  const input = await validateBody(c, chargeSchema);
  const charge = await PaymentService.createCharge(c.env, app, input);
  return success(c, charge, 201);
});

export { router as chargesRoute };
