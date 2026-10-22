import type {
  GameResultsDto,
  GameSummaryDto,
  ResultsQuestionStat,
  ResultsRankingRow,
} from '@quiz/shared';
import type { GameSnapshot } from '../../game/snapshot';

export interface ResultsPlayer {
  nickname: string;
  finalScore: number;
  finalRank: number | null;
  answers: {
    questionId: string;
    choiceId: string | null;
    isCorrect: boolean;
    timeTakenMs: number;
  }[];
}

/**
 * Calcule les statistiques d'une partie terminée à partir des données brutes.
 * Fonction pure, testée indépendamment de la base de données.
 */
export function buildResults(
  game: GameSummaryDto,
  snapshot: GameSnapshot,
  players: ResultsPlayer[],
): GameResultsDto {
  const ranking: ResultsRankingRow[] = players
    .map((player) => ({
      rank: player.finalRank ?? players.length,
      nickname: player.nickname,
      score: player.finalScore,
      correctCount: player.answers.filter((answer) => answer.isCorrect).length,
      answeredCount: player.answers.filter((answer) => answer.choiceId !== null).length,
    }))
    .sort((a, b) => a.rank - b.rank || b.score - a.score || a.nickname.localeCompare(b.nickname));

  const allAnswers = players.flatMap((player) => player.answers);
  // Seules les questions réellement jouées ont des réponses enregistrées.
  const playedIds = new Set(allAnswers.map((answer) => answer.questionId));

  const questions: ResultsQuestionStat[] = snapshot.questions
    .map((question, position) => ({ question, position }))
    .filter(({ question }) => playedIds.has(question.id))
    .map(({ question, position }) => {
      const answers = allAnswers.filter((answer) => answer.questionId === question.id);
      const answered = answers.filter((answer) => answer.choiceId !== null);
      const correct = answers.filter((answer) => answer.isCorrect);
      const totalTime = answered.reduce((sum, answer) => sum + answer.timeTakenMs, 0);

      return {
        id: question.id,
        position,
        text: question.text,
        answeredCount: answered.length,
        correctCount: correct.length,
        successRate: players.length > 0 ? correct.length / players.length : 0,
        averageTimeMs: answered.length > 0 ? Math.round(totalTime / answered.length) : null,
        choices: question.choices.map((choice) => ({
          choiceId: choice.id,
          text: choice.text,
          isCorrect: choice.isCorrect,
          count: answers.filter((answer) => answer.choiceId === choice.id).length,
        })),
      };
    });

  const hardestQuestionIds = [...questions]
    .sort((a, b) => a.successRate - b.successRate || a.position - b.position)
    .slice(0, 3)
    .map((question) => question.id);

  return { game, ranking, questions, hardestQuestionIds };
}

function csvCell(value: string | number): string {
  const text = String(value);
  // Protège contre l'injection de formules dans les tableurs (=, +, -, @).
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Export CSV (RFC 4180) : une ligne par joueur, une colonne par question jouée. */
export function resultsToCsv(results: GameResultsDto, players: ResultsPlayer[]): string {
  const header = [
    'Rang',
    'Pseudo',
    'Score',
    'Bonnes réponses',
    ...results.questions.map((question) => `Q${question.position + 1}`),
  ];

  const byNickname = new Map(players.map((player) => [player.nickname, player]));
  const rows = results.ranking.map((row) => {
    const answers = byNickname.get(row.nickname)?.answers ?? [];
    const perQuestion = results.questions.map((question) => {
      const answer = answers.find((candidate) => candidate.questionId === question.id);
      if (!answer || answer.choiceId === null) return 'sans réponse';
      return answer.isCorrect ? 'juste' : 'faux';
    });
    return [row.rank, row.nickname, row.score, row.correctCount, ...perQuestion];
  });

  // BOM UTF-8 pour que les tableurs affichent correctement les accents.
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
