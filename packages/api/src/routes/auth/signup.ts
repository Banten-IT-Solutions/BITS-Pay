import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AuthService, signupSchema } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.post('/', async (c) => {
  const input = await validateBody(c, signupSchema);
  const result = await AuthService.signup(c.env, input);
  return success(c, result, 201);
});

export { router as signupRoute };
