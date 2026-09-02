import { Hono } from 'hono';
import type { Env } from '../../config';
import { success } from '../../lib/response';

const router = new Hono<{ Bindings: Env }>();

router.post('/', (c) => {
  return success(c, { message: 'Logout berhasil' });
});

export { router as logoutRoute };
