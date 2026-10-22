import type { Db } from '../lib/prisma';
import type { GameStore } from './game-manager';
import { RoomError } from './room-error';
import type { GameSnapshot } from './snapshot';

/** Implémentation Prisma de la persistance des parties. */
export function createPrismaGameStore(db: Db): GameStore {
  return {
    async createGame({ hostId, quizId, code }) {
      const quiz = await db.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { choices: { orderBy: { position: 'asc' } } },
          },
        },
      });
      if (!quiz || (quiz.ownerId !== hostId && !quiz.isPublic)) {
        throw new RoomError('NOT_FOUND', 'Quiz introuvable');
      }
      if (quiz.questions.length === 0) {
        throw new RoomError(
          'NO_QUESTIONS',
          'Ajoute au moins une question avant de lancer la partie',
        );
      }

      const snapshot: GameSnapshot = {
        quizId: quiz.id,
        title: quiz.title,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          type: question.type,
          text: question.text,
          imageUrl: question.imageUrl,
          timeLimitSec: question.timeLimitSec,
          basePoints: question.basePoints,
          choices: question.choices.map(({ id, text, isCorrect }) => ({ id, text, isCorrect })),
        })),
      };

      const game = await db.game.create({ data: { quizId, hostId, code, snapshot } });
      return { gameId: game.id, snapshot };
    },

    async saveFinishedGame(data) {
      // Tout ou rien : joueurs, réponses et statut sont écrits dans une seule transaction.
      await db.$transaction([
        db.player.createMany({
          data: data.players.map((player) => ({ ...player, gameId: data.gameId })),
        }),
        db.answer.createMany({ data: data.answers }),
        db.game.update({
          where: { id: data.gameId },
          data: { status: 'FINISHED', endedAt: data.endedAt },
        }),
      ]);
    },

    async cancelGame(gameId) {
      await db.game.deleteMany({ where: { id: gameId } });
    },
  };
}
