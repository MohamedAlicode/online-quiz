import { randomBytes, randomUUID } from 'node:crypto';
import {
  LEADERBOARD_SIZE,
  LIMITS,
  TIMING,
  computeScore,
  rankPlayers,
  type GameStatePayload,
  type GameView,
  type LobbyPlayer,
  type PlayerQuestionResult,
  type PlayerSelf,
  type RankedPlayer,
} from '@quiz/shared';
import { RoomError } from './room-error';
import {
  correctChoiceId,
  toPublicQuestion,
  type GameSnapshot,
  type SnapshotQuestion,
} from './snapshot';
import {
  InvalidTransitionError,
  transition,
  type GameEvent,
  type GameStatus,
} from './state-machine';

/* ------------------------------------------------------------------ */
/* Dépendances injectées : la salle ne connaît ni Socket.IO ni Prisma   */
/* ------------------------------------------------------------------ */

export type StateTarget = { role: 'host' } | { role: 'player'; playerId: string };

/** Canal de sortie vers les clients (implémenté avec Socket.IO, simulé dans les tests). */
export interface RoomTransport {
  sendState(target: StateTarget, payload: GameStatePayload): void;
  kickPlayer(playerId: string, message: string): void;
  closeRoom(message: string): void;
}

export interface FinishedGameData {
  gameId: string;
  endedAt: Date;
  players: {
    id: string;
    nickname: string;
    sessionToken: string;
    finalScore: number;
    finalRank: number;
  }[];
  answers: {
    playerId: string;
    questionId: string;
    choiceId: string | null;
    isCorrect: boolean;
    timeTakenMs: number;
    pointsAwarded: number;
    streakAtTime: number;
  }[];
}

/** Persistance des résultats (implémentée avec Prisma, simulée dans les tests). */
export interface GameResultWriter {
  saveFinishedGame(data: FinishedGameData): Promise<void>;
  cancelGame(gameId: string): Promise<void>;
}

export interface GameRoomOptions {
  gameId: string;
  code: string;
  hostId: string;
  snapshot: GameSnapshot;
  transport: RoomTransport;
  writer: GameResultWriter;
  /** Appelé quand la partie passe à FINISHED (pour libérer la salle). */
  onFinished?: (room: GameRoom) => void;
  logger?: Pick<Console, 'error'>;
}

/* ------------------------------------------------------------------ */
/* État interne                                                        */
/* ------------------------------------------------------------------ */

interface PendingAnswer {
  choiceId: string;
  timeTakenMs: number;
}

interface ScoredAnswer extends PlayerQuestionResult {
  choiceId: string | null;
  timeTakenMs: number;
}

interface RoomPlayer {
  id: string;
  nickname: string;
  sessionToken: string;
  /** Nombre de connexions actives (un joueur peut avoir deux onglets ouverts). */
  connections: number;
  score: number;
  streak: number;
  correctCount: number;
  /** Temps cumulé sur les bonnes réponses, pour départager les égalités. */
  totalTimeMs: number;
  /** Rang au dernier classement affiché, pour animer les changements de place. */
  lastRank: number | null;
  /** Réponse à la question en cours, notée seulement à la fin de la question. */
  pending: PendingAnswer | null;
  results: Map<string, ScoredAnswer>;
}

export interface JoinedPlayer {
  id: string;
  nickname: string;
  sessionToken: string;
}

/**
 * Une partie en cours, en mémoire.
 *
 * Le serveur est l'unique source de vérité : il gère les timers, note les réponses et calcule
 * les scores. Les clients reçoivent uniquement des vues (`GameStatePayload`) adaptées à leur rôle,
 * et la bonne réponse n'est jamais envoyée avant la fin de la question.
 */
export class GameRoom {
  readonly gameId: string;
  readonly code: string;
  readonly hostId: string;
  readonly snapshot: GameSnapshot;

  private status: GameStatus = 'LOBBY';
  private readonly players = new Map<string, RoomPlayer>();
  private questionIndex = -1;
  /** Horodatage de fin de la phase en cours (compte à rebours ou question). */
  private phaseEndsAt = 0;
  private paused = false;
  private pausedRemainingMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private leaderboard: RankedPlayer[] = [];
  private finalRanking: RankedPlayer[] = [];
  private readonly playedQuestionIds: string[] = [];
  private lastActivity = Date.now();

