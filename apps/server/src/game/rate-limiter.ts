/**
 * Limiteur de débit à fenêtre glissante, en mémoire.
 * Utilisé sur les événements Socket.IO sensibles (rejoindre une partie, répondre).
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Enregistre une tentative ; retourne `false` si la limite est dépassée. */
  consume(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Supprime les clés inactives pour éviter une fuite mémoire. */
  prune(): void {
    const now = this.now();
    for (const [key, times] of this.hits) {
      if (times.every((time) => now - time >= this.windowMs)) {
        this.hits.delete(key);
      }
    }
  }
}
