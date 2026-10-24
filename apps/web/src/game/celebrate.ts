import confetti from 'canvas-confetti';
import { prefersReducedMotion } from './motion';

/** Couleurs de l'interface : rouge tomate, bleu lagon, moutarde, vert prairie, blanc. */
export const CONFETTI_COLORS = ['#f2542d', '#12a4b4', '#f5b700', '#43a84f', '#ffffff'];
const GOLD = ['#f5b700', '#ffd84d', '#ffffff'];

// canvas-confetti ne lance rien si l'utilisateur a demandé à réduire les animations.
const defaults = { colors: CONFETTI_COLORS, disableForReducedMotion: true };

/** Position d'un élément en coordonnées relatives à la fenêtre (0 à 1), pour viser un confetti. */
export function originOf(element: Element | null, fallback = { x: 0.5, y: 0.6 }) {
  if (!element) return fallback;
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: rect.top / window.innerHeight,
  };
}

/** Jet de confettis depuis un point de l'écran. */
export function burst(
  origin: { x: number; y: number },
  options: { colors?: string[]; particleCount?: number; spread?: number } = {},
): void {
  void confetti({
    ...defaults,
    particleCount: 60,
    spread: 70,
    startVelocity: 40,
    ticks: 220,
    origin,
    ...options,
  });
}

/** Explosion dorée avec des étoiles, pour la 1re place. */
export function goldenBurst(origin: { x: number; y: number }): void {
  const shared = { ...defaults, colors: GOLD, origin, ticks: 260, startVelocity: 48 };
  void confetti({ ...shared, particleCount: 120, spread: 100, scalar: 1.1 });
  void confetti({ ...shared, particleCount: 40, spread: 120, shapes: ['star'], scalar: 1.6 });
}

/** Deux canons sur les bords de l'écran pendant `durationMs`. Renvoie de quoi les arrêter. */
export function sideCannons(durationMs: number): () => void {
  if (prefersReducedMotion()) return () => undefined;
  const end = Date.now() + durationMs;
  let frame = 0;
  const shoot = () => {
    const shared = { ...defaults, particleCount: 3, spread: 55, startVelocity: 62, ticks: 240 };
    void confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.8 } });
    void confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.8 } });
    if (Date.now() < end) frame = requestAnimationFrame(shoot);
  };
  frame = requestAnimationFrame(shoot);
  return () => cancelAnimationFrame(frame);
}

/** Pluie de confettis tombant du haut de l'écran. */
export function confettiRain(): void {
  void confetti({
    ...defaults,
    particleCount: 180,
    spread: 180,
    startVelocity: 25,
    gravity: 0.7,
    ticks: 400,
    origin: { x: 0.5, y: -0.1 },
  });
}

/** Efface tous les confettis en cours (en quittant l'écran). */
export function clearConfetti(): void {
  confetti.reset();
}
