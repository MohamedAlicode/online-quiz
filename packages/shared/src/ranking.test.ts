import { describe, expect, it } from 'vitest';
import { rankPlayers } from './ranking';

describe('rankPlayers', () => {
  it('trie par score décroissant', () => {
    const ranked = rankPlayers([
      { id: 'a', nickname: 'Alice', score: 500, totalTimeMs: 0 },
      { id: 'b', nickname: 'Bob', score: 1500, totalTimeMs: 0 },
      { id: 'c', nickname: 'Chloé', score: 1000, totalTimeMs: 0 },
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('départage les égalités de score par le temps cumulé', () => {
    const ranked = rankPlayers([
      { id: 'slow', nickname: 'Lent', score: 1000, totalTimeMs: 9000 },
      { id: 'fast', nickname: 'Rapide', score: 1000, totalTimeMs: 2000 },
    ]);
    expect(ranked.map((p) => [p.id, p.rank])).toEqual([
      ['fast', 1],
      ['slow', 2],
    ]);
  });

  it('donne le même rang aux égalités parfaites (1, 2, 2, 4)', () => {
    const ranked = rankPlayers([
      { id: 'a', nickname: 'A', score: 900, totalTimeMs: 100 },
      { id: 'b', nickname: 'B', score: 500, totalTimeMs: 100 },
      { id: 'c', nickname: 'C', score: 500, totalTimeMs: 100 },
      { id: 'd', nickname: 'D', score: 100, totalTimeMs: 100 },
    ]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 2, 4]);
  });

  it('ne modifie pas le tableau reçu', () => {
    const players = [
      { id: 'a', nickname: 'A', score: 1, totalTimeMs: 0 },
      { id: 'b', nickname: 'B', score: 2, totalTimeMs: 0 },
    ];
    rankPlayers(players);
    expect(players[0]?.id).toBe('a');
  });
});
