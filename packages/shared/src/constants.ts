/** Limites métier partagées entre le front et le serveur. */
export const LIMITS = {
  nicknameMin: 2,
  nicknameMax: 20,
  passwordMin: 8,
  quizTitleMax: 120,
  quizDescriptionMax: 500,
  questionTextMax: 300,
  choiceTextMax: 120,
  minChoices: 2,
  maxChoices: 4,
  timeLimitMinSec: 5,
  timeLimitMaxSec: 60,
  defaultTimeLimitSec: 20,
  maxQuestionsPerQuiz: 50,
  maxPlayersPerGame: 100,
} as const;

/** Valeurs de points proposées : standard, double, aucun. */
export const BASE_POINTS_OPTIONS = [1000, 2000, 0] as const;
export type BasePoints = (typeof BASE_POINTS_OPTIONS)[number];

export const SCORING = {
  /** Bonus ajouté par bonne réponse consécutive (à partir de la 2e). */
  streakBonusStep: 100,
  /** Plafond du bonus de série. */
  streakBonusMax: 500,
} as const;

export const TIMING = {
  /** Durée du compte à rebours 3, 2, 1 avant chaque question. */
  countdownMs: 3000,
  /** Enchaînement automatique : temps d'affichage de la bonne réponse avant la suite. */
  autoAdvanceMs: 5000,
} as const;

/** Nombre de joueurs affichés dans le classement intermédiaire. */
export const LEADERBOARD_SIZE = 5;

/** Un code de partie : exactement 6 chiffres. */
export const GAME_CODE_REGEX = /^\d{6}$/;
