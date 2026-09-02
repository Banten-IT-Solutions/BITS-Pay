import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { TierConfigService, tierConfigSchema } from '../../services/tier-config';

const router = new Hono<{ Bindings: Env }>();

router.get('/', async (c) => success(c, await TierConfigService.getAll(c.env)));

router.put('/', async (c) => {
  const input = await validateBody(c, tierConfigSchema);
  return success(c, await TierConfigService.update(c.env, c.get('user').id, input));
});

export { router as tierFeaturesRoute };
