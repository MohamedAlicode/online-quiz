import { motion } from 'framer-motion';
import { answerStyle } from '../lib/answers';

export type TileState = 'idle' | 'selected' | 'dimmed' | 'correct' | 'wrong';

interface AnswerTileProps {
  index: number;
  text: string;
  state?: TileState;
  /** Si fourni, la tuile est un bouton (écran joueur). */
  onSelect?: () => void;
  disabled?: boolean;
  size?: 'stage' | 'phone';
}

const STATE_CLASSES: Record<TileState, string> = {
  idle: '',
  selected: 'ring-4 ring-white ring-offset-4 ring-offset-stage',
  // Les réponses écartées passent en neutre (une couleur translucide sur l'indigo serait boueuse).
  dimmed: '',
  correct: 'ring-4 ring-white ring-offset-4 ring-offset-stage',
  wrong: '',
};

const isMuted = (state: TileState) => state === 'dimmed' || state === 'wrong';

/** Tuile de réponse : lettre + texte + couleur, jamais la couleur seule. */
export function AnswerTile({
  index,
  text,
  state = 'idle',
  onSelect,
  disabled,
  size = 'stage',
}: AnswerTileProps) {
  const style = answerStyle(index);
  const textSize = size === 'stage' ? 'text-2xl lg:text-3xl' : 'text-2xl';
  const muted = isMuted(state);
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`numerals flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-black ${
          muted ? `${style.bg} text-ink` : 'bg-ink/15'
        }`}
      >
        {style.letter}
      </span>
      <span className={`text-left font-bold ${textSize}`}>{text}</span>
      {state === 'correct' ? (
        <span aria-label="Bonne réponse" className="ml-auto text-3xl font-black">
          ✓
        </span>
      ) : null}
    </>
  );
  const colors = muted ? 'bg-white/10 text-white/80' : `${style.bg} text-ink`;
  const base = `flex w-full items-center gap-4 rounded-[var(--radius-tile)] p-4 sm:p-5 ${colors} ${STATE_CLASSES[state]}`;

  if (!onSelect) {
    return (
      <motion.div
        layout
        animate={state === 'correct' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
        className={`${base} min-h-24 lg:min-h-32`}
      >
        <span className="sr-only">Réponse {style.letter} : </span>
        {content}
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      aria-label={`Réponse ${style.letter} : ${text}`}
      aria-pressed={state === 'selected'}
      className={`${base} min-h-28 disabled:cursor-default`}
    >
      {content}
    </motion.button>
  );
}
