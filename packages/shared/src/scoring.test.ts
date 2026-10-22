import { describe, expect, it } from 'vitest';
import { computeScore } from './scoring';

const base = { basePoints: 1000, timeLimitMs: 20_000, previousStreak: 0 };

describe('computeScore', () => {
  it('donne 100 % de la base pour une réponse instantanée', () => {
    expect(computeScore({ ...base, timeTakenMs: 0, isCorrect: true }).points).toBe(1000);
  });

  it('donne 50 % de la base pour une réponse au dernier moment', () => {
    expect(computeScore({ ...base, timeTakenMs: 20_000, isCorrect: true }).points).toBe(500);
  });

  it('décroît linéairement avec le temps et arrondit', () => {
    expect(computeScore({ ...base, timeTakenMs: 10_000, isCorrect: true }).points).toBe(750);
    expect(computeScore({ ...base, timeTakenMs: 3_333, isCorrect: true }).points).toBe(917);
  });

  it('borne le temps entre 0 et le temps imparti', () => {
    expect(computeScore({ ...base, timeTakenMs: -500, isCorrect: true }).points).toBe(1000);
    expect(computeScore({ ...base, timeTakenMs: 99_000, isCorrect: true }).points).toBe(500);
  });

  it('applique la base double', () => {
    const result = computeScore({ ...base, basePoints: 2000, timeTakenMs: 0, isCorrect: true });
    expect(result.points).toBe(2000);
  });

  it('ne donne aucun point pour une mauvaise réponse et remet la série à zéro', () => {
    const result = computeScore({ ...base, previousStreak: 4, timeTakenMs: 0, isCorrect: false });
    expect(result).toEqual({ points: 0, speedPoints: 0, streakBonus: 0, streak: 0 });
  });

  it('ajoute +100 par bonne réponse consécutive à partir de la deuxième', () => {
    const first = computeScore({ ...base, timeTakenMs: 0, isCorrect: true });
    expect(first.streak).toBe(1);
    expect(first.streakBonus).toBe(0);

    const second = computeScore({ ...base, previousStreak: 1, timeTakenMs: 0, isCorrect: true });
    expect(second.streak).toBe(2);
    expect(second.streakBonus).toBe(100);
    expect(second.points).toBe(1100);
  });

  it('plafonne le bonus de série à +500', () => {
    const result = computeScore({ ...base, previousStreak: 20, timeTakenMs: 0, isCorrect: true });
    expect(result.streakBonus).toBe(500);
    expect(result.points).toBe(1500);
  });

  it('ne donne aucun point sur une question à 0 point mais conserve la série', () => {
    const result = computeScore({
      ...base,
      basePoints: 0,
      previousStreak: 3,
      timeTakenMs: 0,
      isCorrect: true,
    });
    expect(result).toEqual({ points: 0, speedPoints: 0, streakBonus: 0, streak: 4 });
  });
});
