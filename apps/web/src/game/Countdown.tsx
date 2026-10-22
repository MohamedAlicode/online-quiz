import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { displaySeconds } from '../lib/clock';
import { prefersReducedMotion } from './motion';
import { useRemainingMs } from './useRemainingMs';

/**
 * Compte à rebours 3, 2, 1 plein écran.
 * Chaque chiffre « s'étire » grâce à l'axe de largeur variable de la police Anybody,
 * piloté par une timeline GSAP (variable CSS --wdth).
 */
export function Countdown({ endsAt, label }: { endsAt: number; label: string }) {
  const ms = useRemainingMs(endsAt);
  const seconds = Math.max(1, displaySeconds(ms));
  const numberRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = numberRef.current;
    if (!element) return;
    if (prefersReducedMotion()) {
      gsap.set(element, { opacity: 1, scale: 1, '--wdth': 100 });
      return;
    }
    const timeline = gsap
      .timeline()
      .fromTo(
        element,
        { scale: 0.35, opacity: 0, '--wdth': 50 },
        { scale: 1, opacity: 1, '--wdth': 150, duration: 0.5, ease: 'back.out(2.2)' },
      )
      .to(
        element,
        { scale: 0.85, opacity: 0, '--wdth': 70, duration: 0.3, ease: 'power2.in' },
        0.65,
      );
    return () => {
      timeline.kill();
    };
  }, [seconds]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-xl font-bold text-white/85 sm:text-2xl">{label}</p>
      <span
        ref={numberRef}
        aria-live="assertive"
        className="numerals block text-[clamp(10rem,40vw,22rem)] leading-none font-black"
      >
        {seconds}
      </span>
    </div>
  );
}
