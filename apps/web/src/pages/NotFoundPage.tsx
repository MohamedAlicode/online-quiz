import { Link } from 'react-router';
import { Logo } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 sm:px-16">
      <Logo />
      <p
        className="numerals text-[8rem] leading-none font-black text-stage"
        style={{ ['--wdth' as string]: 150 }}
      >
        404
      </p>
      <h1 className="font-display text-3xl font-extrabold">Cette page n’existe pas</h1>
      <Link to="/" className="rounded-xl bg-stage px-5 py-3 font-bold text-white">
        Retour à l’accueil
      </Link>
    </div>
  );
}
