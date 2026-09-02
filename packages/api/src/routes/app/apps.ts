import { Hono } from 'hono';
import type { Env } from '../../config';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AppService, createAppSchema, updateAppSchema } from '../../services/app';

function wid(c: { req: { param: (s: string) => string | undefined } }): string {
  const v = c.req.param('wid');
  if (!v) throw AppError.badRequest('validation_error', 'workspace_id tidak valid');
  return v;
}

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth);

router.get('/', async (c) => {
  const apps = await AppService.list(c.env, wid(c));
  return success(c, apps);
});

router.post('/', async (c) => {
  const user = c.get('user');
  const input = await validateBody(c, createAppSchema);
  const app = await AppService.create(c.env, user.id, wid(c), input);
  return success(c, app, 201);
});

router.get('/:id', async (c) => {
  const id = c.req.param('id') ?? '';
  const app = await AppService.get(c.env, wid(c), id);
  return success(c, app);
});

router.put('/:id', async (c) => {
  const id = c.req.param('id') ?? '';
  const input = await validateBody(c, updateAppSchema);
  const app = await AppService.update(c.env, wid(c), id, input);
  return success(c, app);
});

router.post('/:id/rotate-key', async (c) => {
  const id = c.req.param('id') ?? '';
  const app = await AppService.rotateKey(c.env, wid(c), id);
  return success(c, app);
});

export { router as appsRoute };
