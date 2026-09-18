import { Hono } from 'hono';
import { chargesRoute } from './charges';
import { paymentsRoute } from './payments';
import { callbacksRoute } from './callbacks';

const router = new Hono();
router.route('/', chargesRoute);
router.route('/', paymentsRoute);
router.route('/', callbacksRoute);

export { router as apiRoutes };
