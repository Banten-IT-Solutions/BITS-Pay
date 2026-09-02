import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import {
  WorkspaceService,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '../../services/workspace';

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

router.post('/', async (c) => {
  const user = c.get('user');
  const wid = c.req.param('wid');
  if (!wid) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  const input = await validateBody(c, inviteMemberSchema);
  const member = await WorkspaceService.inviteMember(c.env, user.id, wid, input);
  return success(c, member, 201);
});

router.put('/:memberId', async (c) => {
  const user = c.get('user');
  const wid = c.req.param('wid');
  const memberId = c.req.param('memberId');
  if (!wid) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  const input = await validateBody(c, updateMemberRoleSchema);
  const member = await WorkspaceService.updateMemberRole(c.env, user.id, wid, memberId, input.role);
  return success(c, member);
});

router.delete('/:memberId', async (c) => {
  const user = c.get('user');
  const wid = c.req.param('wid');
  const memberId = c.req.param('memberId');
  if (!wid) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  await WorkspaceService.removeMember(c.env, user.id, wid, memberId);
  return success(c, null, 204);
});

export { router as membersRoute };
