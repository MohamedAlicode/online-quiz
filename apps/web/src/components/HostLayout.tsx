import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router';
import { useAuthStore } from '../stores/auth-store';
import { Logo } from './ui';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 font-bold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-line/60'}`;

/** Gabarit des écrans de gestion de l'hôte (quiz, historique). */
export function HostLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  // On fige le contenu de la page sortante : sans cela, la page qui disparaît afficherait
  // déjà la nouvelle route pendant l'animation de sortie.
  const outlet = useOutlet();

  return (
    <div className="min-h-dvh">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/host" aria-label="Quiz Live, mes quiz">
            <Logo />
          </Link>
          <nav aria-label="Navigation hôte" className="flex gap-1">
            <NavLink to="/host" end className={navClass}>
              Mes quiz
            </NavLink>
            <NavLink to="/host/history" className={navClass}>
              Historique
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-soft sm:inline">{user?.displayName}</span>
            <button
              type="button"
              className="rounded-lg px-3 py-2 font-bold hover:bg-line/60"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          id="contenu"
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mx-auto max-w-5xl px-4 py-8 sm:py-10"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
