import type { LobbyPlayer } from '@quiz/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { answerStyle } from '../lib/answers';

interface LobbyPlayersProps {
  players: LobbyPlayer[];
  onKick?: (player: LobbyPlayer) => void;
}

/** Les joueurs « tombent » dans le lobby comme des gommettes qu'on colle. */
export function LobbyPlayers({ players, onKick }: LobbyPlayersProps) {
  return (
    <ul className="flex flex-wrap gap-3" aria-label="Joueurs connectés" aria-live="polite">
      <AnimatePresence>
        {players.map((player, index) => (
          <motion.li
            key={player.id}
            layout
            initial={{ scale: 0, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: player.connected ? 1 : 0.45 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            {onKick ? (
              <button
                type="button"
                onClick={() => onKick(player)}
                title="Exclure ce joueur"
                aria-label={`Exclure ${player.nickname}`}
                className={`rounded-full px-5 py-2.5 text-xl font-bold text-ink decoration-2 hover:line-through ${answerStyle(index).bg}`}
              >
                {player.nickname}
              </button>
            ) : (
              <span
                className={`inline-block rounded-full px-5 py-2.5 text-xl font-bold text-ink ${answerStyle(index).bg}`}
              >
                {player.nickname}
              </span>
            )}
            {!player.connected ? <span className="sr-only"> (déconnecté)</span> : null}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
