import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { success, paginated } from '../../lib/response';
import { AdminService } from '../../services/admin';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
});

router.get('/', async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await AdminService.listPayments(
    c.env,
    query.page,
    query.per_page,
    query.status,
    query.search,
  );
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.get('/review', async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await AdminService.reviewQueue(c.env, query.page, query.per_page);
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.post('/:id/confirm', async (c) => {
  const user = c.get('user');
  const payment = await AdminService.confirmPayment(c.env, c.req.param('id'), user.id);
  return success(c, payment);
});

router.post('/:id/reject', async (c) => {
  const user = c.get('user');
  const payment = await AdminService.rejectPayment(c.env, c.req.param('id'), user.id);
  return success(c, payment);
});

export { router as adminPaymentsRoute };
