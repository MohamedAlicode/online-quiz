import type { PublicQuestion } from '@quiz/shared';
import { z } from 'zod';

/**
 * Instantané du quiz figé au lancement d'une partie et stocké dans `Game.snapshot`.
 * La partie et ses résultats restent cohérents même si le quiz est modifié ou supprimé ensuite.
 */
export const gameSnapshotSchema = z.object({
  quizId: z.string(),
  title: z.string(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['SINGLE', 'TRUE_FALSE']),
        text: z.string(),
        imageUrl: z.string().nullable(),
        timeLimitSec: z.number().int().positive(),
        basePoints: z.number().int().min(0),
        choices: z.array(z.object({ id: z.string(), text: z.string(), isCorrect: z.boolean() })),
      }),
    )
    .min(1),
});

export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;
export type SnapshotQuestion = GameSnapshot['questions'][number];

/** Version publique d'une question : on retire `isCorrect` de chaque réponse. */
export function toPublicQuestion(question: SnapshotQuestion): PublicQuestion {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl,
    timeLimitSec: question.timeLimitSec,
    basePoints: question.basePoints,
    choices: question.choices.map(({ id, text }) => ({ id, text })),
  };
}

export function correctChoiceId(question: SnapshotQuestion): string {
  const correct = question.choices.find((choice) => choice.isCorrect);
  if (!correct) {
    throw new Error(`La question ${question.id} n'a pas de bonne réponse`);
  }
  return correct.id;
}
