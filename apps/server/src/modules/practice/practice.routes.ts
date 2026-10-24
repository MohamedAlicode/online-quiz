import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { routeParam } from '../../middleware/params';
import * as practiceService from './practice.service';

/** Routes publiques (sans compte) du mode entraînement en solo. */
export const practiceRouter = Router();

practiceRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: {
      error: { code: 'RATE_LIMITED', message: 'Trop de requêtes, réessaie dans un instant' },
    },
  }),
);

practiceRouter.get('/templates', (_req, res) => {
  res.json({ templates: practiceService.listPracticeTemplates() });
});

practiceRouter.get('/templates/:slug', (req, res) => {
  res.json({ practice: practiceService.buildPracticeQuiz(routeParam(req, 'slug')) });
});
