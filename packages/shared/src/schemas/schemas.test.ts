import { describe, expect, it } from 'vitest';
import { joinGameSchema, answerSchema } from '../socket';
import { questionInputSchema, quizInputSchema } from './quiz';
import { registerSchema } from './auth';

const validQuestion = {
  text: 'Capitale de la France ?',
  choices: [
    { text: 'Paris', isCorrect: true },
    { text: 'Lyon', isCorrect: false },
  ],
};

describe('questionInputSchema', () => {
  it('applique les valeurs par défaut', () => {
    const parsed = questionInputSchema.parse(validQuestion);
    expect(parsed).toMatchObject({ type: 'SINGLE', timeLimitSec: 20, basePoints: 1000 });
  });

  it('exige exactement une bonne réponse', () => {
    const none = questionInputSchema.safeParse({
      ...validQuestion,
      choices: validQuestion.choices.map((c) => ({ ...c, isCorrect: false })),
    });
    const two = questionInputSchema.safeParse({
      ...validQuestion,
      choices: validQuestion.choices.map((c) => ({ ...c, isCorrect: true })),
    });
    expect(none.success).toBe(false);
    expect(two.success).toBe(false);
  });

  it('limite le nombre de réponses entre 2 et 4', () => {
    const one = questionInputSchema.safeParse({
      ...validQuestion,
      choices: [validQuestion.choices[0]],
    });
    const five = questionInputSchema.safeParse({
      ...validQuestion,
      choices: [
        ...validQuestion.choices,
        { text: 'C', isCorrect: false },
        { text: 'D', isCorrect: false },
        { text: 'E', isCorrect: false },
      ],
    });
    expect(one.success).toBe(false);
    expect(five.success).toBe(false);
  });

  it('impose deux réponses pour une question vrai/faux', () => {
    const result = questionInputSchema.safeParse({
      ...validQuestion,
      type: 'TRUE_FALSE',
      choices: [...validQuestion.choices, { text: 'Peut-être', isCorrect: false }],
    });
    expect(result.success).toBe(false);
  });

  it('refuse un temps hors de 5 à 60 secondes et des points non prévus', () => {
    expect(questionInputSchema.safeParse({ ...validQuestion, timeLimitSec: 4 }).success).toBe(
      false,
    );
    expect(questionInputSchema.safeParse({ ...validQuestion, timeLimitSec: 61 }).success).toBe(
      false,
    );
    expect(questionInputSchema.safeParse({ ...validQuestion, basePoints: 1500 }).success).toBe(
      false,
    );
  });
});

describe('quizInputSchema', () => {
  it('normalise une URL de couverture vide en null', () => {
    const parsed = quizInputSchema.parse({ title: 'Quiz', coverUrl: '' });
    expect(parsed.coverUrl).toBeNull();
  });

  it('refuse un titre vide', () => {
    expect(quizInputSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('images des questions', () => {
  const withImage = (imageUrl: string) =>
    questionInputSchema.safeParse({ ...validQuestion, imageUrl });

  it("accepte une URL absolue ou une image fournie par l'application", () => {
    expect(withImage('https://exemple.fr/photo.jpg').success).toBe(true);
    expect(withImage('/quiz-images/flags/fr.svg').success).toBe(true);
    expect(withImage('/quiz-images/maps/jp.svg').success).toBe(true);
  });

  it('refuse les autres chemins relatifs', () => {
    expect(withImage('/etc/passwd').success).toBe(false);
    expect(withImage('/quiz-images/../secret.svg').success).toBe(false);
    expect(withImage('javascript:alert(1)').success).toBe(false);
  });
});

describe('registerSchema', () => {
  it("normalise l'email en minuscules", () => {
    const parsed = registerSchema.parse({
      email: '  Hote@Exemple.FR ',
      password: 'motdepasse',
      displayName: 'Hôte',
    });
    expect(parsed.email).toBe('hote@exemple.fr');
  });
});

describe('joinGameSchema', () => {
  it('accepte un code à 6 chiffres et un pseudo valide', () => {
    expect(joinGameSchema.safeParse({ code: '123456', nickname: 'Léa_92' }).success).toBe(true);
  });

  it('refuse un code mal formé', () => {
    expect(joinGameSchema.safeParse({ code: '12345', nickname: 'Léa' }).success).toBe(false);
    expect(joinGameSchema.safeParse({ code: 'abcdef', nickname: 'Léa' }).success).toBe(false);
  });

  it('refuse un pseudo trop court ou avec des caractères interdits', () => {
    expect(joinGameSchema.safeParse({ code: '123456', nickname: 'L' }).success).toBe(false);
    expect(joinGameSchema.safeParse({ code: '123456', nickname: '<script>' }).success).toBe(false);
  });
});

describe('answerSchema', () => {
  it('exige une question et un choix', () => {
    expect(answerSchema.safeParse({ questionId: 'q1' }).success).toBe(false);
    expect(answerSchema.safeParse({ questionId: 'q1', choiceId: 'c1' }).success).toBe(true);
  });
});
