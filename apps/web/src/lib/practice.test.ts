import { describe, expect, it } from 'vitest';
import {
  initialPracticeState,
  missedQuestions,
  practiceFromQuiz,
  practiceReducer,
  type PracticeQuestion,
  type PracticeState,
} from './practice';

const question = (id: string, basePoints = 1000): PracticeQuestion => ({
  id,
  text: `Question ${id}`,
  imageUrl: null,
  timeLimitSec: 10,
  basePoints,
  choices: [
    { id: `${id}-ok`, text: 'Juste', isCorrect: true },
    { id: `${id}-ko`, text: 'Faux', isCorrect: false },
  ],
  explanation: null,
});

const questions = [question('a'), question('b'), question('c', 2000)];

function startAndBegin(mode: 'learn' | 'challenge') {
  let state = practiceReducer(initialPracticeState, { type: 'start', mode, questions, now: 0 });
  state = practiceReducer(state, { type: 'begin', now: 3000 });
  return state;
}

describe('mode entraînement', () => {
  it('démarre par un compte à rebours puis affiche la première question', () => {
    const counting = practiceReducer(initialPracticeState, {
      type: 'start',
      mode: 'challenge',
      questions,
      now: 1000,
    });
    expect(counting).toMatchObject({ phase: 'countdown', endsAt: 4000 });
    expect(practiceReducer(counting, { type: 'begin', now: 4000 })).toMatchObject({
      phase: 'question',
      index: 0,
      startedAt: 4000,
    });
  });

  it('note la réponse selon le temps mis en mode défi', () => {
    let state = startAndBegin('challenge');
    // Réponse juste en 2 s sur 10 : 1000 × (1 − 0,2 / 2) = 900 points.
    state = practiceReducer(state, { type: 'answer', choiceId: 'a-ok', now: 5000 });
    expect(state).toMatchObject({ phase: 'feedback', score: 900, streak: 1, answeredAt: 5000 });
    expect(state.phase === 'feedback' && state.answer).toMatchObject({
      isCorrect: true,
      points: 900,
      timeTakenMs: 2000,
    });
  });

  it('ne compte ni chrono ni points en mode apprentissage', () => {
    let state = startAndBegin('learn');
    state = practiceReducer(state, { type: 'timeUp', now: 60_000 });
    expect(state.phase).toBe('question');
    state = practiceReducer(state, { type: 'answer', choiceId: 'a-ok', now: 60_000 });
    expect(state).toMatchObject({ phase: 'feedback', score: 0 });
    expect(state.phase === 'feedback' && state.answer.isCorrect).toBe(true);
  });

  it('compte une absence de réponse quand le temps est écoulé en mode défi', () => {
    let state = startAndBegin('challenge');
    state = practiceReducer(state, { type: 'timeUp', now: 13_000 });
    expect(state.phase === 'feedback' && state.answer).toMatchObject({
      choiceId: null,
      isCorrect: false,
      points: 0,
    });
  });

  it('enchaîne les questions puis affiche le bilan', () => {
    let state: PracticeState = startAndBegin('challenge');
    state = practiceReducer(state, { type: 'answer', choiceId: 'a-ok', now: 3000 });
    state = practiceReducer(state, { type: 'next', now: 4000 });
    expect(state).toMatchObject({ phase: 'question', index: 1, startedAt: 4000 });

    state = practiceReducer(state, { type: 'answer', choiceId: 'b-ko', now: 4000 });
    state = practiceReducer(state, { type: 'next', now: 5000 });
    // Série remise à zéro par la mauvaise réponse ; dernière question à points doubles.
    state = practiceReducer(state, { type: 'answer', choiceId: 'c-ok', now: 5000 });
    state = practiceReducer(state, { type: 'next', now: 6000 });

    expect(state.phase).toBe('finished');
    if (state.phase === 'finished') {
      expect(state.answers.map((answer) => answer.isCorrect)).toEqual([true, false, true]);
      expect(state.score).toBe(1000 + 0 + 2000);
      expect(missedQuestions(state).map((q) => q.id)).toEqual(['b']);
    }
  });

  it('ignore les actions hors de propos (double réponse, suivant pendant une question)', () => {
    let state = startAndBegin('challenge');
    expect(practiceReducer(state, { type: 'next', now: 0 })).toBe(state);
    state = practiceReducer(state, { type: 'answer', choiceId: 'a-ok', now: 3000 });
    expect(practiceReducer(state, { type: 'answer', choiceId: 'a-ko', now: 3000 })).toBe(state);
  });

  it('refuse de démarrer sans question', () => {
    expect(
      practiceReducer(initialPracticeState, {
        type: 'start',
        mode: 'learn',
        questions: [],
        now: 0,
      }),
    ).toBe(initialPracticeState);
  });

  it("convertit un quiz de l'hôte en questions d'entraînement", () => {
    const converted = practiceFromQuiz({
      id: 'quiz',
      title: 'Quiz',
      description: '',
      coverUrl: null,
      isPublic: false,
      questionCount: 1,
      createdAt: '',
      updatedAt: '',
      questions: [
        {
          id: 'q1',
          quizId: 'quiz',
          type: 'SINGLE',
          text: 'Combien ?',
          imageUrl: null,
          timeLimitSec: 20,
          basePoints: 1000,
          position: 0,
          choices: [{ id: 'c1', text: '8', isCorrect: true, position: 0 }],
        },
      ],
    });
    expect(converted[0]).toEqual({
      id: 'q1',
      text: 'Combien ?',
      imageUrl: null,
      timeLimitSec: 20,
      basePoints: 1000,
      choices: [{ id: 'c1', text: '8', isCorrect: true }],
      explanation: null,
    });
  });
});
