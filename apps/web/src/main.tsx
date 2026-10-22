import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RequireAuth } from './components/RequireAuth';
import { Spinner } from './components/ui';
import './index.css';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlayPage } from './pages/PlayPage';

/*
 * Les écrans joueur (accueil, partie) sont chargés immédiatement : ce sont eux qu'on ouvre
 * sur un téléphone, souvent avec un réseau moyen. Les écrans de l'hôte sont chargés à la
 * demande (code splitting) pour alléger le premier chargement.
 */
function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner label="Chargement…" />
    </div>
  );
}

const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/play', element: <PlayPage /> },
  {
    path: '/login',
    lazy: async () => {
      const { AuthPage } = await import('./pages/AuthPage');
      return { element: <AuthPage mode="login" /> };
    },
  },
  {
    path: '/register',
    lazy: async () => {
      const { AuthPage } = await import('./pages/AuthPage');
      return { element: <AuthPage mode="register" /> };
    },
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/host/game/:gameId',
        lazy: async () => ({ Component: (await import('./pages/HostGamePage')).HostGamePage }),
      },
      {
        lazy: async () => ({ Component: (await import('./components/HostLayout')).HostLayout }),
        children: [
          {
            path: '/host',
            lazy: async () => ({
              Component: (await import('./pages/DashboardPage')).DashboardPage,
            }),
          },
          {
            path: '/host/quizzes/:quizId',
            lazy: async () => ({
              Component: (await import('./pages/QuizEditorPage')).QuizEditorPage,
            }),
          },
          {
            path: '/host/quizzes/:quizId/preview',
            lazy: async () => ({
              Component: (await import('./pages/QuizPreviewPage')).QuizPreviewPage,
            }),
          },
          {
            path: '/host/history',
            lazy: async () => ({ Component: (await import('./pages/HistoryPage')).HistoryPage }),
          },
          {
            path: '/host/history/:gameId',
            lazy: async () => ({ Component: (await import('./pages/ResultsPage')).ResultsPage }),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

// La route racine affiche un indicateur pendant le chargement d'un écran chargé à la demande.
const router = createBrowserRouter([{ HydrateFallback: RouteLoading, children: routes }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user" : Framer Motion respecte le réglage système de l'utilisateur. */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
);
