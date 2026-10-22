import type { JoinedGame } from '@quiz/shared';
import { readJson, removeKey, writeJson } from './storage';

const KEY = 'quiz-live:player-session';

/** Session du joueur, conservée pour revenir dans la partie après un rechargement. */
export function savePlayerSession(session: JoinedGame): void {
  writeJson(KEY, session);
}

export function loadPlayerSession(): JoinedGame | null {
  return readJson<JoinedGame>(KEY);
}

export function clearPlayerSession(): void {
  removeKey(KEY);
}
