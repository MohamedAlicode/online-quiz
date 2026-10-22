import type { UserDto } from '@quiz/shared';
import { create } from 'zustand';
import { readJson, removeKey, writeJson } from '../lib/storage';

const STORAGE_KEY = 'quiz-live:auth';

interface StoredSession {
  token: string;
  user: UserDto;
}

interface AuthState {
  token: string | null;
  user: UserDto | null;
  setSession: (session: StoredSession) => void;
  setUser: (user: UserDto) => void;
  logout: () => void;
}

const initial = readJson<StoredSession>(STORAGE_KEY);

/**
 * Session de l'hôte. Le JWT est gardé dans le localStorage pour survivre aux rechargements :
 * simple et suffisant ici (aucun contenu tiers n'est injecté dans la page). Un cookie httpOnly
 * serait plus robuste face au XSS ; c'est une évolution possible.
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  setSession: (session) => {
    writeJson(STORAGE_KEY, session);
    set(session);
  },
  setUser: (user) =>
    set((state) => {
      if (state.token) writeJson(STORAGE_KEY, { token: state.token, user });
      return { user };
    }),
  logout: () => {
    removeKey(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
