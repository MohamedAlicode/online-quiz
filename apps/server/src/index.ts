import { env } from './config/env';
import { prisma } from './lib/prisma';
import { createServer } from './server';

const server = createServer();

server.httpServer.listen(env.PORT, () => {
  console.log(`[server] API prête sur http://localhost:${env.PORT}/api`);
  console.log(`[server] Documentation sur http://localhost:${env.PORT}/api/docs`);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} reçu, arrêt propre…`);
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
