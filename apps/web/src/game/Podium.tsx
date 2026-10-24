import type { RankedPlayer } from '@quiz/shared';
import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { playSound } from '../lib/sound';
import {
  burst,
  clearConfetti,
  confettiRain,
  goldenBurst,
  originOf,
  sideCannons,
} from './celebrate';
import { prefersReducedMotion } from './motion';
import { useSoundCue } from './useSound';

const STEPS = [
  { rank: 2, height: 'h-40 sm:h-52', color: 'bg-lagoon' },
  { rank: 1, height: 'h-56 sm:h-72', color: 'bg-mustard' },
  { rank: 3, height: 'h-28 sm:h-36', color: 'bg-tomato' },
] as const;

// Note jouée à chaque marche : do (3e), mi (2e), sol (1re).
const STEP_PITCH: Record<number, number> = { 3: 1, 2: 1.26, 1: 1.5 };
// Confettis aux couleurs de la marche qui vient de monter.
const STEP_COLORS: Record<number, string[]> = {
  3: ['#f2542d', '#ff8a65', '#ffffff'],
  2: ['#12a4b4', '#5fd3df', '#ffffff'],
};

/**
 * Podium animé avec une timeline GSAP : les marches montent (3e, 2e puis 1re) avec une note
 * et un jet de confettis chacune, puis la fête pour le vainqueur : explosion dorée, fanfare,
 * canons de confettis sur les côtés et pluie finale.
 */
export function Podium({ podium, sound = false }: { podium: RankedPlayer[]; sound?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Sans animation (réglage système), la fanfare part tout de suite et sans confettis.
  useSoundCue('fanfare', 'podium', sound && prefersReducedMotion());
  // Valeur simple (et non le tableau) pour ne pas relancer l'animation à chaque diffusion d'état.
  const filledRanks = podium.map((entry) => entry.rank).join(',');

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return;

    let stopCannons: () => void = () => undefined;
    const stepOf = (rank: number) => root.querySelector(`[data-step="${rank}"]`);
    const hasPlayer = (rank: number) => filledRanks.split(',').includes(String(rank));

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ delay: 0.2 });
      for (const rank of [3, 2, 1]) {
        timeline
          .call(() => {
            if (sound) playSound('step', STEP_PITCH[rank]);
          })
          .from(`[data-step="${rank}"]`, {
            scaleY: 0,
            transformOrigin: 'bottom',
            duration: 0.7,
            ease: 'power3.out',
          })
          .fromTo(
            `[data-name="${rank}"]`,
            { y: 24, opacity: 0, '--wdth': 50 },
            { y: 0, opacity: 1, '--wdth': 100, duration: 0.5, ease: 'back.out(2)' },
            '-=0.15',
          );
        if (rank !== 1) {
          timeline.call(
            () => {
              if (hasPlayer(rank)) burst(originOf(stepOf(rank)), { colors: STEP_COLORS[rank] });
            },
            undefined,
            '-=0.35',
          );
        }
      }
      timeline
        .call(() => {
          if (sound) playSound('fanfare');
          goldenBurst(originOf(stepOf(1)));
          stopCannons = sideCannons(2800);
        })
        // Le nom du vainqueur bat comme un cœur pendant la fanfare.
        .to('[data-name="1"]', {
          scale: 1.12,
          duration: 0.3,
          repeat: 5,
          yoyo: true,
          ease: 'sine.inOut',
        })
        .call(confettiRain, undefined, '-=1.2');
    }, root);

    return () => {
      stopCannons();
      context.revert();
      clearConfetti();
    };
  }, [filledRanks, sound]);

  return (
    <div ref={rootRef} className="flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-5">
      {STEPS.map((step) => {
        const player = podium.find((entry) => entry.rank === step.rank);
        return (
          <div key={step.rank} className="flex flex-1 flex-col items-center gap-3">
            <div
              data-name={step.rank}
              style={{ ['--wdth' as string]: 100 }}
              className="flex min-h-20 flex-col items-center justify-end text-center"
            >
              {player ? (
                <>
                  <span className="max-w-full truncate text-xl font-bold sm:text-3xl">
                    {player.nickname}
                  </span>
                  <span className="numerals text-lg font-black text-white/85 sm:text-2xl">
                    {player.score} pts
                  </span>
                </>
              ) : null}
            </div>
            <div
              data-step={step.rank}
              className={`flex w-full items-start justify-center rounded-t-2xl pt-4 text-ink ${step.height} ${step.color}`}
            >
              <span
                className="numerals text-5xl font-black sm:text-7xl"
                aria-label={`${step.rank}e place`}
              >
                {step.rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
