import { useEffect, useState } from 'react';
import { remainingMs } from '../lib/clock';
import { useGameStore } from '../stores/game-store';

/**
 * Temps restant (ms) avant `endsAt`, synchronisé sur l'horloge du serveur
 * et rafraîchi à chaque image. En pause, on affiche la valeur figée envoyée par le serveur.
 */
export function useRemainingMs(endsAt: number, paused = false, pausedRemainingMs = 0): number {
  const offset = useGameStore((state) => state.clockOffset);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, endsAt]);

  return paused ? pausedRemainingMs : remainingMs(endsAt, offset, now);
}
