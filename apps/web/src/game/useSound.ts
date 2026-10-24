import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  isSoundEnabled,
  playSound,
  setSoundEnabled,
  subscribeSound,
  type SoundName,
} from '../lib/sound';

/** Réglage « son activé », partagé entre tous les écrans et mémorisé dans le navigateur. */
export function useSoundEnabled(): [boolean, (value: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeSound, isSoundEnabled, isSoundEnabled);
  return [enabled, setSoundEnabled];
}

/**
 * Joue `name` chaque fois que `key` change (et au montage), si `active`.
 * La référence évite de jouer deux fois le même son quand React rejoue l'effet
 * (mode strict en développement).
 */
export function useSoundCue(name: SoundName | null, key: unknown, active = true): void {
  const played = useRef<unknown>(Symbol('jamais'));
  useEffect(() => {
    if (!active || !name || Object.is(played.current, key)) return;
    played.current = key;
    playSound(name);
  }, [name, key, active]);
}
