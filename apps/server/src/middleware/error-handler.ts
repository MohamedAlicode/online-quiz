import type { ApiErrorBody } from '@quiz/shared';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route introuvable : ${req.method} ${req.path}`));
}

/** Convertit toute erreur en réponse JSON homogène `{ error: { code, message } }`. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  // JSON mal formé envoyé par le client
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Corps JSON invalide' } });
    return;
  }

  console.error('[api] erreur inattendue', err);
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL', message: 'Erreur interne du serveur' },
  };
  res.status(500).json(body);
}
