declare global {
  namespace Express {
    interface Request {
      /** Identifiant de l'hôte authentifié, renseigné par le middleware `requireAuth`. */
      userId?: string;
    }
  }
}

export {};
