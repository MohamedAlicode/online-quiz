import type { AuthResponse, QuestionInput, QuizDto } from '@quiz/shared';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

/** Vide toutes les tables entre deux tests. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Answer", "Player", "Game", "Choice", "Question", "Quiz", "User" CASCADE',
  );
}

let userCounter = 0;

export async function registerHost(name = 'Hôte'): Promise<AuthResponse> {
  userCounter += 1;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: `hote${userCounter}-${Date.now()}@exemple.fr`,
      password: 'motdepasse123',
      displayName: name,
    })
    .expect(201);
  return response.body as AuthResponse;
}

export const sampleQuestions: QuestionInput[] = [
  {
    text: 'Combien de pattes a une araignée ?',
    timeLimitSec: 10,
    choices: [
      { text: '6', isCorrect: false },
      { text: '8', isCorrect: true },
      { text: '10', isCorrect: false },
    ],
  },
  {
    type: 'TRUE_FALSE',
    text: 'Le Soleil est une étoile.',
    timeLimitSec: 10,
    basePoints: 2000,
    choices: [
      { text: 'Vrai', isCorrect: true },
      { text: 'Faux', isCorrect: false },
    ],
  },
];

export async function createQuizWithQuestions(
  token: string,
  questions: QuestionInput[] = sampleQuestions,
): Promise<QuizDto> {
  const created = await request(app)
    .post('/api/quizzes')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Quiz de test', description: 'Pour les tests' })
    .expect(201);
  const quizId = (created.body as { quiz: QuizDto }).quiz.id;

  for (const question of questions) {
    await request(app)
      .post(`/api/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${token}`)
      .send(question)
      .expect(201);
  }

  const full = await request(app)
    .get(`/api/quizzes/${quizId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return (full.body as { quiz: QuizDto }).quiz;
}
