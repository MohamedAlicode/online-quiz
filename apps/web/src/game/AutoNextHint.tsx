import { displaySeconds } from '../lib/clock';
import { useRemainingMs } from './useRemainingMs';

/** « Question suivante dans 4 s » : décompte de l'enchaînement automatique. */
export function AutoNextHint({ at, label }: { at: number; label: string }) {
  const seconds = Math.max(1, displaySeconds(useRemainingMs(at)));
  return (
    <p className="text-lg font-bold" role="status">
      {label} dans{' '}
      <span className="numerals inline-block w-[1.5ch] text-center text-2xl font-black">
        {seconds}
      </span>{' '}
      s
    </p>
  );
}
