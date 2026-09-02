import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { paginated } from '../../lib/response';
import { AuditService } from '../../services/audit';

const router = new Hono<{ Bindings: Env }>();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await AuditService.list(c.env, query.page, query.per_page);
  return paginated(c, result.data, result.total, query.page, query.per_page);
});

export { router as auditLogsRoute };