  private readonly transport: RoomTransport;
  private readonly writer: GameResultWriter;
  private readonly onFinished?: (room: GameRoom) => void;
  private readonly logger: Pick<Console, 'error'>;

  constructor(options: GameRoomOptions) {
    this.gameId = options.gameId;
    this.code = options.code;
    this.hostId = options.hostId;
    this.snapshot = options.snapshot;
    this.transport = options.transport;
    this.writer = options.writer;
    this.onFinished = options.onFinished;
    this.logger = options.logger ?? console;
  }

  /* ----------------------------- Lecture ---------------------------- */

  get currentStatus(): GameStatus {
    return this.status;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get lastActivityAt(): number {
    return this.lastActivity;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  findPlayerBySession(sessionToken: string): JoinedPlayer | null {
    for (const player of this.players.values()) {
      if (player.sessionToken === sessionToken) {
        return { id: player.id, nickname: player.nickname, sessionToken: player.sessionToken };
      }
    }
    return null;
  }

  /* --------------------------- Joueurs ------------------------------ */

  /** Ajoute un joueur dans le lobby. Appeler ensuite `connectPlayer` une fois son socket prêt. */
  addPlayer(nickname: string): JoinedPlayer {
    if (this.status !== 'LOBBY') {
      throw new RoomError('GAME_STARTED', 'La partie a déjà commencé');
    }
    if (this.players.size >= LIMITS.maxPlayersPerGame) {
      throw new RoomError('GAME_FULL', 'La partie est complète');
    }
    const normalized = nickname.trim();
    const taken = [...this.players.values()].some(
      (player) => player.nickname.toLocaleLowerCase('fr') === normalized.toLocaleLowerCase('fr'),
    );
    if (taken) {
      throw new RoomError('NICKNAME_TAKEN', 'Ce pseudo est déjà pris dans cette partie');
    }

    const player: RoomPlayer = {
      id: randomUUID(),
      nickname: normalized,
      sessionToken: randomBytes(24).toString('hex'),
      connections: 0,
      score: 0,
      streak: 0,
      correctCount: 0,
      totalTimeMs: 0,
      lastRank: null,
      pending: null,
      results: new Map(),
    };
    this.players.set(player.id, player);
    this.touch();
    return { id: player.id, nickname: player.nickname, sessionToken: player.sessionToken };
  }

  connectPlayer(playerId: string): void {
    const player = this.requirePlayer(playerId);
    player.connections += 1;
    this.touch();
    // L'arrivée d'un joueur ne concerne que le lobby ; en jeu, seul le joueur a besoin de l'état.
    if (this.status === 'LOBBY') {
      this.broadcast();
    } else {
      this.sendToPlayer(player);
      this.sendToHost();
    }
  }

  disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connections = Math.max(0, player.connections - 1);
    if (this.status === 'LOBBY') {
      this.broadcast();
      return;
    }
    this.sendToHost();
    // On n'attend pas un joueur parti : la question peut se terminer sans lui.
    if (this.status === 'QUESTION' && !this.paused && this.everyoneAnswered()) {
      this.endQuestion();
    }
  }

  kickPlayer(playerId: string): void {
    const player = this.requirePlayer(playerId);
    this.players.delete(player.id);
    this.transport.kickPlayer(player.id, "L'hôte t'a retiré de la partie");
    this.touch();
    if (this.status === 'QUESTION' && !this.paused && this.everyoneAnswered()) {
      this.endQuestion();
      return;
    }
    this.broadcast();
  }

  /* ------------------------ Actions de l'hôte ----------------------- */

  start(): void {
    if (this.status !== 'LOBBY') {
      throw new RoomError('INVALID_STATE', 'La partie a déjà commencé');
    }
    if (this.players.size === 0) {
      throw new RoomError('NO_PLAYERS', 'Il faut au moins un joueur pour lancer la partie');
    }
    this.apply({ type: 'START' });
    this.questionIndex = 0;
    this.beginCountdown();
  }

  /** Bouton « Suivant » de l'hôte : son effet dépend de la phase en cours. */
  next(): void {
    switch (this.status) {
      case 'QUESTION':
        // Passer la question avant la fin du temps.
        this.endQuestion();
        return;
      case 'RESULTS':
        this.apply({ type: 'NEXT', hasMoreQuestions: this.hasMoreQuestions() });
        this.showLeaderboard();
        return;
      case 'LEADERBOARD': {
        const hasMoreQuestions = this.hasMoreQuestions();
        this.apply({ type: 'NEXT', hasMoreQuestions });
        if (hasMoreQuestions) {
          this.questionIndex += 1;
          this.beginCountdown();
        } else {
          this.showPodium();
        }
        return;
      }
      case 'PODIUM':
        this.apply({ type: 'NEXT', hasMoreQuestions: false });
        this.finish();
        return;
      default:
        throw new RoomError('INVALID_STATE', 'Action impossible dans la phase actuelle');
    }
  }

  pause(): void {
    if (this.status !== 'QUESTION' || this.paused) {
      throw new RoomError('INVALID_STATE', 'Seule une question en cours peut être mise en pause');
    }
    this.clearTimer();
    this.pausedRemainingMs = Math.max(0, this.phaseEndsAt - Date.now());
    this.paused = true;
    this.touch();
    this.broadcast();
  }

  resume(): void {
    if (this.status !== 'QUESTION' || !this.paused) {
      throw new RoomError('INVALID_STATE', "La partie n'est pas en pause");
    }
    this.paused = false;
    // Décaler la fin de la question exclut naturellement la pause du temps de réponse.
    this.phaseEndsAt = Date.now() + this.pausedRemainingMs;
    this.schedule(() => this.endQuestion(), this.pausedRemainingMs);
    this.touch();
    this.broadcast();
  }

  /** Terminer la partie : annulation dans le lobby, podium immédiat en cours de jeu. */
  end(): void {
    const from = this.status;
    const to = this.apply({ type: 'END' });
    this.clearTimer();
    this.paused = false;

    if (from === 'LOBBY') {
      this.writer.cancelGame(this.gameId).catch((error: unknown) => {
        this.logger.error('[game] annulation non enregistrée', error);
      });
      this.transport.closeRoom("L'hôte a annulé la partie");
      this.onFinished?.(this);
      return;
    }
    if (to === 'PODIUM') {
      // Une question interrompue n'est pas notée : on ignore ses réponses.
      for (const player of this.players.values()) player.pending = null;
      this.showPodium();
      return;
    }
    this.finish();
  }

  /* ------------------------ Action des joueurs ---------------------- */

  submitAnswer(playerId: string, questionId: string, choiceId: string): void {
    const player = this.requirePlayer(playerId);
    const question = this.currentQuestion();

    if (this.status !== 'QUESTION' || !question || question.id !== questionId) {
      throw new RoomError('INVALID_STATE', "Cette question n'est plus ouverte");
    }
    if (this.paused) {
      throw new RoomError('PAUSED', 'La partie est en pause');
    }
    if (player.pending) {
      throw new RoomError('ALREADY_ANSWERED', 'Tu as déjà répondu à cette question');
    }
    if (!question.choices.some((choice) => choice.id === choiceId)) {
      throw new RoomError('VALIDATION', 'Réponse inconnue');
    }

    const limitMs = question.timeLimitSec * 1000;
    const remainingMs = this.phaseEndsAt - Date.now();
    const timeTakenMs = Math.min(Math.max(limitMs - remainingMs, 0), limitMs);
    player.pending = { choiceId, timeTakenMs };
    this.touch();

    if (this.everyoneAnswered()) {
      this.endQuestion();
      return;
    }
    // Seuls l'hôte (compteur de réponses) et le joueur concerné ont besoin d'une mise à jour.
    this.sendToPlayer(player);
    this.sendToHost();
  }

  /* --------------------------- Vues --------------------------------- */

  stateFor(target: StateTarget): GameStatePayload {
    const player = target.role === 'player' ? this.players.get(target.playerId) : undefined;
    return {
      gameId: this.gameId,
      code: this.code,
      quizTitle: this.snapshot.title,
      role: target.role,
      serverNow: Date.now(),
      me: player ? this.selfView(player) : null,
      view: this.view(player),
    };
  }

  /** Arrête les timers (fin de partie, arrêt du serveur, nettoyage). */
  dispose(): void {
    this.clearTimer();
  }

  /** Ferme la salle (inactivité, arrêt du serveur) en prévenant les clients connectés. */
  close(message: string): void {
    this.clearTimer();
    this.transport.closeRoom(message);
  }

  /* ------------------------ Mécanique interne ----------------------- */

  private apply(event: GameEvent): GameStatus {
    try {
      this.status = transition(this.status, event);
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new RoomError('INVALID_STATE', 'Action impossible dans la phase actuelle');
      }
      throw error;
    }
    this.touch();
    return this.status;
  }

