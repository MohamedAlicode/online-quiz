import type { QuestionDto, QuizDto, QuizSummaryDto } from '@quiz/shared';
import type { Choice, Question, Quiz } from '../../generated/prisma/client';

type QuestionWithChoices = Question & { choices: Choice[] };
type QuizWithQuestions = Quiz & { questions: QuestionWithChoices[] };

export function toQuestionDto(question: QuestionWithChoices): QuestionDto {
  return {
    id: question.id,
    quizId: question.quizId,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl,
    timeLimitSec: question.timeLimitSec,
    basePoints: question.basePoints,
    position: question.position,
    choices: [...question.choices]
      .sort((a, b) => a.position - b.position)
      .map((choice) => ({
        id: choice.id,
        text: choice.text,
        isCorrect: choice.isCorrect,
        position: choice.position,
      })),
  };
}

export function toQuizSummaryDto(quiz: Quiz, questionCount: number): QuizSummaryDto {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    coverUrl: quiz.coverUrl,
    isPublic: quiz.isPublic,
    questionCount,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
  };
}

export function toQuizDto(quiz: QuizWithQuestions): QuizDto {
  const questions = [...quiz.questions].sort((a, b) => a.position - b.position).map(toQuestionDto);
  return { ...toQuizSummaryDto(quiz, questions.length), questions };
}
