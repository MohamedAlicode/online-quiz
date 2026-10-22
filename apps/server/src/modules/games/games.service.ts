import type { GameResultsDto, GameSummaryDto } from '@quiz/shared';
import type { Game } from '../../generated/prisma/client';
import { gameSnapshotSchema } from '../../game/snapshot';
import { HttpError } from '../../lib/http-error';
import { prisma } from '../../lib/prisma';
import { buildResults, resultsToCsv, type ResultsPlayer } from './results';

function toGameSummary(game: Game, playerCount: number): GameSummaryDto {
  const snapshot = gameSnapshotSchema.safeParse(game.snapshot);
  return {
    id: game.id,
    quizTitle: snapshot.success ? snapshot.data.title : 'Quiz',
    code: game.code,
    status: game.status,
    startedAt: game.startedAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
    playerCount,
  };
}

/** Historique des parties terminées de l'hôte, de la plus récente à la plus ancienne. */
export async function listFinishedGames(hostId: string): Promise<GameSummaryDto[]> {
  const games = await prisma.game.findMany({
    where: { hostId, status: 'FINISHED' },
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { players: true } } },
    take: 100,
  });
  return games.map((game) => toGameSummary(game, game._count.players));
}

async function loadFinishedGame(hostId: string, gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          answers: {
            select: { questionId: true, choiceId: true, isCorrect: true, timeTakenMs: true },
          },
        },
      },
    },
  });
  if (!game || game.hostId !== hostId) {
    throw HttpError.notFound('Partie introuvable');
  }
  if (game.status !== 'FINISHED') {
    throw HttpError.conflict("La partie n'est pas encore terminée");
  }

  const snapshot = gameSnapshotSchema.parse(game.snapshot);
  const players: ResultsPlayer[] = game.players.map((player) => ({
    nickname: player.nickname,
    finalScore: player.finalScore,
    finalRank: player.finalRank,
    answers: player.answers,
  }));
  const results = buildResults(toGameSummary(game, players.length), snapshot, players);
  return { results, players };
}

export async function getResults(hostId: string, gameId: string): Promise<GameResultsDto> {
  return (await loadFinishedGame(hostId, gameId)).results;
}

export async function getResultsCsv(hostId: string, gameId: string) {
  const { results, players } = await loadFinishedGame(hostId, gameId);
  return { csv: resultsToCsv(results, players), results };
}
