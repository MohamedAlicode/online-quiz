/**
 * Accès défensif au localStorage : il peut être indisponible (navigation privée,
 * stockage bloqué). L'application doit continuer à fonctionner sans lui.
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : on garde simplement l'état en mémoire.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}
