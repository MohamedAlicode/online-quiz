import { describe, expect, it } from 'vitest';
import { formatPercent, formatSeconds, plural } from './format';
import { answerStyle, playerColor } from './answers';

describe('formatage', () => {
  it('accorde le pluriel', () => {
    expect(plural(0, 'question')).toBe('0 question');
    expect(plural(1, 'question')).toBe('1 question');
    expect(plural(3, 'question')).toBe('3 questions');
    expect(plural(2, 'bonne réponse', 'bonnes réponses')).toBe('2 bonnes réponses');
  });

  it('affiche un pourcentage arrondi', () => {
    expect(formatPercent(0.666)).toBe('67 %');
  });

  it('affiche un temps de réponse en secondes, à la française', () => {
    expect(formatSeconds(1234)).toBe('1,2 s');
    expect(formatSeconds(0)).toBe('0,0 s');
    expect(formatSeconds(-50)).toBe('0,0 s');
  });
});

describe('style des réponses', () => {
  it('associe une lettre à chaque réponse', () => {
    expect([0, 1, 2, 3].map((index) => answerStyle(index).letter)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('donne toujours la même couleur au même pseudo', () => {
    expect(playerColor('Léa')).toBe(playerColor('Léa'));
  });
});
