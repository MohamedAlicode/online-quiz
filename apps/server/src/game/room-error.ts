import type { SocketErrorCode } from '@quiz/shared';

/** Erreur métier du jeu, renvoyée telle quelle au client dans l'accusé de réception. */
export class RoomError extends Error {
  constructor(
    public readonly code: SocketErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}
