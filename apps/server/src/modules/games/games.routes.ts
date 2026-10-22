import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth';
import { routeParam } from '../../middleware/params';
import * as gamesService from './games.service';

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

gamesRouter.get('/', async (req, res) => {
  res.json({ games: await gamesService.listFinishedGames(currentUserId(req)) });
});

gamesRouter.get('/:id/results', async (req, res) => {
  res.json({ results: await gamesService.getResults(currentUserId(req), routeParam(req, 'id')) });
});

gamesRouter.get('/:id/results.csv', async (req, res) => {
  const { csv, results } = await gamesService.getResultsCsv(
    currentUserId(req),
    routeParam(req, 'id'),
  );
  const day = results.game.startedAt.slice(0, 10);
  res
    .type('text/csv; charset=utf-8')
    .attachment(`resultats-${results.game.code}-${day}.csv`)
    .send(csv);
});
