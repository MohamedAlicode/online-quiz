import type { FastestAnswer } from '@quiz/shared';
import { motion } from 'framer-motion';
import { formatSeconds } from '../lib/format';

/** Mêmes couleurs que les marches du podium : or, bleu lagon, rouge tomate. */
const MEDALS = ['bg-mustard', 'bg-lagoon', 'bg-tomato'] as const;

/**
 * Les trois bonnes réponses les plus rapides : les points dépendent de l'ordre d'arrivée,
 * l'écran projeté montre donc qui a été le plus vif.
 */
export function FastestList({ fastest }: { fastest: FastestAnswer[] }) {
  return (
    <section aria-labelledby="fastest-title" className="flex w-full flex-col gap-3 lg:w-80">
      <h2 id="fastest-title" className="text-xl font-bold text-white/85">
        Les plus rapides
      </h2>
      {fastest.length === 0 ? (
        <p className="text-lg text-white/85">Personne n’a trouvé cette fois.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {fastest.map((entry, index) => (
            <motion.li
              key={entry.playerId}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 22,
                delay: 0.4 + index * 0.15,
              }}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5"
            >
              <span
                className={`numerals flex size-10 shrink-0 items-center justify-center rounded-full text-xl font-black text-ink ${MEDALS[index] ?? 'bg-white'}`}
                aria-label={`${entry.speedRank}e plus rapide`}
              >
                {entry.speedRank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-bold">{entry.nickname}</span>
                <span className="text-sm text-white/80">{formatSeconds(entry.timeTakenMs)}</span>
              </span>
              <span className="numerals text-xl font-black">+{entry.points}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}
