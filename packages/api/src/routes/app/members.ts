import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { success } from '../../lib/response';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth);

router.get('/', async (c) => {
  const wid = c.req.param('wid');
  if (!wid) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  const { results } = await c.env.DB.prepare(
    `SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.email, u.name, u.avatar_url
     FROM workspace_members wm
     INNER JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?
     ORDER BY wm.joined_at ASC`,
  )
    .bind(wid)
    .all();
  return success(c, results ?? []);
});

export { router as membersRoute };
