import { z } from 'zod';
import { BASE_POINTS_OPTIONS, LIMITS } from '../constants';

const optionalUrl = z
  .union([z.url('URL invalide'), z.literal('')])
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const quizInputSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(LIMITS.quizTitleMax),
  description: z.string().trim().max(LIMITS.quizDescriptionMax).default(''),
  coverUrl: optionalUrl,
  isPublic: z.boolean().default(false),
});

export const questionTypeSchema = z.enum(['SINGLE', 'TRUE_FALSE']);

export const choiceInputSchema = z.object({
  text: z.string().trim().min(1, 'Une réponse ne peut pas être vide').max(LIMITS.choiceTextMax),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    type: questionTypeSchema.default('SINGLE'),
    text: z.string().trim().min(1, "L'intitulé est obligatoire").max(LIMITS.questionTextMax),
    imageUrl: optionalUrl,
    timeLimitSec: z
      .number()
      .int()
      .min(LIMITS.timeLimitMinSec)
      .max(LIMITS.timeLimitMaxSec)
      .default(LIMITS.defaultTimeLimitSec),
    basePoints: z
      .number()
      .refine((value) => (BASE_POINTS_OPTIONS as readonly number[]).includes(value), {
        message: 'Points de base invalides (1000, 2000 ou 0)',
      })
      .default(1000),
    choices: z.array(choiceInputSchema).min(LIMITS.minChoices).max(LIMITS.maxChoices),
  })
  .superRefine((question, ctx) => {
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'Il faut exactement une bonne réponse',
      });
    }
    if (question.type === 'TRUE_FALSE' && question.choices.length !== 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'Une question vrai/faux a exactement deux réponses',
      });
    }
  });

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.uuid()).min(1),
});

/** Données saisies (valeurs par défaut optionnelles), côté formulaire. */
export type QuizInput = z.input<typeof quizInputSchema>;
export type QuestionInput = z.input<typeof questionInputSchema>;
/** Données validées et normalisées, côté serveur. */
export type QuizData = z.output<typeof quizInputSchema>;
export type QuestionData = z.output<typeof questionInputSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
