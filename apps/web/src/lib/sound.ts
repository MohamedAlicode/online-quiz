import { readJson, writeJson } from './storage';

/**
 * Effets sonores synthétisés avec la Web Audio API : aucun fichier audio à charger ni
 * licence à gérer, et un poids nul dans le bundle. Chaque son est une courte suite de notes
 * (oscillateur + enveloppe de volume pour éviter les clics).
 *
 * Les navigateurs bloquent le son tant que l'utilisateur n'a pas interagi avec la page :
 * le contexte audio n'est créé qu'au premier clic ou à la première touche (`installAudioUnlock`).
 */
export type SoundName =
  'countdown' | 'go' | 'tick' | 'tickUrgent' | 'correct' | 'wrong' | 'step' | 'fanfare';

interface Note {
  /** Fréquence en Hz. */
  freq: number;
  /** Départ, en secondes après le déclenchement du son. */
  at: number;
  /** Durée en secondes. */
  duration: number;
  type?: OscillatorType;
  /** Volume de crête entre 0 et 1. */
  gain?: number;
  /** Glissement de fréquence jusqu'à cette valeur (son « qui tombe »). */
  slideTo?: number;
}

// Do, mi, sol, do : les notes de la fanfare et des marches du podium.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const SOUNDS: Record<SoundName, Note[]> = {
  // 3, 2, 1 puis « top » une octave au-dessus, comme un départ de course.
  countdown: [{ freq: 660, at: 0, duration: 0.2, type: 'triangle' }],
  go: [
    { freq: 1320, at: 0, duration: 0.5, type: 'triangle' },
    { freq: 1980, at: 0, duration: 0.5, gain: 0.25 },
  ],
  // Tic-tac des dernières secondes, plus aigu et plus fort sur les trois dernières.
  tick: [{ freq: 1100, at: 0, duration: 0.06, type: 'triangle', gain: 0.35 }],
  tickUrgent: [{ freq: 1500, at: 0, duration: 0.08, type: 'triangle', gain: 0.6 }],
  correct: [
    { freq: G5, at: 0, duration: 0.14, type: 'triangle' },
    { freq: C6, at: 0.11, duration: 0.32, type: 'triangle' },
  ],
  wrong: [{ freq: 260, at: 0, duration: 0.4, type: 'sawtooth', gain: 0.18, slideTo: 140 }],
  step: [{ freq: C5, at: 0, duration: 0.3, type: 'triangle' }],
  fanfare: [
    { freq: C5, at: 0, duration: 0.16, type: 'triangle' },
    { freq: E5, at: 0.16, duration: 0.16, type: 'triangle' },
    { freq: G5, at: 0.32, duration: 0.16, type: 'triangle' },
    { freq: C6, at: 0.48, duration: 0.9, type: 'triangle' },
    { freq: G5, at: 0.48, duration: 0.9, type: 'triangle', gain: 0.35 },
    { freq: E5, at: 0.48, duration: 0.9, type: 'triangle', gain: 0.35 },
  ],
};

const STORAGE_KEY = 'quiz-live:sound';
const MASTER_VOLUME = 0.35;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = readJson<boolean>(STORAGE_KEY) ?? true;
const listeners = new Set<() => void>();

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  writeJson(STORAGE_KEY, value);
  if (value) unlockAudio();
  listeners.forEach((listener) => listener());
}

/** Abonnement aux changements du réglage (pour `useSyncExternalStore`). */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Crée ou réveille le contexte audio. À appeler pendant une interaction de l'utilisateur. */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
}

/** Débloque le son au premier clic ou à la première touche, sur n'importe quelle page. */
export function installAudioUnlock(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    unlockAudio();
    if (context?.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/**
 * Joue un son. Sans effet si le son est coupé ou pas encore débloqué : on ne veut surtout pas
 * accumuler des sons en attente qui partiraient tous ensemble au premier clic.
 */
export function playSound(name: SoundName, pitch = 1): void {
  if (!enabled || !context || !master || context.state !== 'running') return;
  const start = context.currentTime + 0.01;
  for (const note of SOUNDS[name]) {
    const t0 = start + note.at;
    const t1 = t0 + note.duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = note.type ?? 'sine';
    oscillator.frequency.setValueAtTime(note.freq * pitch, t0);
    if (note.slideTo) oscillator.frequency.exponentialRampToValueAtTime(note.slideTo * pitch, t1);
    // Attaque de 8 ms puis décroissance exponentielle : un son net, sans claquement.
    envelope.gain.setValueAtTime(0.0001, t0);
    envelope.gain.exponentialRampToValueAtTime(note.gain ?? 0.7, t0 + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t1);
    oscillator.connect(envelope).connect(master);
    oscillator.start(t0);
    oscillator.stop(t1 + 0.02);
  }
}
