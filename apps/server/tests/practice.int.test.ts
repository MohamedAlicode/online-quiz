import type { PracticeQuizDto } from '@quiz/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './helpers';

describe('API du mode entraînement (sans compte)', () => {
  it('liste les quiz disponibles sans authentification', async () => {
    const response = await request(app).get('/api/practice/templates').expect(200);
    expect(response.body.templates).toHaveLength(4);
  });

  it('fournit une série de questions avec réponses et explications', async () => {
    const response = await request(app).get('/api/practice/templates/capitales-europe').expect(200);
    const practice = response.body.practice as PracticeQuizDto;

    expect(practice.title).toBe("Capitales d'Europe");
    expect(practice.questions).toHaveLength(10);
    for (const question of practice.questions) {
      expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
      const correct = question.choices.find((choice) => choice.isCorrect)!;
      // « Paris est la capitale de la France. »
      expect(question.explanation).toMatch(new RegExp(`^${correct.text} est la capitale `));
      expect(question.imageUrl).toMatch(/^\/quiz-images\/maps\//);
    }
    expect(new Set(practice.questions.flatMap((q) => q.choices.map((c) => c.id))).size).toBe(40);
  });

  it('tire une nouvelle série à chaque demande', async () => {
    const texts = async () =>
      (
        (await request(app).get('/api/practice/templates/drapeaux-monde')).body
          .practice as PracticeQuizDto
      ).questions
        .map((question) => question.imageUrl)
        .join();
    expect(await texts()).not.toBe(await texts());
  });

  it('répond 404 pour un quiz inconnu', async () => {
    await request(app).get('/api/practice/templates/inexistant').expect(404);
  });
});
