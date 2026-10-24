/**
 * Objets échangés par l'API REST. Les dates sont sérialisées en chaînes ISO 8601.
 */
import type { QuestionType } from './schemas/quiz';

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface ChoiceDto {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface QuestionDto {
  id: string;
  quizId: string;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  timeLimitSec: number;
  basePoints: number;
  position: number;
  choices: ChoiceDto[];
}

export interface QuizSummaryDto {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  isPublic: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDto extends QuizSummaryDto {
  questions: QuestionDto[];
}

export type GameStatusDto =
  'LOBBY' | 'COUNTDOWN' | 'QUESTION' | 'RESULTS' | 'LEADERBOARD' | 'PODIUM' | 'FINISHED';

export interface GameSummaryDto {
  id: string;
  quizTitle: string;
  code: string;
  status: GameStatusDto;
  startedAt: string;
  endedAt: string | null;
  playerCount: number;
}

export interface ResultsRankingRow {
  rank: number;
  nickname: string;
  score: number;
  correctCount: number;
  answeredCount: number;
}

export interface ResultsChoiceStat {
  choiceId: string;
  text: string;
  isCorrect: boolean;
  count: number;
}

export interface ResultsQuestionStat {
  id: string;
  position: number;
  text: string;
  answeredCount: number;
  correctCount: number;
  /** Taux de réussite entre 0 et 1, calculé sur l'ensemble des joueurs. */
  successRate: number;
  averageTimeMs: number | null;
  choices: ResultsChoiceStat[];
}

export interface GameResultsDto {
  game: GameSummaryDto;
  ranking: ResultsRankingRow[];
  questions: ResultsQuestionStat[];
  /** Identifiants des questions les plus ratées (taux de réussite croissant, 3 maximum). */
  hardestQuestionIds: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Quiz prêt à jouer proposé à tous les hôtes (drapeaux, capitales…). */
export interface QuizTemplateDto {
  slug: string;
  title: string;
  description: string;
  /** Nombre de questions tirées au hasard à chaque ajout. */
  questionCount: number;
  /** Quelques images représentatives, pour l'aperçu dans la bibliothèque. */
  previewImages: string[];
}
