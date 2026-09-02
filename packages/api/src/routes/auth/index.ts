import { Hono } from 'hono';
import { signupRoute } from './signup';
import { loginRoute } from './login';
import { logoutRoute } from './logout';
import { verifyRoute } from './verify';
import { resetRoute } from './reset';
import { googleRoute } from './google';

const router = new Hono();
router.route('/signup', signupRoute);
router.route('/login', loginRoute);
router.route('/logout', logoutRoute);
router.route('', verifyRoute);
router.route('', resetRoute);
router.route('', googleRoute);

export { router as authRoutes };
