import type { QuizDto } from '@quiz/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createQuizWithQuestions, registerHost, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('API quiz et questions', () => {
  it('crée, liste, modifie et supprime un quiz', async () => {
    const { token } = await registerHost();

    const created = await request(app)
      .post('/api/quizzes')
      .set(auth(token))
      .send({ title: '  Culture générale  ', coverUrl: '' })
      .expect(201);
    const quiz = created.body.quiz as QuizDto;
    expect(quiz).toMatchObject({ title: 'Culture générale', coverUrl: null, isPublic: false });

    const list = await request(app).get('/api/quizzes').set(auth(token)).expect(200);
    expect(list.body.quizzes).toHaveLength(1);
    expect(list.body.quizzes[0].questionCount).toBe(0);

    const updated = await request(app)
      .put(`/api/quizzes/${quiz.id}`)
      .set(auth(token))
      .send({ title: 'Culture G', isPublic: true })
      .expect(200);
    expect(updated.body.quiz).toMatchObject({ title: 'Culture G', isPublic: true });

    await request(app).delete(`/api/quizzes/${quiz.id}`).set(auth(token)).expect(204);
    await request(app).get(`/api/quizzes/${quiz.id}`).set(auth(token)).expect(404);
  });

  it('ajoute des questions dans l’ordre avec leurs réponses', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);

    expect(quiz.questionCount).toBe(2);
    expect(quiz.questions.map((q) => q.position)).toEqual([0, 1]);
    expect(quiz.questions[0]?.choices.map((c) => c.text)).toEqual(['6', '8', '10']);
    expect(quiz.questions[1]).toMatchObject({ type: 'TRUE_FALSE', basePoints: 2000 });
  });

  it('refuse une question sans bonne réponse', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token, []);
    const response = await request(app)
      .post(`/api/quizzes/${quiz.id}/questions`)
      .set(auth(token))
      .send({
        text: 'Question ?',
        choices: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: false },
        ],
      })
      .expect(400);
    expect(response.body.error.message).toBe('Il faut exactement une bonne réponse');
  });

  it('modifie une question en remplaçant ses réponses', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);
    const question = quiz.questions[0]!;

    const response = await request(app)
      .put(`/api/questions/${question.id}`)
      .set(auth(token))
      .send({
        text: 'Combien de pattes a un insecte ?',
        timeLimitSec: 30,
        choices: [
          { text: '6', isCorrect: true },
          { text: '8', isCorrect: false },
        ],
      })
      .expect(200);
    expect(response.body.question).toMatchObject({ timeLimitSec: 30, position: 0 });
    expect(response.body.question.choices).toHaveLength(2);
    expect(await prisma.choice.count({ where: { questionId: question.id } })).toBe(2);
  });

  it('réordonne les questions et renumérote après suppression', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);
    const [first, second] = quiz.questions.map((q) => q.id);

    const reordered = await request(app)
      .put(`/api/quizzes/${quiz.id}/questions/reorder`)
      .set(auth(token))
      .send({ questionIds: [second, first] })
      .expect(200);
    expect(reordered.body.quiz.questions.map((q: { id: string }) => q.id)).toEqual([second, first]);

    await request(app)
      .put(`/api/quizzes/${quiz.id}/questions/reorder`)
      .set(auth(token))
      .send({ questionIds: [first] })
      .expect(400);

    await request(app).delete(`/api/questions/${second}`).set(auth(token)).expect(204);
    const after = await request(app).get(`/api/quizzes/${quiz.id}`).set(auth(token)).expect(200);
    expect(
      after.body.quiz.questions.map((q: { id: string; position: number }) => [q.id, q.position]),
    ).toEqual([[first, 0]]);
  });

  it('duplique un quiz avec toutes ses questions', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);

    const response = await request(app)
      .post(`/api/quizzes/${quiz.id}/duplicate`)
      .set(auth(token))
      .expect(201);
    const copy = response.body.quiz as QuizDto;
    expect(copy.id).not.toBe(quiz.id);
    expect(copy.title).toBe('Quiz de test (copie)');
    expect(copy.questions).toHaveLength(2);
    expect(copy.questions[0]?.id).not.toBe(quiz.questions[0]?.id);
  });

  it('isole les quiz entre hôtes (404 privé, 403 en écriture sur un quiz public)', async () => {
    const owner = await registerHost('Propriétaire');
    const other = await registerHost('Autre');
    const quiz = await createQuizWithQuestions(owner.token);

    await request(app).get(`/api/quizzes/${quiz.id}`).set(auth(other.token)).expect(404);
    await request(app)
      .put(`/api/quizzes/${quiz.id}`)
      .set(auth(other.token))
      .send({ title: 'Pirate' })
      .expect(404);
    await request(app)
      .delete(`/api/questions/${quiz.questions[0]?.id}`)
      .set(auth(other.token))
      .expect(404);

    await request(app)
      .put(`/api/quizzes/${quiz.id}`)
      .set(auth(owner.token))
      .send({ title: 'Public', isPublic: true })
      .expect(200);
    await request(app).get(`/api/quizzes/${quiz.id}`).set(auth(other.token)).expect(200);
    await request(app)
      .put(`/api/quizzes/${quiz.id}`)
      .set(auth(other.token))
      .send({ title: 'Pirate' })
      .expect(403);
    await request(app).post(`/api/quizzes/${quiz.id}/duplicate`).set(auth(other.token)).expect(201);
  });
});
