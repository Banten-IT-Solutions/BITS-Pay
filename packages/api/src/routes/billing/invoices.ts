import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { success, paginated } from '../../lib/response';
import { BillingService } from '../../services/billing';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', async (c) => {
  const user = c.get('user');
  const query = querySchema.parse(c.req.query());
  const result = await BillingService.listInvoices(c.env, user.id, query.page, query.per_page);
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.get('/:id', async (c) => {
  const user = c.get('user');
  const invoice = await BillingService.getInvoice(c.env, user.id, c.req.param('id'));
  return success(c, invoice);
});

router.post('/:id/pay', async (c) => {
  const user = c.get('user');
  const payment = await BillingService.payInvoice(c.env, user.id, c.req.param('id'));
  return success(c, payment, 201);
});

export { router as invoicesRoute };
