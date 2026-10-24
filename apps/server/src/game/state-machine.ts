import type { GameViewStatus } from '@quiz/shared';

/**
 * Machine à états d'une partie, sous forme de fonction pure.
 *
 *   LOBBY ─START─▶ COUNTDOWN ─COUNTDOWN_ELAPSED─▶ QUESTION ─QUESTION_ENDED─▶ RESULTS
 *                      ▲                                                       │
 *                      │ NEXT (questions restantes)                       NEXT │
 *                      └──────────────────── LEADERBOARD ◀────────────────────┘
 *                                                │ NEXT (dernière question)
 *                                                ▼
 *                                             PODIUM ─NEXT / END─▶ FINISHED
 *
 * END depuis le lobby annule la partie (FINISHED), depuis une phase de jeu elle saute au PODIUM.
 * En enchaînement automatique, AUTO_NEXT mène de RESULTS directement à la question suivante
 * (COUNTDOWN) ou au PODIUM après la dernière question, sans classement intermédiaire.
 * La salle (GameRoom) exécute les effets (timers, scores, diffusion) ; ce module ne fait que
 * décider si une transition est permise et vers quel état elle mène.
 */
export type GameStatus = GameViewStatus;

export type GameEvent =
  | { type: 'START' }
  | { type: 'COUNTDOWN_ELAPSED' }
  | { type: 'QUESTION_ENDED' }
  | { type: 'NEXT'; hasMoreQuestions: boolean }
  /** Enchaînement automatique : on saute le classement intermédiaire. */
  | { type: 'AUTO_NEXT'; hasMoreQuestions: boolean }
  | { type: 'END' };

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: GameStatus,
    public readonly event: GameEvent['type'],
  ) {
    super(`Transition impossible : ${event} depuis ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

export function transition(status: GameStatus, event: GameEvent): GameStatus {
  switch (event.type) {
    case 'START':
      if (status === 'LOBBY') return 'COUNTDOWN';
      break;
    case 'COUNTDOWN_ELAPSED':
      if (status === 'COUNTDOWN') return 'QUESTION';
      break;
    case 'QUESTION_ENDED':
      if (status === 'QUESTION') return 'RESULTS';
      break;
    case 'NEXT':
      if (status === 'RESULTS') return 'LEADERBOARD';
      if (status === 'LEADERBOARD') return event.hasMoreQuestions ? 'COUNTDOWN' : 'PODIUM';
      if (status === 'PODIUM') return 'FINISHED';
      break;
    case 'AUTO_NEXT':
      if (status === 'RESULTS') return event.hasMoreQuestions ? 'COUNTDOWN' : 'PODIUM';
      break;
    case 'END':
      if (status === 'LOBBY' || status === 'PODIUM') return 'FINISHED';
      if (status !== 'FINISHED') return 'PODIUM';
      break;
  }
  throw new InvalidTransitionError(status, event.type);
}

export function canTransition(status: GameStatus, event: GameEvent): boolean {
  try {
    transition(status, event);
    return true;
  } catch {
    return false;
  }
}
