import { Hono } from 'hono';
import type { Env } from '../../config';
import { success } from '../../lib/response';
import { AdminService } from '../../services/admin';

const router = new Hono<{ Bindings: Env }>();

router.get('/', async (c) => {
  const overview = await AdminService.overview(c.env);
  return success(c, overview);
});

export { router as overviewRoute };
