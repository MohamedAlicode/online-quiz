import { createServer as createHttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { GameManager, type GameStore } from './game/game-manager';
import { createPrismaGameStore } from './game/prisma-game-store';
import { prisma } from './lib/prisma';
import { createSocketTransport, registerSocketHandlers, type IoServer } from './socket/handlers';

export interface ServerOptions {
  store?: GameStore;
  finishedRetentionMs?: number;
}

/** Assemble Express, Socket.IO et le gestionnaire de parties sur un même serveur HTTP. */
export function createServer(options: ServerOptions = {}) {
  const app = createApp();
  const httpServer = createHttpServer(app);

  const io: IoServer = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });
  // Reconnexion : le client renvoie `player:rejoin` (ou `host:rejoin`) à chaque reconnexion
  // et reçoit l'état courant de la partie. Pas besoin de rejouer les messages manqués.

  const manager = new GameManager({
    store: options.store ?? createPrismaGameStore(prisma),
    transportFor: (gameId) => createSocketTransport(io, gameId),
    finishedRetentionMs: options.finishedRetentionMs,
  });
  const stopSocketHandlers = registerSocketHandlers(io, manager);

  // Ferme les parties abandonnées (aucune activité depuis 1 h).
  const sweepTimer = setInterval(() => manager.sweepIdle(60 * 60 * 1000), 5 * 60 * 1000);
  sweepTimer.unref();

  async function close() {
    clearInterval(sweepTimer);
    stopSocketHandlers();
    manager.closeAll('Le serveur redémarre, la partie est interrompue');
    await io.close();
  }

  return { app, httpServer, io, manager, close };
}
