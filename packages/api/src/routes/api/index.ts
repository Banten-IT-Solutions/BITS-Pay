import { Hono } from 'hono';
import { chargesRoute } from './charges';
import { paymentsRoute } from './payments';

const router = new Hono();
router.route('/', chargesRoute);
router.route('/', paymentsRoute);

export { router as apiRoutes };
