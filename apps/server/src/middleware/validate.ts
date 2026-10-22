import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { HttpError } from '../lib/http-error';

export function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Valide `req.body` avec un schéma Zod et le remplace par la version nettoyée. */
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = formatZodIssues(parsed.error);
      next(new HttpError(400, 'VALIDATION', issues[0]?.message ?? 'Données invalides', { issues }));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
