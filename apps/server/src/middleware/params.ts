import type { Request } from 'express';
import { HttpError } from '../lib/http-error';

/** Lit un paramètre de route en garantissant une chaîne non vide. */
export function routeParam(req: Request, name: string): string {
  const value: unknown = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw HttpError.badRequest(`Paramètre « ${name} » manquant`);
  }
  return value;
}
