import { Hono } from 'hono';
import type { Env } from '../../config';
import { requireApiKey } from '../../middleware/api-key';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { PaymentService, chargeSchema } from '../../services/payment';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireApiKey);

router.post('/charges', async (c) => {
  const app = c.get('app');
  const input = await validateBody(c, chargeSchema);
  const charge = await PaymentService.createCharge(c.env, app, input);
  return success(c, charge, 201);
});

export { router as chargesRoute };
