/**
 * Synchronisation d'horloge avec le serveur.
 * Chaque état reçu contient `serverNow` : on en déduit le décalage entre l'horloge du téléphone
 * et celle du serveur, pour afficher un compte à rebours identique sur tous les écrans.
 */
export function computeOffset(serverNow: number, clientNow: number): number {
  return serverNow - clientNow;
}

/** Millisecondes restantes avant `endsAt` (horloge serveur), jamais négatives. */
export function remainingMs(endsAt: number, offset: number, clientNow: number): number {
  return Math.max(0, endsAt - (clientNow + offset));
}

/** Secondes affichées : arrondi supérieur, pour ne jamais montrer « 0 » trop tôt. */
export function displaySeconds(ms: number): number {
  return Math.ceil(ms / 1000);
}
