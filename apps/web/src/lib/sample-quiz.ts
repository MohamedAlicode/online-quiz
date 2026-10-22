import type { QuestionInput, QuizDto } from '@quiz/shared';
import { api } from './api';

/** Quiz d'exemple, pour essayer l'application en un clic. */
const SAMPLE_QUESTIONS: QuestionInput[] = [
  {
    text: 'Combien de pattes a une araignée ?',
    timeLimitSec: 15,
    choices: [
      { text: '6', isCorrect: false },
      { text: '8', isCorrect: true },
      { text: '10', isCorrect: false },
      { text: '12', isCorrect: false },
    ],
  },
  {
    type: 'TRUE_FALSE',
    text: 'Le Soleil est une étoile.',
    timeLimitSec: 10,
    choices: [
      { text: 'Vrai', isCorrect: true },
      { text: 'Faux', isCorrect: false },
    ],
  },
  {
    text: 'Quel est le plus grand océan du monde ?',
    timeLimitSec: 20,
    choices: [
      { text: 'Atlantique', isCorrect: false },
      { text: 'Indien', isCorrect: false },
      { text: 'Pacifique', isCorrect: true },
      { text: 'Arctique', isCorrect: false },
    ],
  },
  {
    text: 'Quelle couleur obtient-on en mélangeant du bleu et du jaune ?',
    timeLimitSec: 15,
    choices: [
      { text: 'Vert', isCorrect: true },
      { text: 'Violet', isCorrect: false },
      { text: 'Orange', isCorrect: false },
    ],
  },
  {
    text: 'Combien de joueurs compte une équipe de football sur le terrain ?',
    timeLimitSec: 20,
    basePoints: 2000,
    choices: [
      { text: '9', isCorrect: false },
      { text: '10', isCorrect: false },
      { text: '11', isCorrect: true },
      { text: '12', isCorrect: false },
    ],
  },
];

export async function createSampleQuiz(): Promise<QuizDto> {
  const { quiz } = await api<{ quiz: QuizDto }>('/quizzes', {
    method: 'POST',
    body: {
      title: 'Culture générale (exemple)',
      description: 'Cinq questions pour tester une partie avec ton groupe.',
    },
  });
  for (const question of SAMPLE_QUESTIONS) {
    await api(`/quizzes/${quiz.id}/questions`, { method: 'POST', body: question });
  }
  return quiz;
}
