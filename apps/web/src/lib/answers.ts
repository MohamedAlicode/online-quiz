/**
 * Apparence des réponses. Chaque réponse a une lettre ET une couleur :
 * l'information ne repose jamais sur la couleur seule (daltonisme, projecteur délavé).
 */
export const ANSWER_STYLES = [
  { letter: 'A', bg: 'bg-tomato', bar: 'bg-tomato', ring: 'ring-tomato' },
  { letter: 'B', bg: 'bg-lagoon', bar: 'bg-lagoon', ring: 'ring-lagoon' },
  { letter: 'C', bg: 'bg-mustard', bar: 'bg-mustard', ring: 'ring-mustard' },
  { letter: 'D', bg: 'bg-meadow', bar: 'bg-meadow', ring: 'ring-meadow' },
] as const;

export function answerStyle(index: number) {
  return ANSWER_STYLES[index % ANSWER_STYLES.length]!;
}

/** Couleur de pastille stable pour un joueur (même pseudo → même couleur). */
export function playerColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return answerStyle(hash).bg;
}
