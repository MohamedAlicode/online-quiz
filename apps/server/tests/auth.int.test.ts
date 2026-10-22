import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const credentials = {
  email: 'hote@exemple.fr',
  password: 'motdepasse123',
  displayName: 'Mohamed',
};

describe('API auth', () => {
  it('GET /api/health répond avec la base opérationnelle', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('inscrit un hôte sans jamais renvoyer le hash du mot de passe', async () => {
    const response = await request(app).post('/api/auth/register').send(credentials).expect(201);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email: credentials.email, displayName: 'Mohamed' });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    expect(stored.passwordHash).not.toBe(credentials.password);
  });

  it('refuse un email déjà utilisé (409)', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'HOTE@exemple.fr' })
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('valide les données (400) avec un message lisible', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, password: 'court' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION');
    expect(response.body.error.message).toContain('8 caractères');
  });

  it('connecte un hôte et donne accès à /me', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.user.email).toBe(credentials.email);
  });

  it('refuse un mauvais mot de passe avec un message générique', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'mauvais-mot-de-passe' })
      .expect(401);
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@exemple.fr', password: 'mauvais-mot-de-passe' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('protège les routes privées (401)', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/quizzes').set('Authorization', 'Bearer jeton-bidon').expect(401);
  });

  it('expose la documentation OpenAPI', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(Object.keys(response.body.paths)).toContain('/api/quizzes/{id}/questions/reorder');
  });

  it('renvoie un 404 JSON pour une route inconnue', async () => {
    const response = await request(app).get('/api/inexistant').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
