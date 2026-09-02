import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { success } from '../../lib/response';
import { validateBody } from '../../lib/validate';
import { AuthService } from '../../services/auth';

const exchangeSchema = z.object({
  code: z.string().min(1),
});

const router = new Hono<{ Bindings: Env }>();

router.post('/', async (c) => {
  const { code } = await validateBody(c, exchangeSchema);
  const data = await AuthService.exchangeCode(c.env, code);
  return success(c, data);
});

export { router as exchangeRoute };
