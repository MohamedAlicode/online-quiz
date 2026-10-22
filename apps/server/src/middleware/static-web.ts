import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';

/**
 * Sert le front React construit (fichiers statiques + repli sur index.html pour les routes
 * de l'application). Permet de déployer le site et l'API sur un seul service, à la même
 * adresse : pas de CORS à configurer et le WebSocket utilise la même origine.
 *
 * Retourne `null` si le dossier ne contient pas de build.
 */
export function staticWeb(distPath: string): Router | null {
  const indexHtml = join(distPath, 'index.html');
  if (!existsSync(indexHtml)) {
    console.warn(`[web] ${indexHtml} introuvable : le front ne sera pas servi.`);
    return null;
  }

  const router = express.Router();
  router.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        // Les fichiers de /assets ont une empreinte dans leur nom : cache long et immuable.
        if (filePath.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // Toute autre page GET (hors API) renvoie l'application : React Router prend le relais.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  return router;
}
