import { Hono } from 'hono';
import { overviewRoute } from './overview';
import { adminPaymentsRoute } from './payments';
import { adminUsersRoute } from './users';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';

const router = new Hono();
router.use('*', requireAuth, requireAdmin);
router.route('/overview', overviewRoute);
router.route('/payments', adminPaymentsRoute);
router.route('/users', adminUsersRoute);

export { router as adminRoutes };
