import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../prisma/migrations');

/**
 * Recrée le schéma de la base de test à partir des migrations SQL, avant toute la suite.
 * Sécurité : refuse de s'exécuter sur une base dont le nom ne contient pas « test ».
 */
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://quiz:quiz@localhost:5432/quiz_test?schema=public';
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.includes('test')) {
    throw new Error(`Refus de réinitialiser « ${databaseName} » : ce n'est pas une base de test.`);
  }

  const client = new pg.Client({ connectionString: url.split('?')[0] });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Base de test injoignable (${databaseName}). Lance « docker compose up -d » puis réessaie.`,
      { cause: error },
    );
  }

  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations) {
      await client.query(await readFile(join(migrationsDir, migration, 'migration.sql'), 'utf8'));
    }
  } finally {
    await client.end();
  }
}
