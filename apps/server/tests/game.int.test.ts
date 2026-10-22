import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  GameStatePayload,
  GameViewStatus,
  ServerToClientEvents,
} from '@quiz/shared';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { createServer } from '../src/server';
import { app, createQuizWithQuestions, registerHost, resetDatabase } from './helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Client de test : mémorise le dernier état reçu et permet d'attendre une phase précise. */
class TestClient {
  readonly socket: ClientSocket;
  last: GameStatePayload | null = null;
  kickedMessage: string | null = null;
  private waiters: { status: GameViewStatus; resolve: (state: GameStatePayload) => void }[] = [];

  constructor(url: string, token?: string) {
    this.socket = connect(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    this.socket.on('game:state', (state) => {
      this.last = state;
      this.waiters = this.waiters.filter((waiter) => {
        if (waiter.status !== state.view.status) return true;
        waiter.resolve(state);
        return false;
      });
    });
    this.socket.on('player:kicked', ({ message }) => {
      this.kickedMessage = message;
    });
  }

  connected() {
    return new Promise<void>((resolve, reject) => {
      if (this.socket.connected) return resolve();
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
    });
  }

  waitFor(status: GameViewStatus, timeoutMs = 8000): Promise<GameStatePayload> {
    if (this.last?.view.status === status) return Promise.resolve(this.last);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Phase ${status} non reçue (dernière : ${this.last?.view.status})`)),
        timeoutMs,
      );
      this.waiters.push({
        status,
        resolve: (state) => {
          clearTimeout(timer);
          resolve(state);
        },
      });
    });
  }

  close() {
    this.socket.disconnect();
  }
}

let server: ReturnType<typeof createServer>;
let url: string;
const clients: TestClient[] = [];

async function client(token?: string) {
  const created = new TestClient(url, token);
  clients.push(created);
  await created.connected();
  return created;
}

beforeEach(async () => {
  await resetDatabase();
  server = createServer({ finishedRetentionMs: 60_000 });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const created of clients.splice(0)) created.close();
  await server.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
});

afterAll(() => prisma.$disconnect());

describe('partie en temps réel (Socket.IO)', () => {
  it('joue une partie complète avec deux joueurs, une reconnexion et l’export des résultats', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);
    const [q1, q2] = quiz.questions;

    // L'hôte crée la partie.
    const host = await client(token);
    const created = await host.socket.emitWithAck('host:create-game', { quizId: quiz.id });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.data.code).toMatch(/^\d{6}$/);
    expect((await host.waitFor('LOBBY')).role).toBe('host');

    // Erreurs de saisie côté joueur.
    const stranger = await client();
    const badCode = await stranger.socket.emitWithAck('player:join', {
      code: '000000',
      nickname: 'Zoé',
    });
    expect(!badCode.ok && badCode.error.code).toBe('GAME_NOT_FOUND');
    const invalid = await stranger.socket.emitWithAck('player:join', {
      code: 'abc',
      nickname: 'Z',
    });
    expect(!invalid.ok && invalid.error.code).toBe('VALIDATION');

    // Un joueur ne peut pas piloter la partie.
    const notHost = await stranger.socket.emitWithAck('host:start-game', {});
    expect(!notHost.ok && notHost.error.code).toBe('UNAUTHORIZED');

    // Deux joueurs rejoignent.
    const alice = await client();
    const bob = await client();
    const aliceJoin = await alice.socket.emitWithAck('player:join', {
      code: created.data.code,
      nickname: 'Alice',
    });
    const bobJoin = await bob.socket.emitWithAck('player:join', {
      code: created.data.code,
      nickname: 'Bob',
    });
    if (!aliceJoin.ok || !bobJoin.ok) throw new Error('Inscription impossible');
    const duplicate = await stranger.socket.emitWithAck('player:join', {
      code: created.data.code,
      nickname: 'ALICE',
    });
    expect(!duplicate.ok && duplicate.error.code).toBe('NICKNAME_TAKEN');

    const lobby = host.last!.view;
    expect(lobby.status === 'LOBBY' && lobby.players.map((p) => p.nickname)).toEqual([
      'Alice',
      'Bob',
    ]);

    // Lancement : compte à rebours puis question 1.
    expect((await host.socket.emitWithAck('host:start-game', {})).ok).toBe(true);
    await alice.waitFor('COUNTDOWN');
    const question = await alice.waitFor('QUESTION');
    expect(JSON.stringify(question)).not.toContain('isCorrect');

    const correctQ1 = q1!.choices.find((c) => c.isCorrect)!.id;
    const wrongQ1 = q1!.choices.find((c) => !c.isCorrect)!.id;
    expect(
      (await alice.socket.emitWithAck('player:answer', { questionId: q1!.id, choiceId: correctQ1 }))
        .ok,
    ).toBe(true);
    const twice = await alice.socket.emitWithAck('player:answer', {
      questionId: q1!.id,
      choiceId: wrongQ1,
    });
    expect(!twice.ok && twice.error.code).toBe('ALREADY_ANSWERED');
    await bob.socket.emitWithAck('player:answer', { questionId: q1!.id, choiceId: wrongQ1 });

    const aliceResults = await alice.waitFor('RESULTS');
    const resultsView = aliceResults.view;
    expect(resultsView.status === 'RESULTS' && resultsView.correctChoiceId).toBe(correctQ1);
    expect(resultsView.status === 'RESULTS' && resultsView.myResult?.isCorrect).toBe(true);

    // Bob perd sa connexion puis revient avec son jeton de session.
    bob.close();
    const bobAgain = await client();
    const rejoin = await bobAgain.socket.emitWithAck('player:rejoin', {
      sessionToken: bobJoin.data.sessionToken,
    });
    expect(rejoin.ok && rejoin.data.nickname).toBe('Bob');
    const bobState = await bobAgain.waitFor('RESULTS');
    expect(bobState.view.status === 'RESULTS' && bobState.view.myResult?.isCorrect).toBe(false);

    // Classement puis question 2.
    await host.socket.emitWithAck('host:next', {});
    const board = await bobAgain.waitFor('LEADERBOARD');
    expect(board.view.status === 'LEADERBOARD' && board.view.top[0]?.nickname).toBe('Alice');

    await host.socket.emitWithAck('host:next', {});
    await alice.waitFor('QUESTION');
    const correctQ2 = q2!.choices.find((c) => c.isCorrect)!.id;
    await alice.socket.emitWithAck('player:answer', { questionId: q2!.id, choiceId: correctQ2 });
    await bobAgain.socket.emitWithAck('player:answer', { questionId: q2!.id, choiceId: correctQ2 });
    await host.waitFor('RESULTS');

    await host.socket.emitWithAck('host:next', {});
    const lastBoard = await host.waitFor('LEADERBOARD');
    expect(lastBoard.view.status === 'LEADERBOARD' && lastBoard.view.isLastQuestion).toBe(true);

    await host.socket.emitWithAck('host:next', {});
    const podium = await alice.waitFor('PODIUM');
    expect(podium.me?.rank).toBe(1);

    // Les résultats sont persistés et consultables via l'API REST.
    const gameId = created.data.gameId;
    await expect
      .poll(
        async () =>
          (
            await request(app)
              .get(`/api/games/${gameId}/results`)
              .set('Authorization', `Bearer ${token}`)
          ).status,
      )
      .toBe(200);

    const results = await request(app)
      .get(`/api/games/${gameId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(results.body.results.ranking.map((r: { nickname: string }) => r.nickname)).toEqual([
      'Alice',
      'Bob',
    ]);
    expect(results.body.results.questions[0].successRate).toBe(0.5);

    const csv = await request(app)
      .get(`/api/games/${gameId}/results.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('1,Alice');

    const history = await request(app)
      .get('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.games).toHaveLength(1);

    await host.socket.emitWithAck('host:next', {});
    await alice.waitFor('FINISHED');
  }, 30_000);

  it("permet à l'hôte d'exclure un joueur et de reprendre la main après un rechargement", async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token);

    const host = await client(token);
    const created = await host.socket.emitWithAck('host:create-game', { quizId: quiz.id });
    if (!created.ok) throw new Error(created.error.message);

    const player = await client();
    const joined = await player.socket.emitWithAck('player:join', {
      code: created.data.code,
      nickname: 'Intrus',
    });
    if (!joined.ok) throw new Error(joined.error.message);

    // Rechargement de la page de l'hôte : nouvelle connexion, même compte.
    host.close();
    const hostAgain = await client(token);
    const rejoined = await hostAgain.socket.emitWithAck('host:rejoin', {
      gameId: created.data.gameId,
    });
    expect(rejoined.ok).toBe(true);

    const kicked = await hostAgain.socket.emitWithAck('host:kick-player', {
      playerId: joined.data.playerId,
    });
    expect(kicked.ok).toBe(true);
    await expect.poll(() => player.kickedMessage).not.toBeNull();

    const answer = await player.socket.emitWithAck('player:answer', {
      questionId: 'q',
      choiceId: 'c',
    });
    expect(answer.ok).toBe(false);

    // Un autre hôte ne peut pas prendre le contrôle de la partie.
    const other = await registerHost('Autre');
    const intruder = await client(other.token);
    const forbidden = await intruder.socket.emitWithAck('host:rejoin', {
      gameId: created.data.gameId,
    });
    expect(!forbidden.ok && forbidden.error.code).toBe('FORBIDDEN');

    // Terminer depuis le lobby annule la partie.
    await hostAgain.socket.emitWithAck('host:end-game', {});
    await expect.poll(() => prisma.game.count()).toBe(0);
  });

  it('refuse de lancer un quiz sans question', async () => {
    const { token } = await registerHost();
    const quiz = await createQuizWithQuestions(token, []);
    const host = await client(token);
    const created = await host.socket.emitWithAck('host:create-game', { quizId: quiz.id });
    expect(!created.ok && created.error.code).toBe('NO_QUESTIONS');
  });
});
