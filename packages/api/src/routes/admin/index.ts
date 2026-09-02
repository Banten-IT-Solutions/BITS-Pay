import { Hono } from 'hono';
import { overviewRoute } from './overview';
import { adminPaymentsRoute } from './payments';
import { adminUsersRoute } from './users';
import { callbacksRoute } from './callbacks';
import { settingsRoute } from './settings';
import { auditLogsRoute } from './audit-logs';
import { reportsRoute } from './reports';
import { tierFeaturesRoute } from './tier-features';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';

const router = new Hono();
router.use('*', requireAuth, requireAdmin);
router.route('/overview', overviewRoute);
router.route('/payments', adminPaymentsRoute);
router.route('/users', adminUsersRoute);
router.route('/callbacks', callbacksRoute);
router.route('/settings', settingsRoute);
router.route('/audit-logs', auditLogsRoute);
router.route('/reports', reportsRoute);
router.route('/tier-features', tierFeaturesRoute);

export { router as adminRoutes };
