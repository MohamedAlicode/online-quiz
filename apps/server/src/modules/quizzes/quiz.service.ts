import {
  LIMITS,
  type QuestionData,
  type QuestionDto,
  type QuizData,
  type QuizDto,
  type QuizSummaryDto,
} from '@quiz/shared';
import { HttpError } from '../../lib/http-error';
import { prisma } from '../../lib/prisma';
import { toQuestionDto, toQuizDto, toQuizSummaryDto } from './quiz.mapper';

const withQuestions = {
  questions: { orderBy: { position: 'asc' as const }, include: { choices: true } },
};

/**
 * Charge un quiz en vérifiant les droits.
 * - lecture : propriétaire, ou n'importe quel hôte si le quiz est public ;
 * - écriture : propriétaire uniquement.
 * Un quiz privé d'un autre hôte renvoie 404 pour ne pas révéler son existence.
 */
async function findQuizForUser(userId: string, quizId: string, access: 'read' | 'write') {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: withQuestions });
  if (!quiz || (quiz.ownerId !== userId && !quiz.isPublic)) {
    throw HttpError.notFound('Quiz introuvable');
  }
  if (access === 'write' && quiz.ownerId !== userId) {
    throw HttpError.forbidden('Seul le créateur du quiz peut le modifier');
  }
  return quiz;
}

async function findQuestionForOwner(userId: string, questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: true },
  });
  if (!question || question.quiz.ownerId !== userId) {
    throw HttpError.notFound('Question introuvable');
  }
  return question;
}

/** Met à jour `updatedAt` du quiz quand ses questions changent. */
async function touchQuiz(quizId: string) {
  await prisma.quiz.update({ where: { id: quizId }, data: { updatedAt: new Date() } });
}

function choicesData(input: QuestionData) {
  return input.choices.map((choice, position) => ({
    text: choice.text,
    isCorrect: choice.isCorrect,
    position,
  }));
}

export async function listQuizzes(userId: string): Promise<QuizSummaryDto[]> {
  const quizzes = await prisma.quiz.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  });
  return quizzes.map((quiz) => toQuizSummaryDto(quiz, quiz._count.questions));
}

export async function getQuiz(userId: string, quizId: string): Promise<QuizDto> {
  return toQuizDto(await findQuizForUser(userId, quizId, 'read'));
}

export async function createQuiz(userId: string, input: QuizData): Promise<QuizDto> {
  const quiz = await prisma.quiz.create({
    data: { ...input, ownerId: userId },
    include: withQuestions,
  });
  return toQuizDto(quiz);
}

export async function updateQuiz(
  userId: string,
  quizId: string,
  input: QuizData,
): Promise<QuizDto> {
  await findQuizForUser(userId, quizId, 'write');
  const quiz = await prisma.quiz.update({
    where: { id: quizId },
    data: input,
    include: withQuestions,
  });
  return toQuizDto(quiz);
}

export async function deleteQuiz(userId: string, quizId: string): Promise<void> {
  await findQuizForUser(userId, quizId, 'write');
  await prisma.quiz.delete({ where: { id: quizId } });
}

/** Copie un quiz (le sien ou un quiz public) avec toutes ses questions. La copie est privée. */
export async function duplicateQuiz(userId: string, quizId: string): Promise<QuizDto> {
  const source = await findQuizForUser(userId, quizId, 'read');
  const copy = await prisma.quiz.create({
    data: {
      ownerId: userId,
      title: `${source.title} (copie)`.slice(0, LIMITS.quizTitleMax),
      description: source.description,
      coverUrl: source.coverUrl,
      isPublic: false,
      questions: {
        create: source.questions.map((question) => ({
          type: question.type,
          text: question.text,
          imageUrl: question.imageUrl,
          timeLimitSec: question.timeLimitSec,
          basePoints: question.basePoints,
          position: question.position,
          choices: {
            create: question.choices.map(({ text, isCorrect, position }) => ({
              text,
              isCorrect,
              position,
            })),
          },
        })),
      },
    },
    include: withQuestions,
  });
  return toQuizDto(copy);
}

export async function addQuestion(
  userId: string,
  quizId: string,
  input: QuestionData,
): Promise<QuestionDto> {
  const quiz = await findQuizForUser(userId, quizId, 'write');
  if (quiz.questions.length >= LIMITS.maxQuestionsPerQuiz) {
    throw HttpError.badRequest(`Un quiz est limité à ${LIMITS.maxQuestionsPerQuiz} questions`);
  }

  const lastPosition = quiz.questions.at(-1)?.position ?? -1;
  const question = await prisma.question.create({
    data: {
      quizId,
      type: input.type,
      text: input.text,
      imageUrl: input.imageUrl,
      timeLimitSec: input.timeLimitSec,
      basePoints: input.basePoints,
      position: lastPosition + 1,
      choices: { create: choicesData(input) },
    },
    include: { choices: true },
  });
  await touchQuiz(quizId);
  return toQuestionDto(question);
}

export async function updateQuestion(
  userId: string,
  questionId: string,
  input: QuestionData,
): Promise<QuestionDto> {
  const existing = await findQuestionForOwner(userId, questionId);

  // Les réponses sont remplacées en bloc dans une transaction : plus simple et sans état
  // intermédiaire incohérent (une question sans bonne réponse, par exemple).
  const question = await prisma.$transaction(async (tx) => {
    await tx.choice.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: {
        type: input.type,
        text: input.text,
        imageUrl: input.imageUrl,
        timeLimitSec: input.timeLimitSec,
        basePoints: input.basePoints,
        choices: { create: choicesData(input) },
      },
      include: { choices: true },
    });
  });
  await touchQuiz(existing.quizId);
  return toQuestionDto(question);
}

export async function deleteQuestion(userId: string, questionId: string): Promise<void> {
  const existing = await findQuestionForOwner(userId, questionId);

  await prisma.$transaction(async (tx) => {
    await tx.question.delete({ where: { id: questionId } });
    // On renumérote pour garder des positions continues (0, 1, 2…).
    const remaining = await tx.question.findMany({
      where: { quizId: existing.quizId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    for (const [position, { id }] of remaining.entries()) {
      await tx.question.update({ where: { id }, data: { position } });
    }
  });
  await touchQuiz(existing.quizId);
}

export async function reorderQuestions(
  userId: string,
  quizId: string,
  questionIds: string[],
): Promise<QuizDto> {
  const quiz = await findQuizForUser(userId, quizId, 'write');
  const currentIds = new Set(quiz.questions.map((question) => question.id));
  const sameSet =
    questionIds.length === currentIds.size &&
    new Set(questionIds).size === questionIds.length &&
    questionIds.every((id) => currentIds.has(id));

  if (!sameSet) {
    throw HttpError.badRequest('La liste doit contenir exactement les questions du quiz');
  }

  await prisma.$transaction(
    questionIds.map((id, position) =>
      prisma.question.update({ where: { id }, data: { position } }),
    ),
  );
  await touchQuiz(quizId);
  return getQuiz(userId, quizId);
}
