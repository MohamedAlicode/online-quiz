import type { RankedPlayer } from '@quiz/shared';
import confetti from 'canvas-confetti';
import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from './motion';

const STEPS = [
  { rank: 2, height: 'h-40 sm:h-52', color: 'bg-lagoon' },
  { rank: 1, height: 'h-56 sm:h-72', color: 'bg-mustard' },
  { rank: 3, height: 'h-28 sm:h-36', color: 'bg-tomato' },
] as const;

/**
 * Podium animé avec une timeline GSAP : les marches montent (3e, 2e puis 1re),
 * les noms apparaissent, puis des confettis pour le vainqueur.
 */
export function Podium({ podium }: { podium: RankedPlayer[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ delay: 0.2 });
      for (const rank of [3, 2, 1]) {
        timeline
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
      }
      timeline.call(() => {
        void confetti({
          particleCount: 160,
          spread: 90,
          origin: { y: 0.55 },
          colors: ['#f2542d', '#12a4b4', '#f5b700', '#43a84f', '#ffffff'],
          disableForReducedMotion: true,
        });
      });
    }, root);

    return () => {
      context.revert();
      confetti.reset();
    };
  }, []);

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
