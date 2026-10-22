import {
  answerSchema,
  createGameSchema,
  emptyPayloadSchema,
  hostRejoinSchema,
  joinGameSchema,
  kickPlayerSchema,
  rejoinGameSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketError,
} from '@quiz/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { GameManager } from '../game/game-manager';
import type { GameRoom, RoomTransport } from '../game/game-room';
import { RateLimiter } from '../game/rate-limiter';
import { RoomError } from '../game/room-error';
import { verifyToken } from '../lib/jwt';

export interface SocketData {
  /** Hôte authentifié (jeton JWT transmis dans `auth.token`), sinon null. */
  userId: string | null;
  hostGameId: string | null;
  player: { gameId: string; playerId: string } | null;
}

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/* Salles Socket.IO utilisées pour cibler les messages */
const hostChannel = (gameId: string) => `host:${gameId}`;
const playerChannel = (playerId: string) => `player:${playerId}`;
const gameChannel = (gameId: string) => `game:${gameId}`;

/** Relie une partie (GameRoom) à Socket.IO. */
export function createSocketTransport(io: IoServer, gameId: string): RoomTransport {
  return {
    sendState(target, payload) {
      const channel = target.role === 'host' ? hostChannel(gameId) : playerChannel(target.playerId);
      io.to(channel).emit('game:state', payload);
    },
    kickPlayer(playerId, message) {
      io.to(playerChannel(playerId)).emit('player:kicked', { message });
      io.in(playerChannel(playerId)).socketsLeave([playerChannel(playerId), gameChannel(gameId)]);
    },
    closeRoom(message) {
      io.to(gameChannel(gameId)).emit('game:closed', { message });
      io.in(gameChannel(gameId)).socketsLeave(gameChannel(gameId));
    },
  };
}

function fail(code: SocketError['code'], message: string): Ack<never> {
  return { ok: false, error: { code, message } };
}

export interface SocketHandlerOptions {
  logger?: Pick<Console, 'error'>;
}

