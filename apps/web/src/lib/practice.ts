import { computeScore, timeFactor, type PracticeQuestionDto, type QuizDto } from '@quiz/shared';

/**
 * Logique du mode entraînement en solo, sous forme de réducteur pur (testé sans navigateur).
 * - « learn » : sans chrono ni points, pour apprendre à son rythme ;
 * - « challenge » : chrono et points selon le temps mis (`timeFactor`), avec le bonus de série des parties.
 */
export type PracticeMode = 'learn' | 'challenge';
export type PracticeQuestion = PracticeQuestionDto;

export interface PracticeAnswer {
  questionId: string;
  choiceId: string | null;
  isCorrect: boolean;
  points: number;
  timeTakenMs: number;
}

interface Session {
  mode: PracticeMode;
  questions: PracticeQuestion[];
  answers: PracticeAnswer[];
  score: number;
  streak: number;
}

export type PracticeState =
  | { phase: 'intro' }
  | ({ phase: 'countdown'; endsAt: number } & Session)
  | ({ phase: 'question'; index: number; startedAt: number } & Session)
  | ({ phase: 'feedback'; index: number; answer: PracticeAnswer; answeredAt: number } & Session)
  | ({ phase: 'finished' } & Session);

export type PracticeAction =
  | { type: 'start'; mode: PracticeMode; questions: PracticeQuestion[]; now: number }
  | { type: 'begin'; now: number }
  | { type: 'answer'; choiceId: string; now: number }
  | { type: 'timeUp'; now: number }
  | { type: 'next'; now: number }
  | { type: 'reset' };

export const PRACTICE_COUNTDOWN_MS = 3000;

export const initialPracticeState: PracticeState = { phase: 'intro' };

function grade(
  state: Extract<PracticeState, { phase: 'question' }>,
  choiceId: string | null,
  now: number,
): PracticeState {
  const question = state.questions[state.index];
  if (!question) return state;

  const limitMs = question.timeLimitSec * 1000;
  const timeTakenMs = Math.min(Math.max(now - state.startedAt, 0), limitMs);
  const isCorrect = question.choices.some((choice) => choice.id === choiceId && choice.isCorrect);
  // Seul face aux questions : la rapidité se mesure au temps mis, pas à l'ordre d'arrivée.
  const result = computeScore({
    basePoints: state.mode === 'challenge' ? question.basePoints : 0,
    speedFactor: timeFactor(timeTakenMs, limitMs),
    isCorrect,
    previousStreak: state.streak,
  });
  const answer: PracticeAnswer = {
    questionId: question.id,
    choiceId,
    isCorrect,
    points: result.points,
    timeTakenMs,
  };

  return {
    phase: 'feedback',
    mode: state.mode,
    questions: state.questions,
    index: state.index,
    answer,
    answeredAt: now,
    answers: [...state.answers, answer],
    score: state.score + result.points,
    streak: result.streak,
  };
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case 'start':
      if (action.questions.length === 0) return state;
      return {
        phase: 'countdown',
        endsAt: action.now + PRACTICE_COUNTDOWN_MS,
        mode: action.mode,
        questions: action.questions,
        answers: [],
        score: 0,
        streak: 0,
      };

    case 'begin':
      if (state.phase !== 'countdown') return state;
      return { ...state, phase: 'question', index: 0, startedAt: action.now };

    case 'answer':
      if (state.phase !== 'question') return state;
      return grade(state, action.choiceId, action.now);

    case 'timeUp':
      // Pas de chrono en mode apprentissage : on attend la réponse.
      if (state.phase !== 'question' || state.mode === 'learn') return state;
      return grade(state, null, action.now);

    case 'next': {
      if (state.phase !== 'feedback') return state;
      const { mode, questions, answers, score, streak } = state;
      const nextIndex = state.index + 1;
      if (nextIndex >= questions.length) {
        return { phase: 'finished', mode, questions, answers, score, streak };
      }
      return {
        phase: 'question',
        mode,
        questions,
        answers,
        score,
        streak,
        index: nextIndex,
        startedAt: action.now,
      };
    }

    case 'reset':
      return initialPracticeState;
  }
}

/** Questions ratées (ou sans réponse) d'une session terminée, pour les revoir. */
export function missedQuestions(state: Extract<PracticeState, { phase: 'finished' }>) {
  const missed = new Set(
    state.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId),
  );
  return state.questions.filter((question) => missed.has(question.id));
}

/** Convertit un quiz de l'hôte en questions d'entraînement (sans explication). */
export function practiceFromQuiz(quiz: QuizDto): PracticeQuestion[] {
  return quiz.questions.map((question) => ({
    id: question.id,
    text: question.text,
    imageUrl: question.imageUrl,
    timeLimitSec: question.timeLimitSec,
    basePoints: question.basePoints,
    choices: question.choices.map(({ id, text, isCorrect }) => ({ id, text, isCorrect })),
    explanation: null,
  }));
}
