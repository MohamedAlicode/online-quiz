import type { QuizDto, QuizTemplateDto } from '@quiz/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, registerHost, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('API des quiz prêts à jouer', () => {
  it('liste les modèles disponibles (connexion requise)', async () => {
    await request(app).get('/api/templates').expect(401);

    const { token } = await registerHost();
    const response = await request(app).get('/api/templates').set(auth(token)).expect(200);
    const templates = response.body.templates as QuizTemplateDto[];
    expect(templates.map((template) => template.slug)).toEqual([
      'drapeaux-europe',
      'drapeaux-monde',
      'capitales-europe',
      'capitales-monde',
    ]);
    expect(templates[0]?.previewImages[0]).toMatch(/^\/quiz-images\/flags\/[a-z]{2}\.svg$/);
  });

  it("ajoute une copie modifiable dans le compte de l'hôte", async () => {
    const { token } = await registerHost();
    const response = await request(app)
      .post('/api/templates/capitales-monde/import')
      .set(auth(token))
      .expect(201);
    const quiz = response.body.quiz as QuizDto;

    expect(quiz).toMatchObject({ title: 'Capitales du monde', isPublic: false, questionCount: 12 });
    expect(quiz.questions.map((question) => question.position)).toEqual([...Array(12).keys()]);
    expect(quiz.questions[0]?.imageUrl).toMatch(/^\/quiz-images\/maps\/[a-z]{2}\.svg$/);
    expect(quiz.questions[0]?.choices).toHaveLength(4);

    const list = await request(app).get('/api/quizzes').set(auth(token)).expect(200);
    expect(list.body.quizzes).toHaveLength(1);

    // La copie se modifie comme n'importe quel quiz, image comprise.
    const first = quiz.questions[0]!;
    await request(app)
      .put(`/api/questions/${first.id}`)
      .set(auth(token))
      .send({
        text: first.text,
        imageUrl: first.imageUrl,
        choices: first.choices.map(({ text, isCorrect }) => ({ text, isCorrect })),
      })
      .expect(200);
  });

  it('répond 404 pour un modèle inconnu', async () => {
    const { token } = await registerHost();
    await request(app).post('/api/templates/inexistant/import').set(auth(token)).expect(404);
  });
});
