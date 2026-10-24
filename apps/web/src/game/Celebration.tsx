import { useEffect } from 'react';
import { burst, clearConfetti, goldenBurst, sideCannons } from './celebrate';

/**
 * Confettis au montage : « gold » pour une victoire (explosion dorée et canons sur les côtés),
 * « cheer » pour une belle place (un jet de confettis). Rien si `level` est null.
 */
export function Celebration({ level }: { level: 'gold' | 'cheer' | null }) {
  useEffect(() => {
    if (!level) return;
    let stopCannons: () => void = () => undefined;
    // Léger délai : on laisse l'écran apparaître avant la fête.
    const timer = window.setTimeout(() => {
      if (level === 'gold') {
        goldenBurst({ x: 0.5, y: 0.45 });
        stopCannons = sideCannons(2200);
      } else {
        burst({ x: 0.5, y: 0.5 }, { particleCount: 90, spread: 90 });
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      stopCannons();
      clearConfetti();
    };
  }, [level]);
  return null;
}
