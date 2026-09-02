import { Hono } from 'hono';
import { workspacesRoute } from './workspaces';
import { appsRoute } from './apps';
import { membersRoute } from './members';
import { appPaymentsRoute } from './payments';
import { requireAuth } from '../../middleware/auth';
import { userRateLimit } from '../../middleware/rate-limit';

const router = new Hono();
router.use('*', requireAuth, userRateLimit);
router.route('/workspaces', workspacesRoute);
router.route('/workspaces/:wid/apps', appsRoute);
router.route('/workspaces/:wid/members', membersRoute);
router.route('/payments', appPaymentsRoute);

export { router as appRoutes };
