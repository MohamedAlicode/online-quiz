import { SCORING } from './constants';

export interface ScoreInput {
  /** Points de base de la question (1000, 2000 ou 0). */
  basePoints: number;
  /**
   * Part de la base gagnée par une bonne réponse, entre 0,5 et 1.
   * En partie : `rankFactor(place)` ; en entraînement solo : `timeFactor(temps, limite)`.
   */
  speedFactor: number;
  /** La réponse est-elle correcte ? `false` aussi en cas d'absence de réponse. */
  isCorrect: boolean;
  /** Nombre de bonnes réponses consécutives AVANT cette question. */
  previousStreak: number;
}

export interface ScoreResult {
  /** Points gagnés sur cette question (rapidité + bonus de série). */
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
 * Part de la base selon la place dans l'ordre d'arrivée des bonnes réponses :
 * 1er 100 %, 2e 90 %, 3e 80 %… et jamais moins de 50 %.
 */
export function rankFactor(rank: number): number {
  const factor = 1 - (Math.max(1, Math.floor(rank)) - 1) * SCORING.rankStep;
  // Arrondi au millième pour éviter les flottants du type 0.7000000000000001.
  return Math.max(SCORING.minSpeedFactor, Math.round(factor * 1000) / 1000);
}

/**
 * Part de la base selon le temps mis (entraînement solo, sans adversaire) :
 * 100 % pour une réponse instantanée, 50 % au dernier moment, linéaire entre les deux.
 */
export function timeFactor(timeTakenMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return SCORING.minSpeedFactor;
  const ratio = clamp(timeTakenMs / timeLimitMs, 0, 1);
  return 1 - ratio * (1 - SCORING.minSpeedFactor);
}

/**
 * Classe les bonnes réponses par rapidité : 1 pour la plus rapide.
 * Deux réponses arrivées dans la même milliseconde partagent la place (1, 1, 3…).
 */
export function rankBySpeed(answers: { id: string; timeTakenMs: number }[]): Map<string, number> {
  const sorted = [...answers].sort((a, b) => a.timeTakenMs - b.timeTakenMs);
  const ranks = new Map<string, number>();
  sorted.forEach((answer, index) => {
    const previous = sorted[index - 1];
    const tied = previous !== undefined && previous.timeTakenMs === answer.timeTakenMs;
    ranks.set(answer.id, tied ? (ranks.get(previous.id) ?? index + 1) : index + 1);
  });
  return ranks;
}

/**
 * Calcule les points gagnés sur une question.
 *
 * - Bonne réponse : `base × part de rapidité`, arrondi (voir `rankFactor` et `timeFactor`).
 * - Série : +100 par bonne réponse consécutive à partir de la deuxième, plafonné à +500.
 * - Mauvaise réponse ou absence de réponse : 0 point et la série repart de zéro.
 * - Question à 0 point de base : aucun point, bonus compris, mais la série continue.
 *
 * Fonction pure : aucune dépendance à l'horloge ni à l'état global, donc facile à tester.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const { basePoints, speedFactor, isCorrect, previousStreak } = input;

  if (!isCorrect) {
    return { points: 0, speedPoints: 0, streakBonus: 0, streak: 0 };
  }

  const streak = Math.max(0, previousStreak) + 1;
  if (basePoints <= 0) {
    return { points: 0, speedPoints: 0, streakBonus: 0, streak };
  }

  const factor = clamp(speedFactor, SCORING.minSpeedFactor, 1);
  const speedPoints = Math.round(basePoints * factor);
  const streakBonus = Math.min((streak - 1) * SCORING.streakBonusStep, SCORING.streakBonusMax);

  return { points: speedPoints + streakBonus, speedPoints, streakBonus, streak };
}
