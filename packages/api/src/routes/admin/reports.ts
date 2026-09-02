import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../config';
import { success } from '../../lib/response';
import { ReportService } from '../../services/report';

const router = new Hono<{ Bindings: Env }>();

const daysSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

router.get('/transactions', async (c) => {
  const query = daysSchema.parse(c.req.query());
  return success(c, await ReportService.transactions(c.env, query.days));
});

router.get('/export', async (c) => {
  const query = daysSchema.parse(c.req.query());
  const csv = await ReportService.exportCsv(c.env, query.days);
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="payments.csv"');
  return c.text(csv);
});

export { router as reportsRoute };
