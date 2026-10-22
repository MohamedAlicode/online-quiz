import type { GameStatePayload } from '@quiz/shared';
import { create } from 'zustand';
import { computeOffset } from '../lib/clock';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface GameState {
  /** Dernier état reçu du serveur (unique source de vérité). */
  state: GameStatePayload | null;
  /** Décalage d'horloge serveur − client, en millisecondes. */
  clockOffset: number;
  connection: ConnectionStatus;
  /** Message de fin forcée : exclusion, partie fermée… */
  notice: string | null;
  receiveState: (payload: GameStatePayload) => void;
  setConnection: (connection: ConnectionStatus) => void;
  setNotice: (notice: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  state: null,
  clockOffset: 0,
  connection: 'connecting',
  notice: null,
  receiveState: (payload) =>
    set({ state: payload, clockOffset: computeOffset(payload.serverNow, Date.now()) }),
  setConnection: (connection) => set({ connection }),
  setNotice: (notice) => set({ notice }),
  reset: () => set({ state: null, notice: null, clockOffset: 0 }),
}));
