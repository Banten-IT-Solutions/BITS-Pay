import { Hono } from 'hono';
import { subscriptionsRoute } from './subscriptions';
import { invoicesRoute } from './invoices';

const router = new Hono();
router.route('/subscriptions', subscriptionsRoute);
router.route('/invoices', invoicesRoute);

export { router as billingRoutes };
