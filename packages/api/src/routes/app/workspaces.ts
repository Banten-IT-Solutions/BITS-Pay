import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import {
  WorkspaceService,
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from '../../services/workspace';

const router = new Hono<{ Bindings: Env }>();

router.get('/', async (c) => {
  const user = c.get('user');
  const workspaces = await WorkspaceService.list(c.env, user.id);
  return success(c, workspaces);
});

router.post('/', async (c) => {
  const user = c.get('user');
  const input = await validateBody(c, createWorkspaceSchema);
  const workspace = await WorkspaceService.create(c.env, user.id, input);
  return success(c, workspace, 201);
});

router.get('/:id', async (c) => {
  const user = c.get('user');
  const workspace = await WorkspaceService.get(c.env, user.id, c.req.param('id'));
  return success(c, workspace);
});

router.put('/:id', async (c) => {
  const user = c.get('user');
  const input = await validateBody(c, updateWorkspaceSchema);
  const workspace = await WorkspaceService.update(c.env, user.id, c.req.param('id'), input);
  return success(c, workspace);
});

router.delete('/:id', async (c) => {
  const user = c.get('user');
  await WorkspaceService.delete(c.env, user.id, c.req.param('id'));
  return success(c, { message: 'Workspace dihapus' });
});

export { router as workspacesRoute };
