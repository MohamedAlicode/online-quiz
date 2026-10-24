import type { ClientToServerEvents, GameStatePayload } from '@quiz/shared';
import { useCallback, useEffect, useState } from 'react';
import { clearPlayerSession, loadPlayerSession } from '../lib/player-session';
import { GameRequestError, getSocket, request } from '../lib/socket';
import { useAuthStore } from '../stores/auth-store';
import { useGameStore } from '../stores/game-store';

type HostCommand = Exclude<
  keyof ClientToServerEvents,
  | 'host:create-game'
  | 'host:rejoin'
  | 'host:kick-player'
  | 'host:set-auto-advance'
  | `player:${string}`
>;

/**
 * Connexion de l'hôte à une partie. À chaque (re)connexion du socket, on renvoie
 * `host:rejoin` : le serveur répond avec l'état courant, ce qui rend le rechargement
 * de page et les coupures réseau transparents.
 */
export function useHostGame(gameId: string) {
  const token = useAuthStore((state) => state.token);
  const rawState = useGameStore((state) => state.state);
  const connection = useGameStore((state) => state.connection);
  const notice = useGameStore((state) => state.notice);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const socket = getSocket(token);
    useGameStore.getState().reset();
    const rejoin = () => {
      request(socket, 'host:rejoin', { gameId }).catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Partie introuvable'),
      );
    };
    if (socket.connected) rejoin();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
    };
  }, [gameId, token]);

  const perform = useCallback(async (action: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action impossible');
    } finally {
      setPending(false);
    }
  }, []);

  const run = useCallback(
    (command: HostCommand) => perform(() => request(getSocket(token), command, {})),
    [perform, token],
  );

  const kick = useCallback(
    (playerId: string) =>
      perform(() => request(getSocket(token), 'host:kick-player', { playerId })),
    [perform, token],
  );

  const setAutoAdvance = useCallback(
    (enabled: boolean) =>
      perform(() => request(getSocket(token), 'host:set-auto-advance', { enabled })),
    [perform, token],
  );

  const state: GameStatePayload | null = rawState?.gameId === gameId ? rawState : null;
  return { state, connection, notice, error, pending, run, kick, setAutoAdvance };
}

/** Connexion du joueur : reprend automatiquement la partie grâce au jeton de session. */
export function usePlayerGame() {
  const token = useAuthStore((state) => state.token);
  const state = useGameStore((store) => store.state);
  const connection = useGameStore((store) => store.connection);
  const notice = useGameStore((store) => store.notice);
  const [session] = useState(loadPlayerSession);
  const [ended, setEnded] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket(token);
    const rejoin = () => {
      request(socket, 'player:rejoin', { sessionToken: session.sessionToken }).catch(
        (caught: unknown) => {
          if (caught instanceof GameRequestError && caught.code === 'TIMEOUT') return;
          clearPlayerSession();
          setEnded(caught instanceof Error ? caught.message : 'Partie introuvable');
        },
      );
    };
    if (socket.connected) rejoin();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
    };
  }, [session, token]);

  useEffect(() => {
    if (notice) clearPlayerSession();
  }, [notice]);

  const answer = useCallback(
    async (questionId: string, choiceId: string) => {
      await request(getSocket(token), 'player:answer', { questionId, choiceId });
    },
    [token],
  );

  const current = state && session && state.gameId === session.gameId ? state : null;
  return { session, state: current, connection, notice: notice ?? ended, answer };
}
