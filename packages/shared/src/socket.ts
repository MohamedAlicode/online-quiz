/**
 * Contrat temps réel entre le front et le serveur (Socket.IO).
 *
 * Choix d'architecture : le serveur diffuse l'état complet de la partie dans un seul
 * événement typé, `game:state`, à chaque transition. Chaque destinataire reçoit une vue
 * adaptée à son rôle (l'hôte voit le nombre de réponses, le joueur voit son résultat).
 * Avantage : un joueur qui se reconnecte reçoit simplement l'état courant, sans rejouer
 * d'historique d'événements.
 */
import { z } from 'zod';
import { GAME_CODE_REGEX, LIMITS } from './constants';
import type { QuestionType } from './schemas/quiz';

/* ------------------------------------------------------------------ */
/* Schémas des événements entrants (validés côté serveur avec Zod)      */
/* ------------------------------------------------------------------ */

export const nicknameSchema = z
  .string()
  .trim()
  .min(LIMITS.nicknameMin, `Pseudo trop court (${LIMITS.nicknameMin} caractères minimum)`)
  .max(LIMITS.nicknameMax, `Pseudo trop long (${LIMITS.nicknameMax} caractères maximum)`)
  .regex(/^[\p{L}\p{N} _.'-]+$/u, 'Le pseudo contient des caractères non autorisés');

export const joinGameSchema = z.object({
  code: z.string().trim().regex(GAME_CODE_REGEX, 'Le code doit contenir 6 chiffres'),
  nickname: nicknameSchema,
});

export const rejoinGameSchema = z.object({
  sessionToken: z.string().min(16).max(128),
});

export const answerSchema = z.object({
  questionId: z.string().min(1).max(64),
  choiceId: z.string().min(1).max(64),
});

export const createGameSchema = z.object({
  quizId: z.uuid(),
});

export const hostRejoinSchema = z.object({
  gameId: z.uuid(),
});

export const kickPlayerSchema = z.object({
  playerId: z.string().min(1).max(64),
});

export const emptyPayloadSchema = z.object({}).strict();

export type JoinGamePayload = z.infer<typeof joinGameSchema>;
export type RejoinGamePayload = z.infer<typeof rejoinGameSchema>;
export type AnswerPayload = z.infer<typeof answerSchema>;
export type CreateGamePayload = z.infer<typeof createGameSchema>;
export type HostRejoinPayload = z.infer<typeof hostRejoinSchema>;
export type KickPlayerPayload = z.infer<typeof kickPlayerSchema>;
export type EmptyPayload = Record<string, never>;

/* ------------------------------------------------------------------ */
/* Accusés de réception                                                */
/* ------------------------------------------------------------------ */

export type SocketErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'GAME_NOT_FOUND'
  | 'GAME_STARTED'
  | 'GAME_FULL'
  | 'NICKNAME_TAKEN'
  | 'NO_QUESTIONS'
  | 'NO_PLAYERS'
  | 'INVALID_STATE'
  | 'ALREADY_ANSWERED'
  | 'PAUSED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface SocketError {
  code: SocketErrorCode;
  message: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: SocketError };
export type AckCallback<T> = (response: Ack<T>) => void;

/* ------------------------------------------------------------------ */
/* Vues de la partie (serveur → client)                                */
/* ------------------------------------------------------------------ */

/** Question telle qu'envoyée aux clients : jamais la bonne réponse avant la fin. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  timeLimitSec: number;
  basePoints: number;
  choices: { id: string; text: string }[];
}

export interface LobbyPlayer {
  id: string;
  nickname: string;
  connected: boolean;
}

export interface RankedPlayer {
  id: string;
  nickname: string;
  score: number;
  rank: number;
  /** Rang au classement précédent (null au premier classement), pour animer les changements. */
  previousRank: number | null;
  streak: number;
}

export interface PlayerQuestionResult {
  answered: boolean;
  isCorrect: boolean;
  points: number;
  streakBonus: number;
  streak: number;
}

export interface PlayerSelf {
  id: string;
  nickname: string;
  score: number;
  rank: number;
  streak: number;
  correctCount: number;
}

interface QuestionProgress {
  questionIndex: number;
  totalQuestions: number;
}

export type GameView =
  | { status: 'LOBBY'; players: LobbyPlayer[] }
  | ({ status: 'COUNTDOWN'; endsAt: number } & QuestionProgress)
  | ({
      status: 'QUESTION';
      question: PublicQuestion;
      /** Horodatage serveur de fin (ms). Sans objet si `paused`. */
      endsAt: number;
      paused: boolean;
      remainingMs: number;
      answeredCount: number;
      playerCount: number;
      /** Choix du joueur courant (vue joueur uniquement). */
      myChoiceId: string | null;
    } & QuestionProgress)
  | ({
      status: 'RESULTS';
      question: PublicQuestion;
      correctChoiceId: string;
      /** Nombre de réponses par identifiant de choix. */
      distribution: Record<string, number>;
      answeredCount: number;
      playerCount: number;
      myChoiceId: string | null;
      myResult: PlayerQuestionResult | null;
    } & QuestionProgress)
  | ({ status: 'LEADERBOARD'; top: RankedPlayer[]; isLastQuestion: boolean } & QuestionProgress)
  | { status: 'PODIUM'; podium: RankedPlayer[]; ranking: RankedPlayer[] }
  | { status: 'FINISHED'; podium: RankedPlayer[]; ranking: RankedPlayer[] };

export type GameViewStatus = GameView['status'];

export interface GameStatePayload {
  gameId: string;
  code: string;
  quizTitle: string;
  role: 'host' | 'player';
  /** Heure du serveur à l'émission, pour corriger le décalage d'horloge du client. */
  serverNow: number;
  /** Informations du joueur courant (null pour l'hôte). */
  me: PlayerSelf | null;
  view: GameView;
}

export interface JoinedGame {
  gameId: string;
  playerId: string;
  nickname: string;
  sessionToken: string;
}

export interface CreatedGame {
  gameId: string;
  code: string;
}

/* ------------------------------------------------------------------ */
/* Typage des événements Socket.IO                                     */
/* ------------------------------------------------------------------ */

export interface ClientToServerEvents {
  'host:create-game': (payload: CreateGamePayload, ack: AckCallback<CreatedGame>) => void;
  'host:rejoin': (payload: HostRejoinPayload, ack: AckCallback<CreatedGame>) => void;
  'host:start-game': (payload: EmptyPayload, ack: AckCallback<null>) => void;
  'host:next': (payload: EmptyPayload, ack: AckCallback<null>) => void;
  'host:pause': (payload: EmptyPayload, ack: AckCallback<null>) => void;
  'host:resume': (payload: EmptyPayload, ack: AckCallback<null>) => void;
  'host:end-game': (payload: EmptyPayload, ack: AckCallback<null>) => void;
  'host:kick-player': (payload: KickPlayerPayload, ack: AckCallback<null>) => void;
  'player:join': (payload: JoinGamePayload, ack: AckCallback<JoinedGame>) => void;
  'player:rejoin': (payload: RejoinGamePayload, ack: AckCallback<JoinedGame>) => void;
  'player:answer': (payload: AnswerPayload, ack: AckCallback<{ received: true }>) => void;
}

export interface ServerToClientEvents {
  'game:state': (payload: GameStatePayload) => void;
  'player:kicked': (payload: { message: string }) => void;
  'game:closed': (payload: { message: string }) => void;
}
