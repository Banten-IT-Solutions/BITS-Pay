import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireApiKey } from '../../middleware/api-key';
import { apiRateLimit } from '../../middleware/rate-limit';
import { success, paginated } from '../../lib/response';
import { validateQuery } from '../../lib/validate';
import { CallbackService, toPublicCallback } from '../../services/callback';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireApiKey, apiRateLimit);

const listQuerySchema = z.object({
  payment_id: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed', 'dead']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/callbacks', async (c) => {
  const app = c.get('app');
  const query = validateQuery(c, listQuerySchema);
  const result = await CallbackService.listAppCallbacks(
    c.env,
    app.id,
    query.page,
    query.per_page,
    query.status,
    query.payment_id,
  );
  return paginated(c, result.data.map(toPublicCallback), result.total, query.page, query.per_page);
});

router.post('/callbacks/:id/retry', async (c) => {
  const app = c.get('app');
  const callback = await CallbackService.retryAppCallback(c.env, app.id, c.req.param('id'));
  return success(c, toPublicCallback(callback));
});

export { router as callbacksRoute };
