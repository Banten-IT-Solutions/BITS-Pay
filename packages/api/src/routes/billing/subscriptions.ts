import { Hono } from 'hono';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { userRateLimit } from '../../middleware/rate-limit';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { BillingService, upgradeSchema } from '../../services/billing';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, userRateLimit);

router.post('/upgrade', async (c) => {
  const user = c.get('user');
  const input = await validateBody(c, upgradeSchema);
  const result = await BillingService.upgrade(c.env, user.id, input);
  return success(c, result, 201);
});

router.get('/current', async (c) => {
  const user = c.get('user');
  const sub = await BillingService.current(c.env, user.id);
  return success(c, sub);
});

router.post('/cancel', async (c) => {
  const user = c.get('user');
  const sub = await BillingService.cancel(c.env, user.id);
  return success(c, sub);
});

export { router as subscriptionsRoute };
