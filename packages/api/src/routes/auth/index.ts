import { Hono } from 'hono';
import { signupRoute } from './signup';
import { loginRoute } from './login';
import { logoutRoute } from './logout';
import { logoutAllRoute } from './logout-all';
import { exchangeRoute } from './exchange';
import { verifyRoute } from './verify';
import { resetRoute } from './reset';
import { googleRoute } from './google';
import { meRoute } from './me';
import { profileRoute } from './profile';
import { passwordRoute } from './password';

const router = new Hono();
router.route('/signup', signupRoute);
router.route('/login', loginRoute);
router.route('/logout', logoutRoute);
router.route('/logout-all', logoutAllRoute);
router.route('/exchange', exchangeRoute);
router.route('/profile', profileRoute);
router.route('/password', passwordRoute);
router.route('', meRoute);
router.route('', verifyRoute);
router.route('', resetRoute);
router.route('', googleRoute);

export { router as authRoutes };
