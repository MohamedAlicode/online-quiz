import { describe, expect, it } from 'vitest';
import { computeScore, rankBySpeed, rankFactor, timeFactor } from './scoring';

const base = { basePoints: 1000, speedFactor: 1, previousStreak: 0 };

describe('rankFactor : points selon l’ordre d’arrivée', () => {
  it('retire 10 % de la base à chaque place', () => {
    expect([1, 2, 3, 4, 5].map(rankFactor)).toEqual([1, 0.9, 0.8, 0.7, 0.6]);
  });

  it('ne descend jamais sous 50 %', () => {
    expect(rankFactor(6)).toBe(0.5);
    expect(rankFactor(40)).toBe(0.5);
  });

  it('traite une place invalide comme la première', () => {
    expect(rankFactor(0)).toBe(1);
  });
});

describe('timeFactor : points selon le temps (entraînement solo)', () => {
  it('vaut 100 % pour une réponse instantanée et 50 % au dernier moment', () => {
    expect(timeFactor(0, 20_000)).toBe(1);
    expect(timeFactor(20_000, 20_000)).toBe(0.5);
    expect(timeFactor(10_000, 20_000)).toBe(0.75);
  });

  it('borne le temps entre 0 et le temps imparti', () => {
    expect(timeFactor(-500, 20_000)).toBe(1);
    expect(timeFactor(99_000, 20_000)).toBe(0.5);
  });
});

describe('rankBySpeed', () => {
  it('classe les bonnes réponses de la plus rapide à la plus lente', () => {
    const ranks = rankBySpeed([
      { id: 'lent', timeTakenMs: 9000 },
      { id: 'rapide', timeTakenMs: 1200 },
      { id: 'moyen', timeTakenMs: 4000 },
    ]);
    expect(Object.fromEntries(ranks)).toEqual({ rapide: 1, moyen: 2, lent: 3 });
  });

  it('donne la même place aux réponses arrivées dans la même milliseconde', () => {
    const ranks = rankBySpeed([
      { id: 'a', timeTakenMs: 1000 },
      { id: 'b', timeTakenMs: 1000 },
      { id: 'c', timeTakenMs: 2000 },
    ]);
    expect(Object.fromEntries(ranks)).toEqual({ a: 1, b: 1, c: 3 });
  });

  it('renvoie une table vide sans bonne réponse', () => {
    expect(rankBySpeed([]).size).toBe(0);
  });
});

describe('computeScore', () => {
  it('applique la part de rapidité à la base et arrondit', () => {
    expect(computeScore({ ...base, isCorrect: true }).points).toBe(1000);
    expect(computeScore({ ...base, speedFactor: rankFactor(2), isCorrect: true }).points).toBe(900);
    expect(
      computeScore({ ...base, speedFactor: timeFactor(3_333, 20_000), isCorrect: true }).points,
    ).toBe(917);
  });

  it('borne la part de rapidité entre 50 % et 100 %', () => {
    expect(computeScore({ ...base, speedFactor: 3, isCorrect: true }).points).toBe(1000);
    expect(computeScore({ ...base, speedFactor: 0, isCorrect: true }).points).toBe(500);
  });

  it('applique la base double', () => {
    const result = computeScore({ ...base, basePoints: 2000, speedFactor: 0.9, isCorrect: true });
    expect(result.points).toBe(1800);
  });

  it('ne donne aucun point pour une mauvaise réponse et remet la série à zéro', () => {
    const result = computeScore({ ...base, previousStreak: 4, isCorrect: false });
    expect(result).toEqual({ points: 0, speedPoints: 0, streakBonus: 0, streak: 0 });
  });

  it('ajoute +100 par bonne réponse consécutive à partir de la deuxième', () => {
    const first = computeScore({ ...base, isCorrect: true });
    expect(first.streak).toBe(1);
    expect(first.streakBonus).toBe(0);

    const second = computeScore({ ...base, previousStreak: 1, isCorrect: true });
    expect(second.streak).toBe(2);
    expect(second.streakBonus).toBe(100);
    expect(second.points).toBe(1100);
  });

  it('plafonne le bonus de série à +500', () => {
    const result = computeScore({ ...base, previousStreak: 20, isCorrect: true });
    expect(result.streakBonus).toBe(500);
    expect(result.points).toBe(1500);
  });

  it('ne donne aucun point sur une question à 0 point mais conserve la série', () => {
    const result = computeScore({ ...base, basePoints: 0, previousStreak: 3, isCorrect: true });
    expect(result).toEqual({ points: 0, speedPoints: 0, streakBonus: 0, streak: 4 });
  });
});