  private beginCountdown(): void {
    this.phaseEndsAt = Date.now() + TIMING.countdownMs;
    for (const player of this.players.values()) player.pending = null;
    this.schedule(() => this.beginQuestion(), TIMING.countdownMs);
    this.broadcast();
  }

  private beginQuestion(): void {
    const question = this.requireCurrentQuestion();
    this.apply({ type: 'COUNTDOWN_ELAPSED' });
    this.paused = false;
    const limitMs = question.timeLimitSec * 1000;
    this.phaseEndsAt = Date.now() + limitMs;
    this.schedule(() => this.endQuestion(), limitMs);
    this.broadcast();
  }

  private endQuestion(): void {
    const question = this.requireCurrentQuestion();
    this.clearTimer();
    this.paused = false;
    this.apply({ type: 'QUESTION_ENDED' });

    const correctId = correctChoiceId(question);
    const limitMs = question.timeLimitSec * 1000;

    for (const player of this.players.values()) {
      const answer = player.pending;
      const isCorrect = answer?.choiceId === correctId;
      const timeTakenMs = answer?.timeTakenMs ?? limitMs;
      const score = computeScore({
        basePoints: question.basePoints,
        timeLimitMs: limitMs,
        timeTakenMs,
        isCorrect,
        previousStreak: player.streak,
      });

      player.score += score.points;
      player.streak = score.streak;
      if (isCorrect) {
        player.correctCount += 1;
        player.totalTimeMs += timeTakenMs;
      }
      player.results.set(question.id, {
        answered: answer !== null,
        isCorrect,
        points: score.points,
        streakBonus: score.streakBonus,
        streak: score.streak,
        choiceId: answer?.choiceId ?? null,
        timeTakenMs,
      });
      player.pending = null;
    }

    this.playedQuestionIds.push(question.id);
    this.broadcast();
  }

