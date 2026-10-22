import type { RankedPlayer } from '@quiz/shared';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { playerColor } from '../lib/answers';
import { prefersReducedMotion } from './motion';

/**
 * Classement intermédiaire. On affiche d'abord l'ordre du classement précédent,
 * puis on bascule sur le nouvel ordre : Framer Motion anime automatiquement
 * le déplacement des lignes (layout animation).
 */
export function Leaderboard({
  players,
  highlightId,
}: {
  players: RankedPlayer[];
  highlightId?: string;
}) {
  const hasHistory = players.some((player) => player.previousRank !== null);
  const [showCurrent, setShowCurrent] = useState(!hasHistory || prefersReducedMotion());

  useEffect(() => {
    if (showCurrent) return;
    const timer = window.setTimeout(() => setShowCurrent(true), 700);
    return () => window.clearTimeout(timer);
  }, [showCurrent]);

  const ordered = useMemo(() => {
    if (showCurrent) return players;
    return [...players].sort(
      (a, b) =>
        (a.previousRank ?? Number.MAX_SAFE_INTEGER) - (b.previousRank ?? Number.MAX_SAFE_INTEGER),
    );
  }, [players, showCurrent]);

  return (
    <ol className="flex w-full max-w-2xl flex-col gap-3" aria-label="Classement">
      {ordered.map((player) => {
        const moved = player.previousRank !== null ? player.previousRank - player.rank : 0;
        return (
          <motion.li
            key={player.id}
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
              player.id === highlightId ? 'bg-white text-ink' : 'bg-white/12 text-white'
            }`}
          >
            <span className="numerals w-10 text-3xl font-black">{player.rank}</span>
            <span
              aria-hidden="true"
              className={`size-4 shrink-0 rounded-full ${playerColor(player.nickname)}`}
            />
            <span className="min-w-0 flex-1 truncate text-2xl font-bold">{player.nickname}</span>
            {showCurrent && moved > 0 ? (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold"
                aria-label={`gagne ${moved} place${moved > 1 ? 's' : ''}`}
              >
                ▲ {moved}
              </motion.span>
            ) : null}
            {player.streak >= 2 ? (
              <span className="rounded-full bg-mustard px-2.5 py-0.5 text-sm font-bold text-ink">
                série de {player.streak}
              </span>
            ) : null}
            <span className="numerals text-2xl font-black">{player.score}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
