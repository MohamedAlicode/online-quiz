import { SCORING } from './constants';

export interface ScoreInput {
  /** Points de base de la question (1000, 2000 ou 0). */
  basePoints: number;
  /** Temps imparti pour la question, en millisecondes. */
  timeLimitMs: number;
  /** Temps mis par le joueur pour répondre, en millisecondes. */
  timeTakenMs: number;
  /** La réponse est-elle correcte ? `false` aussi en cas d'absence de réponse. */
  isCorrect: boolean;
  /** Nombre de bonnes réponses consécutives AVANT cette question. */
  previousStreak: number;
}

export interface ScoreResult {
  /** Points gagnés sur cette question (vitesse + bonus de série). */
  points: number;
  /** Part des points liée à la rapidité. */
  speedPoints: number;
  /** Part des points liée à la série. */
  streakBonus: number;
  /** Nouvelle série après cette question. */
  streak: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Calcule les points gagnés sur une question.
 *
 * - Bonne réponse : `base * (1 - (tempsMis / tempsImparti) / 2)`, arrondi.
 *   Une réponse instantanée vaut 100 % de la base, une réponse au dernier moment 50 %.
 * - Série : +100 par bonne réponse consécutive à partir de la deuxième, plafonné à +500.
 * - Mauvaise réponse ou absence de réponse : 0 point et la série repart de zéro.
 * - Question à 0 point de base : aucun point, bonus compris, mais la série continue.
 *
 * Fonction pure : aucune dépendance à l'horloge ni à l'état global, donc facile à tester.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const { basePoints, timeLimitMs, timeTakenMs, isCorrect, previousStreak } = input;

  if (!isCorrect) {
    return { points: 0, speedPoints: 0, streakBonus: 0, streak: 0 };
  }

  const streak = Math.max(0, previousStreak) + 1;
  if (basePoints <= 0 || timeLimitMs <= 0) {
    return { points: 0, speedPoints: 0, streakBonus: 0, streak };
  }

  const ratio = clamp(timeTakenMs / timeLimitMs, 0, 1);
  const speedPoints = Math.round(basePoints * (1 - ratio / 2));
  const streakBonus = Math.min((streak - 1) * SCORING.streakBonusStep, SCORING.streakBonusMax);

  return { points: speedPoints + streakBonus, speedPoints, streakBonus, streak };
}
