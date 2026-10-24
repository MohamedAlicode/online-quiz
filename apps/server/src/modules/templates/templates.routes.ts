import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth';
import { routeParam } from '../../middleware/params';
import * as templatesService from './templates.service';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get('/', (_req, res) => {
  res.json({ templates: templatesService.listTemplates() });
});

templatesRouter.post('/:slug/import', async (req, res) => {
  const quiz = await templatesService.importTemplate(currentUserId(req), routeParam(req, 'slug'));
  res.status(201).json({ quiz });
});
