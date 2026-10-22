import { loginSchema, registerSchema } from '@quiz/shared';
import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  res.status(201).json(await authService.register(req.body));
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  res.json(await authService.login(req.body));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await authService.getMe(currentUserId(req)) });
});
