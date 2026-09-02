import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AuthService, signupSchema } from '../../services/auth';

const router = new Hono<{ Bindings: Env }>();

router.post('/', async (c) => {
  const input = await validateBody(c, signupSchema);
  await AuthService.signup(c.env, input);
  // Anti-enumeration: selalu 201, tanpa data — email baru atau terdaftar sama.
  return success(c, null, 201);
});

export { router as signupRoute };
