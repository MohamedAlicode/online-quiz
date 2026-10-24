import { describe, expect, it, vi } from 'vitest';
import { isSoundEnabled, playSound, setSoundEnabled, subscribeSound } from './sound';

describe('effets sonores', () => {
  it('est activé par défaut et prévient les abonnés quand on le coupe', () => {
    expect(isSoundEnabled()).toBe(true);
    const listener = vi.fn();
    const unsubscribe = subscribeSound(listener);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    setSoundEnabled(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("ne plante pas sans Web Audio (serveur, vieux navigateur) ni avant d'être débloqué", () => {
    expect(() => playSound('fanfare')).not.toThrow();
  });
});
