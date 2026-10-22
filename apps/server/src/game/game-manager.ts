import { randomInt } from 'node:crypto';
import {
  GameRoom,
  type GameResultWriter,
  type JoinedPlayer,
  type RoomTransport,
} from './game-room';
import { RoomError } from './room-error';
import type { GameSnapshot } from './snapshot';

/** Persistance nécessaire au gestionnaire : création de la partie + écriture des résultats. */
export interface GameStore extends GameResultWriter {
  createGame(input: {
    hostId: string;
    quizId: string;
    code: string;
  }): Promise<{ gameId: string; snapshot: GameSnapshot }>;
}

export interface GameManagerOptions {
  store: GameStore;
  transportFor: (gameId: string) => RoomTransport;
  /** Durée pendant laquelle une partie terminée reste consultable (reconnexion, podium). */
  finishedRetentionMs?: number;
  logger?: Pick<Console, 'error'>;
}

const MAX_CODE_ATTEMPTS = 50;

/**
 * Registre des parties actives (en mémoire, une seule instance de serveur).
 * Pour passer à plusieurs instances, il faudrait partager cet état (Redis + adaptateur Socket.IO).
 */
export class GameManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly reservedCodes = new Set<string>();
  private readonly removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly options: GameManagerOptions) {}

  get activeRoomCount(): number {
    return this.rooms.size;
  }

  async createGame(hostId: string, quizId: string): Promise<GameRoom> {
    // Le code est réservé AVANT l'appel asynchrone : deux créations simultanées
    // ne peuvent pas obtenir le même code.
    const code = this.reserveCode();
    try {
      const { gameId, snapshot } = await this.options.store.createGame({ hostId, quizId, code });
      const room = new GameRoom({
        gameId,
        code,
        hostId,
        snapshot,
        transport: this.options.transportFor(gameId),
        writer: this.options.store,
        logger: this.options.logger,
        onFinished: (finished) => this.scheduleRemoval(finished),
      });
      this.rooms.set(gameId, room);
      return room;
    } finally {
      this.reservedCodes.delete(code);
    }
  }

  getRoom(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  findByCode(code: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.code === code && room.currentStatus !== 'FINISHED') return room;
    }
    return undefined;
  }

  findBySession(sessionToken: string): { room: GameRoom; player: JoinedPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.findPlayerBySession(sessionToken);
      if (player) return { room, player };
    }
    return null;
  }

  removeRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    room?.dispose();
    this.rooms.delete(gameId);
    const timer = this.removalTimers.get(gameId);
    if (timer) clearTimeout(timer);
    this.removalTimers.delete(gameId);
  }

  /** Ferme les parties sans activité depuis `maxIdleMs` (hôte parti sans terminer, par exemple). */
  sweepIdle(maxIdleMs: number, now = Date.now()): number {
    let closed = 0;
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivityAt > maxIdleMs) {
        room.close('La partie a été fermée pour inactivité');
        this.removeRoom(room.gameId);
        closed += 1;
      }
    }
    return closed;
  }

  closeAll(message: string): void {
    for (const room of [...this.rooms.values()]) {
      room.close(message);
      this.removeRoom(room.gameId);
    }
  }

  private scheduleRemoval(room: GameRoom): void {
    const delay = this.options.finishedRetentionMs ?? 10 * 60 * 1000;
    const timer = setTimeout(() => this.removeRoom(room.gameId), delay);
    timer.unref?.();
    this.removalTimers.set(room.gameId, timer);
  }

  private reserveCode(): string {
    const used = new Set([...this.reservedCodes]);
    for (const room of this.rooms.values()) {
      if (room.currentStatus !== 'FINISHED') used.add(room.code);
    }
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      if (!used.has(code)) {
        this.reservedCodes.add(code);
        return code;
      }
    }
    throw new RoomError('INTERNAL', 'Impossible de générer un code de partie, réessaie');
  }
}
