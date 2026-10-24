import type { PracticeQuizDto, QuizTemplateDto } from '@quiz/shared';
import { HttpError } from '../../lib/http-error';
import {
  buildTemplateItems,
  findTemplate,
  TEMPLATES,
  toTemplateDto,
  type Random,
} from '../templates/templates';

export function listPracticeTemplates(): QuizTemplateDto[] {
  return TEMPLATES.map(toTemplateDto);
}

/**
 * Quiz d'entraînement en solo, sans compte. Contrairement aux parties en direct, les bonnes
 * réponses sont envoyées au navigateur : il n'y a ni adversaire ni classement à protéger,
 * et le joueur voit la correction immédiatement après chaque question.
 */
export function buildPracticeQuiz(slug: string, random: Random = Math.random): PracticeQuizDto {
  const template = findTemplate(slug);
  if (!template) {
    throw HttpError.notFound('Quiz introuvable');
  }
  return {
    title: template.title,
    description: template.description,
    questions: buildTemplateItems(template, random).map(({ question, explanation }, index) => ({
      id: `q${index + 1}`,
      text: question.text,
      imageUrl: question.imageUrl,
      timeLimitSec: question.timeLimitSec,
      basePoints: question.basePoints,
      choices: question.choices.map((choice, choiceIndex) => ({
        id: `q${index + 1}-c${choiceIndex + 1}`,
        text: choice.text,
        isCorrect: choice.isCorrect,
      })),
      explanation,
    })),
  };
}
