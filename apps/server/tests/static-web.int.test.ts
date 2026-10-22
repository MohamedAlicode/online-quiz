import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

let distPath: string;

beforeAll(() => {
  distPath = mkdtempSync(join(tmpdir(), 'quiz-web-'));
  mkdirSync(join(distPath, 'assets'));
  writeFileSync(join(distPath, 'index.html'), '<!doctype html><title>Quiz Live</title>');
  writeFileSync(join(distPath, 'assets', 'app-abc123.js'), 'console.log("ok")');
});

afterAll(() => rmSync(distPath, { recursive: true, force: true }));

describe('service du front par le serveur (déploiement en un seul service)', () => {
  const app = () => createApp({ webDistPath: distPath });

  it("sert l'application sur la racine et sur les routes du front", async () => {
    for (const path of ['/', '/play', '/host/quizzes/123']) {
      const response = await request(app()).get(path).expect(200);
      expect(response.text).toContain('<title>Quiz Live</title>');
      expect(response.headers['cache-control']).toBe('no-cache');
    }
  });

  it('sert les fichiers statiques avec un cache long', async () => {
    const response = await request(app()).get('/assets/app-abc123.js').expect(200);
    expect(response.headers['cache-control']).toContain('immutable');
  });

  it("laisse l'API répondre en JSON, y compris pour une route inconnue", async () => {
    const response = await request(app()).get('/api/inexistant').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('ne sert rien si le dossier ne contient pas de build', async () => {
    const response = await request(createApp({ webDistPath: join(distPath, 'absent') }))
      .get('/')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
