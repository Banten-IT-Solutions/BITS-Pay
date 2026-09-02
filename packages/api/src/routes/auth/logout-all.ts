import { Hono } from 'hono';
import type { Env } from '../../config';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';

const router = new Hono<{ Bindings: Env }>();

router.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?')
    .bind(user.id)
    .run();
  return success(c, { message: 'Semua sesi telah logout' });
});

export { router as logoutAllRoute };
