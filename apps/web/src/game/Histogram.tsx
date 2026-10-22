import type { PublicQuestion } from '@quiz/shared';
import { motion } from 'framer-motion';
import { answerStyle } from '../lib/answers';

interface HistogramProps {
  question: PublicQuestion;
  distribution: Record<string, number>;
  correctChoiceId: string;
}

/** Répartition des réponses : chaque barre se remplit, la bonne réponse reste pleinement visible. */
export function Histogram({ question, distribution, correctChoiceId }: HistogramProps) {
  const max = Math.max(1, ...Object.values(distribution));

  return (
    <figure className="w-full">
      <figcaption className="sr-only">Répartition des réponses</figcaption>
      <div className="flex h-56 items-end justify-center gap-4 sm:h-72 sm:gap-8">
        {question.choices.map((choice, index) => {
          const style = answerStyle(index);
          const count = distribution[choice.id] ?? 0;
          const isCorrect = choice.id === correctChoiceId;
          return (
            <div
              key={choice.id}
              className={`flex h-full w-20 flex-col items-center gap-2 sm:w-28 ${isCorrect ? '' : 'text-white/70'}`}
            >
              <span className="numerals text-4xl font-black">{count}</span>
              <div className="flex w-full flex-1 items-end">
                <motion.div
                  className={`w-full origin-bottom rounded-t-xl ${isCorrect ? style.bar : 'bg-white/25'}`}
                  style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 120,
                    damping: 18,
                    delay: 0.15 + index * 0.08,
                  }}
                />
              </div>
              <span className="flex items-center gap-1 text-xl font-black">
                <span className="numerals">{style.letter}</span>
                {isCorrect ? <span aria-label="bonne réponse">✓</span> : null}
              </span>
              <span className="sr-only">
                {choice.text} : {count} réponse{count > 1 ? 's' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
