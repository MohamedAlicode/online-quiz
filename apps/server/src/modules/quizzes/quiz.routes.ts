import { questionInputSchema, quizInputSchema, reorderQuestionsSchema } from '@quiz/shared';
import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth';
import { routeParam } from '../../middleware/params';
import { validateBody } from '../../middleware/validate';
import * as quizService from './quiz.service';

export const quizRouter = Router();
quizRouter.use(requireAuth);

quizRouter.get('/', async (req, res) => {
  res.json({ quizzes: await quizService.listQuizzes(currentUserId(req)) });
});

quizRouter.post('/', validateBody(quizInputSchema), async (req, res) => {
  res.status(201).json({ quiz: await quizService.createQuiz(currentUserId(req), req.body) });
});

quizRouter.get('/:id', async (req, res) => {
  res.json({ quiz: await quizService.getQuiz(currentUserId(req), routeParam(req, 'id')) });
});

quizRouter.put('/:id', validateBody(quizInputSchema), async (req, res) => {
  res.json({
    quiz: await quizService.updateQuiz(currentUserId(req), routeParam(req, 'id'), req.body),
  });
});

quizRouter.delete('/:id', async (req, res) => {
  await quizService.deleteQuiz(currentUserId(req), routeParam(req, 'id'));
  res.status(204).end();
});

quizRouter.post('/:id/duplicate', async (req, res) => {
  res
    .status(201)
    .json({ quiz: await quizService.duplicateQuiz(currentUserId(req), routeParam(req, 'id')) });
});

quizRouter.post('/:id/questions', validateBody(questionInputSchema), async (req, res) => {
  const question = await quizService.addQuestion(
    currentUserId(req),
    routeParam(req, 'id'),
    req.body,
  );
  res.status(201).json({ question });
});

quizRouter.put('/:id/questions/reorder', validateBody(reorderQuestionsSchema), async (req, res) => {
  const quiz = await quizService.reorderQuestions(
    currentUserId(req),
    routeParam(req, 'id'),
    req.body.questionIds,
  );
  res.json({ quiz });
});

export const questionRouter = Router();
questionRouter.use(requireAuth);

questionRouter.put('/:id', validateBody(questionInputSchema), async (req, res) => {
  const question = await quizService.updateQuestion(
    currentUserId(req),
    routeParam(req, 'id'),
    req.body,
  );
  res.json({ question });
});

questionRouter.delete('/:id', async (req, res) => {
  await quizService.deleteQuestion(currentUserId(req), routeParam(req, 'id'));
  res.status(204).end();
});
