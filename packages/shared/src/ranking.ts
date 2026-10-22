export interface RankablePlayer {
  id: string;
  nickname: string;
  score: number;
  /** Temps de réponse cumulé sur les bonnes réponses : départage les égalités. */
  totalTimeMs: number;
}

export type Ranked<T extends RankablePlayer> = T & { rank: number };

/**
 * Trie les joueurs et leur attribue un rang.
 * Ordre : score décroissant, puis temps cumulé croissant (le plus rapide passe devant),
 * puis pseudo pour un affichage stable. Deux joueurs à égalité parfaite partagent le même
 * rang (classement « 1, 2, 2, 4 »).
 */
export function rankPlayers<T extends RankablePlayer>(players: readonly T[]): Ranked<T>[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score ||
      a.totalTimeMs - b.totalTimeMs ||
      a.nickname.localeCompare(b.nickname, 'fr'),
  );

  const ranked: Ranked<T>[] = [];
  sorted.forEach((player, index) => {
    const previous = ranked[index - 1];
    const tied =
      previous !== undefined &&
      previous.score === player.score &&
      previous.totalTimeMs === player.totalTimeMs;
    ranked.push({ ...player, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}
