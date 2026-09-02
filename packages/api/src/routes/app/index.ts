import { Hono } from 'hono';
import { workspacesRoute } from './workspaces';
import { appsRoute } from './apps';
import { membersRoute } from './members';
import { requireAuth } from '../../middleware/auth';

const router = new Hono();
router.use('*', requireAuth);
router.route('/workspaces', workspacesRoute);
router.route('/workspaces/:wid/apps', appsRoute);
router.route('/workspaces/:wid/members', membersRoute);

export { router as appRoutes };
