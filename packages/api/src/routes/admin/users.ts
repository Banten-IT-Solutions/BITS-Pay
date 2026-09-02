import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { validateBody } from '../../lib/validate';
import { success, paginated } from '../../lib/response';
import { AdminService, updateUserSchema } from '../../services/admin';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await AdminService.listUsers(c.env, query.page, query.per_page);
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

router.put('/:id', async (c) => {
  const input = await validateBody(c, updateUserSchema);
  const user = await AdminService.updateUser(c.env, c.req.param('id'), c.get('user').id, input);
  return success(c, user);
});

export { router as adminUsersRoute };
