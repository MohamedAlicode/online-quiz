import { displaySeconds } from '../lib/clock';
import { useState } from 'react';
import { useSoundCue } from './useSound';
import { useRemainingMs } from './useRemainingMs';

interface TimerBarProps {
  endsAt: number;
  totalMs: number;
  paused: boolean;
  pausedRemainingMs: number;
  /** Affiche aussi les secondes restantes en grands chiffres (écran de l'hôte). */
  showSeconds?: boolean;
  /** « Top » au départ puis tic-tac pendant les 5 dernières secondes (écran projeté, solo). */
  sound?: boolean;
}

/** Barre de temps fluide qui vire au jaune puis au rouge à l'approche de la fin. */
export function TimerBar({
  endsAt,
  totalMs,
  paused,
  pausedRemainingMs,
  showSeconds,
  sound = false,
}: TimerBarProps) {
  const ms = useRemainingMs(endsAt, paused, pausedRemainingMs);
  // « Top » seulement si la question vient de commencer (pas après une reconnexion).
  const [justStarted] = useState(() => ms >= totalMs - 1500);
  useSoundCue('go', 'start', sound && justStarted);
  const ratio = totalMs > 0 ? Math.min(1, ms / totalMs) : 0;
  const color = ratio > 0.4 ? 'bg-white' : ratio > 0.15 ? 'bg-mustard' : 'bg-tomato';
  const seconds = displaySeconds(ms);
  const ticking = sound && !paused && seconds >= 1 && seconds <= 5;
  useSoundCue(ticking ? (seconds <= 3 ? 'tickUrgent' : 'tick') : null, seconds);

  return (
    <div className="flex items-center gap-4">
      <div
        role="progressbar"
        aria-label="Temps restant"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={seconds}
        aria-valuetext={paused ? 'En pause' : `${seconds} secondes`}
        className="h-3 flex-1 overflow-hidden rounded-full bg-white/20"
      >
        <div
          className={`h-full origin-left rounded-full transition-colors duration-300 ${color}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {showSeconds ? (
        <span
          aria-hidden="true"
          className="numerals w-[2.5ch] text-right text-5xl font-black"
          // Les dernières secondes se compriment pour créer de la tension.
          style={{ ['--wdth' as string]: seconds <= 5 ? 60 : 110 }}
        >
          {seconds}
        </span>
      ) : null}
    </div>
  );
}