  private showLeaderboard(): void {
    this.leaderboard = this.snapshotRanking();
    this.broadcast();
  }

  private showPodium(): void {
    this.clearTimer();
    this.finalRanking = this.snapshotRanking();
    this.writer.saveFinishedGame(this.finishedGameData()).catch((error: unknown) => {
      this.logger.error('[game] résultats non enregistrés', error);
    });
    this.broadcast();
  }

  private finish(): void {
    this.clearTimer();
    this.broadcast();
    this.onFinished?.(this);
  }

  /** Classe les joueurs et mémorise leur rang pour animer le prochain classement. */
  private snapshotRanking(): RankedPlayer[] {
    const ranked = this.rank().map((entry) => {
      const player = this.requirePlayer(entry.id);
      return {
        id: entry.id,
        nickname: entry.nickname,
        score: entry.score,
        rank: entry.rank,
        previousRank: player.lastRank,
        streak: player.streak,
      };
    });
    for (const entry of ranked) this.requirePlayer(entry.id).lastRank = entry.rank;
    return ranked;
  }

  private finishedGameData(): FinishedGameData {
    const ranks = new Map(this.finalRanking.map((entry) => [entry.id, entry.rank]));
    const players = [...this.players.values()];
    return {
      gameId: this.gameId,
      endedAt: new Date(),
      players: players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        sessionToken: player.sessionToken,
        finalScore: player.score,
        finalRank: ranks.get(player.id) ?? players.length,
      })),
      answers: players.flatMap((player) =>
        this.playedQuestionIds.flatMap((questionId) => {
          const result = player.results.get(questionId);
          if (!result) return [];
          return [
            {
              playerId: player.id,
              questionId,
              choiceId: result.choiceId,
              isCorrect: result.isCorrect,
              timeTakenMs: result.timeTakenMs,
              pointsAwarded: result.points,
              streakAtTime: result.streak,
            },
          ];
        }),
      ),
    };
  }

  private view(player: RoomPlayer | undefined): GameView {
    const progress = {
      questionIndex: Math.max(this.questionIndex, 0),
      totalQuestions: this.snapshot.questions.length,
    };

    switch (this.status) {
      case 'LOBBY':
        return { status: 'LOBBY', players: this.lobbyPlayers() };

      case 'COUNTDOWN':
        return { status: 'COUNTDOWN', endsAt: this.phaseEndsAt, ...progress };

      case 'QUESTION': {
        const question = this.requireCurrentQuestion();
        return {
          status: 'QUESTION',
          question: toPublicQuestion(question),
          endsAt: this.phaseEndsAt,
          paused: this.paused,
          remainingMs: this.paused
            ? this.pausedRemainingMs
            : Math.max(0, this.phaseEndsAt - Date.now()),
          answeredCount: [...this.players.values()].filter((p) => p.pending).length,
          playerCount: this.players.size,
          myChoiceId: player?.pending?.choiceId ?? null,
          ...progress,
        };
      }

      case 'RESULTS': {
        const question = this.requireCurrentQuestion();
        const distribution: Record<string, number> = Object.fromEntries(
          question.choices.map((choice) => [choice.id, 0]),
        );
        let answeredCount = 0;
        for (const candidate of this.players.values()) {
          const choiceId = candidate.results.get(question.id)?.choiceId;
          if (choiceId) {
            distribution[choiceId] = (distribution[choiceId] ?? 0) + 1;
            answeredCount += 1;
          }
        }
        const result = player?.results.get(question.id);
        return {
          status: 'RESULTS',
          question: toPublicQuestion(question),
          correctChoiceId: correctChoiceId(question),
          distribution,
          answeredCount,
          playerCount: this.players.size,
          myChoiceId: result?.choiceId ?? null,
          myResult: result
            ? {
                answered: result.answered,
                isCorrect: result.isCorrect,
                points: result.points,
                streakBonus: result.streakBonus,
                streak: result.streak,
              }
            : null,
          ...progress,
        };
      }

      case 'LEADERBOARD':
        return {
          status: 'LEADERBOARD',
          top: this.leaderboard.slice(0, LEADERBOARD_SIZE),
          isLastQuestion: !this.hasMoreQuestions(),
          ...progress,
        };

      case 'PODIUM':
      case 'FINISHED':
        return {
          status: this.status,
          podium: this.finalRanking.filter((entry) => entry.rank <= 3).slice(0, 3),
          ranking: this.finalRanking,
        };
    }
  }

  private selfView(player: RoomPlayer): PlayerSelf {
    const rank = this.rank().find((entry) => entry.id === player.id)?.rank ?? this.players.size;
    return {
      id: player.id,
      nickname: player.nickname,
      score: player.score,
      rank,
      streak: player.streak,
      correctCount: player.correctCount,
    };
  }

  private lobbyPlayers(): LobbyPlayer[] {
    return [...this.players.values()].map((player) => ({
      id: player.id,
      nickname: player.nickname,
      connected: player.connections > 0,
    }));
  }

  private rank() {
    return rankPlayers(
      [...this.players.values()].map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        totalTimeMs: player.totalTimeMs,
      })),
    );
  }

  private everyoneAnswered(): boolean {
    const active = [...this.players.values()].filter((player) => player.connections > 0);
    return active.length > 0 && active.every((player) => player.pending !== null);
  }

  private hasMoreQuestions(): boolean {
    return this.questionIndex < this.snapshot.questions.length - 1;
  }

  private currentQuestion(): SnapshotQuestion | undefined {
    return this.snapshot.questions[this.questionIndex];
  }

  private requireCurrentQuestion(): SnapshotQuestion {
    const question = this.currentQuestion();
    if (!question) {
      throw new RoomError('INVALID_STATE', 'Aucune question en cours');
    }
    return question;
  }

  private requirePlayer(playerId: string): RoomPlayer {
    const player = this.players.get(playerId);
    if (!player) {
      throw new RoomError('NOT_FOUND', 'Joueur introuvable dans cette partie');
    }
    return player;
  }

  private broadcast(): void {
    this.sendToHost();
    for (const player of this.players.values()) this.sendToPlayer(player);
  }

  private sendToHost(): void {
    this.transport.sendState({ role: 'host' }, this.stateFor({ role: 'host' }));
  }

  private sendToPlayer(player: RoomPlayer): void {
    const target: StateTarget = { role: 'player', playerId: player.id };
    this.transport.sendState(target, this.stateFor(target));
  }

  private schedule(callback: () => void, delayMs: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        callback();
      } catch (error) {
        this.logger.error('[game] erreur dans un timer', error);
      }
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }
}
