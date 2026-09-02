import { Hono } from 'hono';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { success } from '../../lib/response';
import { AdminService } from '../../services/admin';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

router.get('/', async (c) => {
  const overview = await AdminService.overview(c.env);
  return success(c, overview);
});

export { router as overviewRoute };
