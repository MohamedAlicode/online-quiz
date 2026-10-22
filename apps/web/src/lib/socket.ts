import type {
  Ack,
  AckCallback,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketErrorCode,
} from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';
import { useGameStore } from '../stores/game-store';
import { API_URL } from './api';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type EventName = keyof ClientToServerEvents;
type PayloadOf<E extends EventName> = Parameters<ClientToServerEvents[E]>[0];
type AckDataOf<E extends EventName> =
  Parameters<ClientToServerEvents[E]>[1] extends AckCallback<infer T> ? T : never;

export class GameRequestError extends Error {
  constructor(
    public readonly code: SocketErrorCode | 'TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'GameRequestError';
  }
}

let socket: GameSocket | null = null;
let socketToken: string | null = null;

/**
 * Connexion Socket.IO unique pour toute l'application.
 * Elle est recréée si le jeton d'hôte change (connexion / déconnexion).
 */
export function getSocket(token: string | null): GameSocket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();

  socketToken = token;
  socket = io(API_URL || undefined, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
  });

  const store = useGameStore.getState();
  store.setConnection('connecting');
  socket.on('connect', () => useGameStore.getState().setConnection('connected'));
  socket.on('disconnect', () => useGameStore.getState().setConnection('disconnected'));
  socket.on('game:state', (payload) => useGameStore.getState().receiveState(payload));
  socket.on('player:kicked', ({ message }) => useGameStore.getState().setNotice(message));
  socket.on('game:closed', ({ message }) => useGameStore.getState().setNotice(message));
  return socket;
}

/** Envoie un événement et attend l'accusé de réception ; rejette avec le message du serveur. */
export async function request<E extends EventName>(
  target: GameSocket,
  event: E,
  payload: PayloadOf<E>,
): Promise<AckDataOf<E>> {
  let response: Ack<AckDataOf<E>>;
  try {
    // Le typage de Socket.IO ne sait pas résoudre emitWithAck pour un nom d'événement générique :
    // on passe par une signature simplifiée, les types d'entrée et de sortie restant garantis
    // par PayloadOf<E> et AckDataOf<E> ci-dessus.
    const emitter = target.timeout(8000) as unknown as {
      emitWithAck: (name: string, data: unknown) => Promise<Ack<AckDataOf<E>>>;
    };
    response = await emitter.emitWithAck(event, payload);
  } catch {
    throw new GameRequestError('TIMEOUT', 'Le serveur ne répond pas. Vérifie ta connexion.');
  }
  if (!response.ok) {
    throw new GameRequestError(response.error.code, response.error.message);
  }
  return response.data;
}
