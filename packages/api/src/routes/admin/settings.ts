import { Hono } from 'hono';
import type { Env } from '../../config';
import { validateBody } from '../../lib/validate';
import { success } from '../../lib/response';
import { AppError } from '../../lib/errors';
import { OcrConfigService, ocrConfigSchema } from '../../services/ocr-config';
import { EmailTemplateService, emailTemplatesSchema } from '../../services/email-template';

const router = new Hono<{ Bindings: Env }>();

router.get('/ocr', async (c) => success(c, await OcrConfigService.getConfig(c.env)));

router.put('/ocr', async (c) => {
  const input = await validateBody(c, ocrConfigSchema);
  return success(c, await OcrConfigService.saveConfig(c.env, c.get('user').id, input));
});

router.post('/ocr/test', async (c) => {
  const body = await c.req.parseBody();
  const file = body.proof_image;
  if (!(file instanceof File)) {
    throw AppError.badRequest('validation_error', 'proof_image wajib disertakan');
  }
  return success(c, await OcrConfigService.test(c.env, await file.arrayBuffer()));
});

router.get('/email-templates', async (c) => success(c, await EmailTemplateService.getAll(c.env)));

router.put('/email-templates', async (c) => {
  const input = await validateBody(c, emailTemplatesSchema);
  return success(c, await EmailTemplateService.update(c.env, c.get('user').id, input));
});

export { router as settingsRoute };
