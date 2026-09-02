import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { success, paginated } from '../../lib/response';
import { CallbackAdminService } from '../../services/callback-admin';

const router = new Hono<{ Bindings: Env }>();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'success', 'failed', 'dead']).optional(),
});

router.get('/', async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await CallbackAdminService.list(c.env, query.page, query.per_page, query.status);
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.post('/:id/retry', async (c) => {
  await CallbackAdminService.retry(c.env, c.req.param('id'));
  return success(c, { ok: true });
});

export { router as callbacksRoute };
