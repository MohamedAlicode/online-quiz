import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error';
import { verifyToken } from '../lib/jwt';

/** Vérifie le jeton `Authorization: Bearer <jwt>` et expose `req.userId`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const userId = token ? verifyToken(token) : null;

  if (!userId) {
    next(HttpError.unauthorized());
    return;
  }
  req.userId = userId;
  next();
}

/** Récupère l'utilisateur courant dans une route protégée par `requireAuth`. */
export function currentUserId(req: Request): string {
  if (!req.userId) {
    throw HttpError.unauthorized();
  }
  return req.userId;
}
