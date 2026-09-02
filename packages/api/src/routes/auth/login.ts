import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AuthService, loginSchema } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.post('/', async (c) => {
  const input = await validateBody(c, loginSchema);
  const result = await AuthService.login(c.env, input);
  return success(c, result);
});

export { router as loginRoute };
