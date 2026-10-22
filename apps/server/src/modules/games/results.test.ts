import type { GameSummaryDto } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import type { GameSnapshot } from '../../game/snapshot';
import { buildResults, resultsToCsv, type ResultsPlayer } from './results';

const game: GameSummaryDto = {
  id: 'g1',
  quizTitle: 'Quiz',
  code: '111111',
  status: 'FINISHED',
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: '2026-01-01T10:10:00.000Z',
  playerCount: 2,
};

const snapshot: GameSnapshot = {
  quizId: 'quiz',
  title: 'Quiz',
  questions: [
    {
      id: 'q1',
      type: 'SINGLE',
      text: 'Facile',
      imageUrl: null,
      timeLimitSec: 10,
      basePoints: 1000,
      choices: [
        { id: 'a', text: 'Oui', isCorrect: true },
        { id: 'b', text: 'Non', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      type: 'SINGLE',
      text: 'Difficile, "piège"',
      imageUrl: null,
      timeLimitSec: 10,
      basePoints: 1000,
      choices: [
        { id: 'c', text: 'Oui', isCorrect: false },
        { id: 'd', text: 'Non', isCorrect: true },
      ],
    },
    {
      id: 'q3',
      type: 'SINGLE',
      text: 'Jamais jouée',
      imageUrl: null,
      timeLimitSec: 10,
      basePoints: 1000,
      choices: [
        { id: 'e', text: 'Oui', isCorrect: true },
        { id: 'f', text: 'Non', isCorrect: false },
      ],
    },
  ],
};

const players: ResultsPlayer[] = [
  {
    nickname: 'Bob',
    finalScore: 800,
    finalRank: 2,
    answers: [
      { questionId: 'q1', choiceId: 'a', isCorrect: true, timeTakenMs: 4000 },
      { questionId: 'q2', choiceId: null, isCorrect: false, timeTakenMs: 10000 },
    ],
  },
  {
    nickname: '=Alice',
    finalScore: 1900,
    finalRank: 1,
    answers: [
      { questionId: 'q1', choiceId: 'a', isCorrect: true, timeTakenMs: 2000 },
      { questionId: 'q2', choiceId: 'd', isCorrect: true, timeTakenMs: 3000 },
    ],
  },
];

describe('buildResults', () => {
  const results = buildResults(game, snapshot, players);

  it('classe les joueurs par rang final', () => {
    expect(results.ranking.map((row) => [row.rank, row.nickname, row.correctCount])).toEqual([
      [1, '=Alice', 2],
      [2, 'Bob', 1],
    ]);
  });

  it('ne garde que les questions réellement jouées', () => {
    expect(results.questions.map((question) => question.id)).toEqual(['q1', 'q2']);
  });

  it('calcule le taux de réussite, le temps moyen et la répartition', () => {
    const [q1, q2] = results.questions;
    expect(q1).toMatchObject({ successRate: 1, answeredCount: 2, averageTimeMs: 3000 });
    expect(q2).toMatchObject({ successRate: 0.5, answeredCount: 1, averageTimeMs: 3000 });
    expect(q2?.choices.map((choice) => choice.count)).toEqual([0, 1]);
  });

  it('identifie les questions les plus ratées', () => {
    expect(results.hardestQuestionIds[0]).toBe('q2');
  });
});

describe('resultsToCsv', () => {
  const csv = resultsToCsv(buildResults(game, snapshot, players), players);
  const lines = csv.replace('﻿', '').split('\r\n');

  it('produit un en-tête et une ligne par joueur', () => {
    expect(lines[0]).toBe('Rang,Pseudo,Score,Bonnes réponses,Q1,Q2');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('2,Bob,800,1,juste,sans réponse');
  });

  it('neutralise les formules de tableur', () => {
    expect(lines[1]?.startsWith("1,'=Alice,1900")).toBe(true);
  });
});
