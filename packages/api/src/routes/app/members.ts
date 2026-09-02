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
  const user = c.get('user');
  const wid = c.req.param('wid');
  if (!wid) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  const members = await WorkspaceService.listMembers(c.env, user.id, wid);
  return success(c, members);
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
  return success(c, null, 200);
});

export { router as membersRoute };
