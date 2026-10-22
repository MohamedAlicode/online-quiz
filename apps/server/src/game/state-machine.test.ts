import { describe, expect, it } from 'vitest';
import { canTransition, InvalidTransitionError, transition } from './state-machine';

describe('machine à états de la partie', () => {
  it('suit le déroulé complet d’une partie à deux questions', () => {
    let status = transition('LOBBY', { type: 'START' });
    expect(status).toBe('COUNTDOWN');

    status = transition(status, { type: 'COUNTDOWN_ELAPSED' });
    expect(status).toBe('QUESTION');
    status = transition(status, { type: 'QUESTION_ENDED' });
    expect(status).toBe('RESULTS');
    status = transition(status, { type: 'NEXT', hasMoreQuestions: true });
    expect(status).toBe('LEADERBOARD');
    status = transition(status, { type: 'NEXT', hasMoreQuestions: true });
    expect(status).toBe('COUNTDOWN');

    status = transition(status, { type: 'COUNTDOWN_ELAPSED' });
    status = transition(status, { type: 'QUESTION_ENDED' });
    status = transition(status, { type: 'NEXT', hasMoreQuestions: false });
    expect(status).toBe('LEADERBOARD');
    status = transition(status, { type: 'NEXT', hasMoreQuestions: false });
    expect(status).toBe('PODIUM');
    status = transition(status, { type: 'NEXT', hasMoreQuestions: false });
    expect(status).toBe('FINISHED');
  });

  it('annule la partie si elle est terminée depuis le lobby', () => {
    expect(transition('LOBBY', { type: 'END' })).toBe('FINISHED');
  });

  it('saute au podium si elle est terminée en cours de jeu', () => {
    for (const status of ['COUNTDOWN', 'QUESTION', 'RESULTS', 'LEADERBOARD'] as const) {
      expect(transition(status, { type: 'END' })).toBe('PODIUM');
    }
    expect(transition('PODIUM', { type: 'END' })).toBe('FINISHED');
  });

  it('refuse les transitions incohérentes', () => {
    expect(() => transition('LOBBY', { type: 'QUESTION_ENDED' })).toThrow(InvalidTransitionError);
    expect(() => transition('QUESTION', { type: 'START' })).toThrow(InvalidTransitionError);
    expect(() => transition('COUNTDOWN', { type: 'NEXT', hasMoreQuestions: true })).toThrow();
    expect(() => transition('FINISHED', { type: 'END' })).toThrow();
  });

  it('expose canTransition sans lever d’exception', () => {
    expect(canTransition('LOBBY', { type: 'START' })).toBe(true);
    expect(canTransition('RESULTS', { type: 'START' })).toBe(false);
  });
});
