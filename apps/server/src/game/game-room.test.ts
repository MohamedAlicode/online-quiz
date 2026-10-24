import type { GameStatePayload } from '@quiz/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRoom, type FinishedGameData, type RoomTransport, type StateTarget } from './game-room';
import { RoomError } from './room-error';
import type { GameSnapshot } from './snapshot';

const snapshot: GameSnapshot = {
  quizId: 'quiz-1',
  title: 'Quiz test',
  questions: [
    {
      id: 'q1',
      type: 'SINGLE',
      text: 'Combien font 2 + 2 ?',
      imageUrl: null,
      timeLimitSec: 10,
      basePoints: 1000,
      choices: [
        { id: 'q1-a', text: '3', isCorrect: false },
        { id: 'q1-b', text: '4', isCorrect: true },
      ],
    },
    {
      id: 'q2',
      type: 'TRUE_FALSE',
      text: 'La Terre est ronde.',
      imageUrl: null,
      timeLimitSec: 20,
      basePoints: 2000,
      choices: [
        { id: 'q2-a', text: 'Vrai', isCorrect: true },
        { id: 'q2-b', text: 'Faux', isCorrect: false },
      ],
    },
  ],
};

/** Transport simulé : mémorise le dernier état envoyé à chaque destinataire. */
class FakeTransport implements RoomTransport {
  readonly states = new Map<string, GameStatePayload>();
  readonly allPayloads: GameStatePayload[] = [];
  readonly kicked: string[] = [];
  closedWith: string | null = null;

  sendState(target: StateTarget, payload: GameStatePayload) {
    this.states.set(target.role === 'host' ? 'host' : target.playerId, payload);
    this.allPayloads.push(payload);
  }
  kickPlayer(playerId: string) {
    this.kicked.push(playerId);
  }
  closeRoom(message: string) {
    this.closedWith = message;
  }
  host() {
    return this.states.get('host')!;
  }
  player(id: string) {
    return this.states.get(id)!;
  }
}

/** Par défaut, les tests pilotent la partie à la main (sans enchaînement automatique). */
function setup({ autoAdvance = false }: { autoAdvance?: boolean } = {}) {
  const transport = new FakeTransport();
  const saved: FinishedGameData[] = [];
  const writer = {
    saveFinishedGame: vi.fn(async (data: FinishedGameData) => {
      saved.push(data);
    }),
    cancelGame: vi.fn(async () => {}),
  };
  const onFinished = vi.fn();
  const room = new GameRoom({
    gameId: 'game-1',
    code: '123456',
    hostId: 'host-1',
    snapshot,
    transport,
    writer,
    onFinished,
    logger: { error: vi.fn() },
    autoAdvance,
  });
  return { room, transport, writer, saved, onFinished };
}

function join(room: GameRoom, nickname: string) {
  const player = room.addPlayer(nickname);
  room.connectPlayer(player.id);
  return player;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GameRoom — lobby', () => {
  it('ajoute les joueurs et diffuse la liste en temps réel', () => {
    const { room, transport } = setup();
    join(room, 'Alice');
    join(room, 'Bob');

    const view = transport.host().view;
    expect(view.status).toBe('LOBBY');
    if (view.status === 'LOBBY') {
      expect(view.players.map((p) => p.nickname)).toEqual(['Alice', 'Bob']);
      expect(view.players.every((p) => p.connected)).toBe(true);
    }
  });

  it('refuse un pseudo déjà pris, sans tenir compte de la casse', () => {
    const { room } = setup();
    room.addPlayer('Alice');
    expect(() => room.addPlayer('alice')).toThrowError(
      expect.objectContaining({ code: 'NICKNAME_TAKEN' }),
    );
  });

  it('refuse de démarrer sans joueur', () => {
    const { room } = setup();
    expect(() => room.start()).toThrowError(expect.objectContaining({ code: 'NO_PLAYERS' }));
  });

  it('refuse les nouveaux joueurs une fois la partie lancée', () => {
    const { room } = setup();
    join(room, 'Alice');
    room.start();
    expect(() => room.addPlayer('Bob')).toThrowError(
      expect.objectContaining({ code: 'GAME_STARTED' }),
    );
  });

  it('retrouve un joueur grâce à son jeton de session', () => {
    const { room } = setup();
    const alice = join(room, 'Alice');
    expect(room.findPlayerBySession(alice.sessionToken)?.id).toBe(alice.id);
    expect(room.findPlayerBySession('inconnu')).toBeNull();
  });
});

