import type { QuizDto, QuizTemplateDto } from '@quiz/shared';
import { HttpError } from '../../lib/http-error';
import { createQuizWithQuestions } from '../quizzes/quiz.service';
import {
  buildTemplateQuestions,
  findTemplate,
  TEMPLATES,
  toTemplateDto,
  type Random,
} from './templates';

export function listTemplates(): QuizTemplateDto[] {
  return TEMPLATES.map(toTemplateDto);
}

/**
 * Copie un quiz prêt à jouer dans le compte de l'hôte. Les pays sont tirés au hasard à chaque
 * ajout : deux copies du même modèle donnent deux parties différentes. L'hôte peut ensuite
 * modifier sa copie comme n'importe quel autre quiz.
 */
export async function importTemplate(
  userId: string,
  slug: string,
  random: Random = Math.random,
): Promise<QuizDto> {
  const template = findTemplate(slug);
  if (!template) {
    throw HttpError.notFound('Quiz prêt à jouer introuvable');
  }
  return createQuizWithQuestions(
    userId,
    { title: template.title, description: template.description, coverUrl: null },
    buildTemplateQuestions(template, random),
  );
}
