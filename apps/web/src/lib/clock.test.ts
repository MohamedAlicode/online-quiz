import { describe, expect, it } from 'vitest';
import { computeOffset, displaySeconds, remainingMs } from './clock';

describe('synchronisation d’horloge', () => {
  it('calcule le décalage entre serveur et client', () => {
    expect(computeOffset(10_500, 10_000)).toBe(500);
    expect(computeOffset(9_000, 10_000)).toBe(-1000);
  });

  it('corrige le temps restant avec le décalage', () => {
    // Le téléphone retarde de 2 s : il reste 3 s côté serveur, pas 5.
    expect(remainingMs(20_000, 2_000, 15_000)).toBe(3_000);
  });

  it('ne renvoie jamais un temps négatif', () => {
    expect(remainingMs(1_000, 0, 5_000)).toBe(0);
  });

  it('arrondit les secondes affichées vers le haut', () => {
    expect(displaySeconds(4_001)).toBe(5);
    expect(displaySeconds(4_000)).toBe(4);
    expect(displaySeconds(0)).toBe(0);
  });
});
