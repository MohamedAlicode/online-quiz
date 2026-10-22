import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: ['.env', '../../.env'], quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://quiz:quiz@localhost:5432/quiz_test?schema=public';

export default defineConfig({
  test: {
    globalSetup: ['tests/global-setup.ts'],
    // Les tests d'intégration partagent la même base : on les exécute un fichier à la fois.
    fileParallelism: false,
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: 'jwt-secret-de-test-suffisamment-long-0123456789',
      BCRYPT_ROUNDS: '4',
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
  },
});
