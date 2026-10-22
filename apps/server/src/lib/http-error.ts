/** Erreur métier convertie en réponse HTTP par le middleware d'erreurs. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentification requise') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Action non autorisée') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Ressource introuvable') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new HttpError(409, 'CONFLICT', message);
  }
}
