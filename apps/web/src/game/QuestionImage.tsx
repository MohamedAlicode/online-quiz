const SIZES = {
  /** Écran projeté : l'image est au cœur des quiz drapeaux et capitales. */
  stage: 'max-h-[30vh] min-h-32',
  /** Téléphone du joueur. */
  phone: 'max-h-36',
  /** Rappel à côté du titre (résultats, éditeur). */
  small: 'h-20',
} as const;

interface QuestionImageProps {
  src: string;
  size: keyof typeof SIZES;
  className?: string;
}

/**
 * Image d'une question. Le texte alternatif est volontairement vide : décrire un drapeau
 * ou une carte (« drapeau de la France ») donnerait la réponse aux lecteurs d'écran.
 */
export function QuestionImage({ src, size, className = '' }: QuestionImageProps) {
  return (
    <img
      src={src}
      alt=""
      className={`w-auto max-w-full rounded-2xl object-contain shadow-[0_0_0_4px_rgb(255_255_255/0.18)] ${SIZES[size]} ${className}`}
    />
  );
}
