import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiDocument } from './docs/openapi';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { staticWeb } from './middleware/static-web';
import { authRouter } from './modules/auth/auth.routes';
import { gamesRouter } from './modules/games/games.routes';
import { questionRouter, quizRouter } from './modules/quizzes/quiz.routes';

export interface AppOptions {
  /** Dossier du front construit à servir sur la même origine que l'API (production). */
  webDistPath?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Derrière l'hébergeur (Render, Railway), l'IP réelle est dans X-Forwarded-For.
  app.set('trust proxy', 1);
  app.use(
    helmet({
      // Swagger UI charge des scripts et styles en ligne.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // Limite les tentatives de connexion / inscription (protection contre le brute force).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie plus tard' } },
  });

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/quizzes', quizRouter);
  app.use('/api/questions', questionRouter);
  app.use('/api/games', gamesRouter);

  const web = options.webDistPath ? staticWeb(options.webDistPath) : null;
  if (web) app.use(web);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
