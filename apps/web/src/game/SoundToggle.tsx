import { useSoundEnabled } from './useSound';

/** Bouton pour couper ou remettre le son (écran projeté, entraînement solo). */
export function SoundToggle({ className = '' }: { className?: string }) {
  const [enabled, setEnabled] = useSoundEnabled();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => setEnabled(!enabled)}
      title={enabled ? 'Couper le son' : 'Activer le son'}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-white hover:bg-white/10 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
        {enabled ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
      Son
    </button>
  );
}