export function registerSocketHandlers(
  io: IoServer,
  manager: GameManager,
  options: SocketHandlerOptions = {},
) {
  const logger = options.logger ?? console;
  const joinLimiter = new RateLimiter(10, 60_000);
  const answerLimiter = new RateLimiter(10, 5_000);
  const hostLimiter = new RateLimiter(30, 10_000);

  const pruneTimer = setInterval(() => {
    joinLimiter.prune();
    answerLimiter.prune();
    hostLimiter.prune();
  }, 60_000);
  pruneTimer.unref?.();

  // Authentification optionnelle : un jeton invalide n'empêche pas de jouer,
  // il empêche seulement les actions d'hôte.
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    socket.data.userId = typeof token === 'string' ? verifyToken(token) : null;
    socket.data.hostGameId = null;
    socket.data.player = null;
    next();
  });

  io.on('connection', (socket: IoSocket) => {
    /**
     * Enregistre un gestionnaire d'événement avec validation Zod, limitation de débit
     * et conversion des erreurs métier en accusé de réception `{ ok: false, error }`.
     */
    function on<S extends z.ZodType, R>(
      event: keyof ClientToServerEvents,
      schema: S,
      limiter: RateLimiter | null,
      handler: (payload: z.output<S>) => R | Promise<R>,
    ) {
      // Le payload est volontairement typé `unknown` : il vient du réseau et est validé par Zod.
      const listener = async (raw: unknown, ack: unknown) => {
        const reply = typeof ack === 'function' ? (ack as (response: Ack<R>) => void) : () => {};
        if (limiter && !limiter.consume(socket.id)) {
          reply(fail('RATE_LIMITED', 'Trop de requêtes, ralentis un peu'));
          return;
        }
        const parsed = schema.safeParse(raw ?? {});
        if (!parsed.success) {
          reply(fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Données invalides'));
          return;
        }
        try {
          reply({ ok: true, data: await handler(parsed.data) });
        } catch (error) {
          if (error instanceof RoomError) {
            reply(fail(error.code, error.message));
            return;
          }
          logger.error(`[socket] erreur sur ${event}`, error);
          reply(fail('INTERNAL', 'Erreur interne du serveur'));
        }
      };
      // Le typage générique de Socket.IO ne sait pas exprimer un listener validé à l'exécution.
      socket.on(event, listener as never);
    }

    /* ----------------------------- Hôte ----------------------------- */

    function requireHostRoom(): GameRoom {
      if (!socket.data.userId) {
        throw new RoomError('UNAUTHORIZED', 'Connecte-toi pour animer une partie');
      }
      const room = socket.data.hostGameId ? manager.getRoom(socket.data.hostGameId) : undefined;
      if (!room) {
        throw new RoomError('GAME_NOT_FOUND', 'Partie introuvable ou terminée');
      }
      if (room.hostId !== socket.data.userId) {
        throw new RoomError('FORBIDDEN', "Tu n'es pas l'hôte de cette partie");
      }
      return room;
    }

    async function attachHost(room: GameRoom) {
      if (socket.data.hostGameId && socket.data.hostGameId !== room.gameId) {
        await socket.leave(hostChannel(socket.data.hostGameId));
        await socket.leave(gameChannel(socket.data.hostGameId));
      }
      socket.data.hostGameId = room.gameId;
      await socket.join([hostChannel(room.gameId), gameChannel(room.gameId)]);
      socket.emit('game:state', room.stateFor({ role: 'host' }));
      return { gameId: room.gameId, code: room.code };
    }

    on('host:create-game', createGameSchema, hostLimiter, async ({ quizId }) => {
      if (!socket.data.userId) {
        throw new RoomError('UNAUTHORIZED', 'Connecte-toi pour lancer une partie');
      }
      const room = await manager.createGame(socket.data.userId, quizId);
      return attachHost(room);
    });

    on('host:rejoin', hostRejoinSchema, hostLimiter, async ({ gameId }) => {
      if (!socket.data.userId) {
        throw new RoomError('UNAUTHORIZED', 'Connecte-toi pour animer une partie');
      }
      const room = manager.getRoom(gameId);
      if (!room) {
        throw new RoomError('GAME_NOT_FOUND', 'Partie introuvable ou terminée');
      }
      if (room.hostId !== socket.data.userId) {
        throw new RoomError('FORBIDDEN', "Tu n'es pas l'hôte de cette partie");
      }
      return attachHost(room);
    });

    on('host:start-game', emptyPayloadSchema, hostLimiter, () => {
      requireHostRoom().start();
      return null;
    });
    on('host:next', emptyPayloadSchema, hostLimiter, () => {
      requireHostRoom().next();
      return null;
    });
    on('host:pause', emptyPayloadSchema, hostLimiter, () => {
      requireHostRoom().pause();
      return null;
    });
    on('host:resume', emptyPayloadSchema, hostLimiter, () => {
      requireHostRoom().resume();
      return null;
    });
    on('host:end-game', emptyPayloadSchema, hostLimiter, () => {
      requireHostRoom().end();
      return null;
    });
    on('host:kick-player', kickPlayerSchema, hostLimiter, ({ playerId }) => {
      requireHostRoom().kickPlayer(playerId);
      return null;
    });

    /* ---------------------------- Joueurs --------------------------- */

    async function detachPlayer() {
      const current = socket.data.player;
      if (!current) return;
      socket.data.player = null;
      await socket.leave(playerChannel(current.playerId));
      await socket.leave(gameChannel(current.gameId));
      manager.getRoom(current.gameId)?.disconnectPlayer(current.playerId);
    }

    async function attachPlayer(room: GameRoom, playerId: string) {
      socket.data.player = { gameId: room.gameId, playerId };
      await socket.join([playerChannel(playerId), gameChannel(room.gameId)]);
      room.connectPlayer(playerId);
    }

    on('player:join', joinGameSchema, joinLimiter, async ({ code, nickname }) => {
      const room = manager.findByCode(code);
      if (!room) {
        throw new RoomError('GAME_NOT_FOUND', 'Aucune partie ne correspond à ce code');
      }
      await detachPlayer();
      const player = room.addPlayer(nickname);
      await attachPlayer(room, player.id);
      return {
        gameId: room.gameId,
        playerId: player.id,
        nickname: player.nickname,
        sessionToken: player.sessionToken,
      };
    });

    on('player:rejoin', rejoinGameSchema, joinLimiter, async ({ sessionToken }) => {
      const found = manager.findBySession(sessionToken);
      if (!found) {
        throw new RoomError('GAME_NOT_FOUND', 'Cette partie est terminée ou introuvable');
      }
      if (socket.data.player?.playerId !== found.player.id) {
        await detachPlayer();
        await attachPlayer(found.room, found.player.id);
      } else {
        socket.emit(
          'game:state',
          found.room.stateFor({ role: 'player', playerId: found.player.id }),
        );
      }
      return {
        gameId: found.room.gameId,
        playerId: found.player.id,
        nickname: found.player.nickname,
        sessionToken: found.player.sessionToken,
      };
    });

    on('player:answer', answerSchema, answerLimiter, ({ questionId, choiceId }) => {
      const current = socket.data.player;
      const room = current ? manager.getRoom(current.gameId) : undefined;
      if (!current || !room || !room.hasPlayer(current.playerId)) {
        throw new RoomError('GAME_NOT_FOUND', 'Tu ne participes à aucune partie');
      }
      room.submitAnswer(current.playerId, questionId, choiceId);
      return { received: true as const };
    });

    socket.on('disconnect', () => {
      const current = socket.data.player;
      if (current) {
        manager.getRoom(current.gameId)?.disconnectPlayer(current.playerId);
      }
      joinLimiter.reset(socket.id);
      answerLimiter.reset(socket.id);
      hostLimiter.reset(socket.id);
    });
  });

  return () => clearInterval(pruneTimer);
}
