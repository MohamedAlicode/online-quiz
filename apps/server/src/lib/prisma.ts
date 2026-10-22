import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Client Prisma unique pour tout le serveur.
 * Prisma 7 se connecte via un « driver adapter » : ici le driver `pg` officiel de Node.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

export type Db = typeof prisma;
