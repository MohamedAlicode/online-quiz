import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Charge le .env local puis celui de la racine du monorepo.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://quiz:quiz@localhost:5432/quiz?schema=public',
  },
});