describe('GameRoom — déroulé complet', () => {
  it('enchaîne compte à rebours, questions, résultats, classement et podium', async () => {
    const { room, transport, saved, onFinished } = setup();
    const alice = join(room, 'Alice');
    const bob = join(room, 'Bob');

    room.start();
    expect(transport.host().view.status).toBe('COUNTDOWN');

    // Fin du compte à rebours de 3 s : la première question s'ouvre.
    vi.advanceTimersByTime(3000);
    const questionView = transport.player(alice.id).view;
    expect(questionView.status).toBe('QUESTION');

    // La bonne réponse ne doit JAMAIS fuiter pendant la question.
    expect(JSON.stringify(transport.allPayloads)).not.toContain('isCorrect');
    expect(JSON.stringify(transport.allPayloads)).not.toContain('correctChoiceId');

    // Alice répond juste après 2 s (sur 10 s), Bob répond faux.
    vi.advanceTimersByTime(2000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');
    const hostView = transport.host().view;
    expect(hostView.status === 'QUESTION' && hostView.answeredCount).toBe(1);

    room.submitAnswer(bob.id, 'q1', 'q1-a');

    // Tout le monde a répondu : résultats immédiats, sans attendre la fin du temps.
    const results = transport.player(alice.id).view;
    expect(results.status).toBe('RESULTS');
    if (results.status === 'RESULTS') {
      expect(results.correctChoiceId).toBe('q1-b');
      expect(results.distribution).toEqual({ 'q1-a': 1, 'q1-b': 1 });
      // Seule bonne réponse : 1re place, 100 % de la base.
      expect(results.myResult).toMatchObject({
        isCorrect: true,
        points: 1000,
        streak: 1,
        speedRank: 1,
      });
    }
    expect(transport.player(bob.id).me).toMatchObject({ score: 0, rank: 2 });

    room.next();
    const leaderboard = transport.host().view;
    expect(leaderboard.status).toBe('LEADERBOARD');
    if (leaderboard.status === 'LEADERBOARD') {
      expect(leaderboard.top.map((p) => [p.nickname, p.rank, p.previousRank])).toEqual([
        ['Alice', 1, null],
        ['Bob', 2, null],
      ]);
      expect(leaderboard.isLastQuestion).toBe(false);
    }

    // Deuxième question (double points) : Bob répond juste instantanément, Alice aussi.
    room.next();
    expect(transport.host().view.status).toBe('COUNTDOWN');
    vi.advanceTimersByTime(3000);
    room.submitAnswer(bob.id, 'q2', 'q2-a');
    vi.advanceTimersByTime(10_000);
    room.submitAnswer(alice.id, 'q2', 'q2-a');

    const aliceResult = transport.player(alice.id).view;
    if (aliceResult.status === 'RESULTS') {
      // 2e à trouver : 2000 × 90 % = 1800, + 100 de série (2e bonne réponse d'affilée)
      expect(aliceResult.myResult).toMatchObject({
        points: 1900,
        streakBonus: 100,
        streak: 2,
        speedRank: 2,
      });
    }
    const bobResult = transport.player(bob.id).view;
    if (bobResult.status === 'RESULTS') {
      expect(bobResult.myResult).toMatchObject({ points: 2000, streakBonus: 0, speedRank: 1 });
      expect(bobResult.fastest.map((f) => [f.nickname, f.speedRank, f.points])).toEqual([
        ['Bob', 1, 2000],
        ['Alice', 2, 1900],
      ]);
    }

    room.next();
    const finalBoard = transport.host().view;
    if (finalBoard.status === 'LEADERBOARD') {
      expect(finalBoard.isLastQuestion).toBe(true);
      // Alice : 1000 + 1900 = 2900 ; Bob : 2000. Alice garde la 1re place.
      expect(finalBoard.top.map((p) => [p.nickname, p.score, p.previousRank])).toEqual([
        ['Alice', 2900, 1],
        ['Bob', 2000, 2],
      ]);
    }

    room.next();
    const podium = transport.player(bob.id).view;
    expect(podium.status).toBe('PODIUM');
    if (podium.status === 'PODIUM') {
      expect(podium.podium.map((p) => p.nickname)).toEqual(['Alice', 'Bob']);
    }

    // Les résultats sont enregistrés à l'arrivée sur le podium.
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.players).toHaveLength(2);
    expect(saved[0]?.answers).toHaveLength(4);
    expect(saved[0]?.players.find((p) => p.nickname === 'Alice')).toMatchObject({
      finalScore: 2900,
      finalRank: 1,
    });

    room.next();
    expect(transport.host().view.status).toBe('FINISHED');
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('donne plus de points aux premiers à trouver : 1er 100 %, 2e 90 %, 3e 80 %…', () => {
    const { room, transport } = setup();
    const players = ['Alice', 'Bob', 'Chloé', 'Dina', 'Eli'].map((name) => join(room, name));
    const [alice, bob, chloe, dina, eli] = players.map((player) => player.id);
    room.start();
    vi.advanceTimersByTime(3000);

    // Ordre d'arrivée : Chloé, Alice, Dina (mauvaise réponse), Eli, puis Bob.
    room.submitAnswer(chloe!, 'q1', 'q1-b');
    vi.advanceTimersByTime(800);
    room.submitAnswer(alice!, 'q1', 'q1-b');
    vi.advanceTimersByTime(800);
    room.submitAnswer(dina!, 'q1', 'q1-a');
    vi.advanceTimersByTime(3000);
    room.submitAnswer(eli!, 'q1', 'q1-b');
    vi.advanceTimersByTime(4000);
    room.submitAnswer(bob!, 'q1', 'q1-b');

    const resultOf = (id: string) => {
      const view = transport.player(id).view;
      return view.status === 'RESULTS' ? view.myResult : null;
    };
    // Une mauvaise réponse ne prend pas de place : Eli est 3e, Bob 4e.
    expect(resultOf(chloe!)).toMatchObject({ speedRank: 1, points: 1000 });
    expect(resultOf(alice!)).toMatchObject({ speedRank: 2, points: 900 });
    expect(resultOf(eli!)).toMatchObject({ speedRank: 3, points: 800 });
    expect(resultOf(bob!)).toMatchObject({ speedRank: 4, points: 700 });
    expect(resultOf(dina!)).toMatchObject({ speedRank: null, points: 0 });

    // L'écran projeté montre les trois plus rapides, avec leur temps.
    const host = transport.host().view;
    expect(host.status === 'RESULTS' && host.fastest).toEqual([
      { playerId: chloe, nickname: 'Chloé', speedRank: 1, timeTakenMs: 0, points: 1000 },
      { playerId: alice, nickname: 'Alice', speedRank: 2, timeTakenMs: 800, points: 900 },
      { playerId: eli, nickname: 'Eli', speedRank: 3, timeTakenMs: 4600, points: 800 },
    ]);
  });

  it('termine la question à la fin du temps et note les absences de réponse', () => {
    const { room, transport } = setup();
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000 + 10_000);

    const view = transport.player(alice.id).view;
    expect(view.status).toBe('RESULTS');
    if (view.status === 'RESULTS') {
      expect(view.myResult).toMatchObject({ answered: false, points: 0, streak: 0 });
      expect(view.answeredCount).toBe(0);
    }
  });

  it("n'attend pas les joueurs déconnectés", () => {
    const { room, transport } = setup();
    const alice = join(room, 'Alice');
    const bob = join(room, 'Bob');
    room.start();
    vi.advanceTimersByTime(3000);

    room.submitAnswer(alice.id, 'q1', 'q1-b');
    expect(transport.host().view.status).toBe('QUESTION');

    room.disconnectPlayer(bob.id);
    expect(transport.host().view.status).toBe('RESULTS');
  });

  it('refuse une double réponse ou une réponse à une autre question', () => {
    const { room } = setup();
    const alice = join(room, 'Alice');
    join(room, 'Bob');
    room.start();
    vi.advanceTimersByTime(3000);

    expect(() => room.submitAnswer(alice.id, 'q2', 'q2-a')).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
    expect(() => room.submitAnswer(alice.id, 'q1', 'inconnu')).toThrowError(RoomError);
    room.submitAnswer(alice.id, 'q1', 'q1-a');
    expect(() => room.submitAnswer(alice.id, 'q1', 'q1-b')).toThrowError(
      expect.objectContaining({ code: 'ALREADY_ANSWERED' }),
    );
  });
});

describe('GameRoom — actions de l’hôte', () => {
  it('exclut le temps de pause du temps de réponse', () => {
    const { room, transport } = setup();
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);

    vi.advanceTimersByTime(2000);
    room.pause();
    expect(() => room.submitAnswer(alice.id, 'q1', 'q1-b')).toThrowError(
      expect.objectContaining({ code: 'PAUSED' }),
    );
    const paused = transport.host().view;
    expect(paused.status === 'QUESTION' && paused.paused).toBe(true);
    expect(paused.status === 'QUESTION' && paused.remainingMs).toBe(8000);

    // Une longue pause ne fait ni expirer la question ni baisser les points.
    vi.advanceTimersByTime(60_000);
    expect(transport.host().view.status).toBe('QUESTION');
    room.resume();
    room.submitAnswer(alice.id, 'q1', 'q1-b');

    const view = transport.player(alice.id).view;
    // Temps compté : 2 s seulement, ce qui garde l'ordre d'arrivée juste après une pause.
    expect(view.status === 'RESULTS' && view.fastest[0]?.timeTakenMs).toBe(2000);
  });

  it('permet de passer une question avant la fin du temps', () => {
    const { room, transport } = setup();
    join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.next();
    expect(transport.host().view.status).toBe('RESULTS');
  });

  it('exclut un joueur et le prévient', () => {
    const { room, transport } = setup();
    const alice = join(room, 'Alice');
    join(room, 'Bob');
    room.kickPlayer(alice.id);

    expect(transport.kicked).toEqual([alice.id]);
    const view = transport.host().view;
    expect(view.status === 'LOBBY' && view.players.map((p) => p.nickname)).toEqual(['Bob']);
    // Le pseudo est de nouveau disponible.
    expect(() => room.addPlayer('Alice')).not.toThrow();
  });

  it('annule la partie si elle est terminée depuis le lobby', () => {
    const { room, transport, writer, onFinished } = setup();
    join(room, 'Alice');
    room.end();
    expect(writer.cancelGame).toHaveBeenCalledWith('game-1');
    expect(transport.closedWith).not.toBeNull();
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('va au podium si elle est terminée en pleine question, sans noter la question', async () => {
    const { room, transport, saved } = setup();
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b'); // seule joueuse : résultats immédiats
    room.next(); // classement
    room.next(); // compte à rebours Q2
    vi.advanceTimersByTime(3000);
    expect(transport.host().view.status).toBe('QUESTION');

    room.end();
    expect(transport.host().view.status).toBe('PODIUM');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    // Seule la Q1 a été jouée jusqu'au bout.
    expect(saved[0]?.answers.map((a) => a.questionId)).toEqual(['q1']);

    // Aucun timer ne doit relancer la partie ensuite.
    vi.advanceTimersByTime(60_000);
    expect(transport.host().view.status).toBe('PODIUM');
  });

  it('refuse les actions incohérentes avec la phase', () => {
    const { room } = setup();
    join(room, 'Alice');
    expect(() => room.next()).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(() => room.pause()).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
  });
});

describe('GameRoom — enchaînement automatique', () => {
  it('passe seul à la question suivante 5 s après la bonne réponse', () => {
    const { room, transport } = setup({ autoAdvance: true });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');

    const results = transport.player(alice.id);
    expect(results.view.status).toBe('RESULTS');
    expect(results.settings.autoAdvance).toBe(true);
    expect(results.view.status === 'RESULTS' && results.view.autoNextAt).toBe(Date.now() + 5000);

    vi.advanceTimersByTime(4999);
    expect(transport.host().view.status).toBe('RESULTS');
    vi.advanceTimersByTime(1);
    // Pas de classement intermédiaire : on enchaîne sur le compte à rebours de la question 2.
    const next = transport.host().view;
    expect(next.status).toBe('COUNTDOWN');
    expect(next.status === 'COUNTDOWN' && next.questionIndex).toBe(1);
  });

  it('va au podium après la dernière question et enregistre les résultats', async () => {
    const { room, transport, saved } = setup({ autoAdvance: true });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');
    vi.advanceTimersByTime(5000 + 3000);
    room.submitAnswer(alice.id, 'q2', 'q2-a');
    vi.advanceTimersByTime(5000);

    expect(transport.player(alice.id).view.status).toBe('PODIUM');
    await vi.waitFor(() => expect(saved).toHaveLength(1));
  });

  it("laisse l'hôte passer tout de suite à la suite sans attendre les 5 s", () => {
    const { room, transport } = setup({ autoAdvance: true });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');
    room.next();
    expect(transport.host().view.status).toBe('COUNTDOWN');
  });

  it("peut être désactivé pendant les résultats pour garder la réponse à l'écran", () => {
    const { room, transport } = setup({ autoAdvance: true });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');

    room.setAutoAdvance(false);
    const view = transport.host().view;
    expect(view.status === 'RESULTS' && view.autoNextAt).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(transport.host().view.status).toBe('RESULTS');

    // Mode manuel : le bouton « Suivant » repasse par le classement.
    room.next();
    expect(transport.host().view.status).toBe('LEADERBOARD');
  });

  it('reprend le décompte quand on le réactive', () => {
    const { room, transport } = setup({ autoAdvance: false });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');
    expect(transport.host().settings.autoAdvance).toBe(false);

    room.setAutoAdvance(true);
    vi.advanceTimersByTime(5000);
    expect(transport.host().view.status).toBe('COUNTDOWN');
  });

  it("n'avance pas tout seul si la partie est terminée pendant les résultats", () => {
    const { room, transport } = setup({ autoAdvance: true });
    const alice = join(room, 'Alice');
    room.start();
    vi.advanceTimersByTime(3000);
    room.submitAnswer(alice.id, 'q1', 'q1-b');
    room.end();
    vi.advanceTimersByTime(10_000);
    expect(transport.host().view.status).toBe('PODIUM');
  });
});
