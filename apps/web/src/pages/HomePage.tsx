import { joinGameSchema } from '@quiz/shared';
import { motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert, Button, Logo } from '../components/ui';
import { savePlayerSession } from '../lib/player-session';
import { getSocket, request } from '../lib/socket';
import { useAuthStore } from '../stores/auth-store';

export function HomePage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [code, setCode] = useState(() => (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6));
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = joinGameSchema.safeParse({ code, nickname });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Vérifie le code et le pseudo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const joined = await request(getSocket(token), 'player:join', parsed.data);
      savePlayerSession(joined);
      navigate('/play');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de rejoindre la partie');
      setBusy(false);
    }
  }

  return (
    <div className="on-stage flex min-h-dvh flex-col bg-stage text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <Link
          to={token ? '/host' : '/login'}
          className="rounded-lg px-3 py-2 font-bold underline-offset-4 hover:underline"
        >
          Animer une partie
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-16">
        <motion.form
          onSubmit={handleSubmit}
          noValidate
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="flex max-w-xl flex-col gap-7"
        >
          <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
            Entre le code affiché sur l’écran
          </h1>

          <div className="flex flex-col gap-2">
            <label htmlFor="game-code" className="font-bold">
              Code de la partie
            </label>
            <input
              id="game-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ['--wdth' as string]: 130 }}
              className="numerals w-full rounded-2xl bg-white px-5 py-3 text-5xl font-black tracking-[0.18em] text-ink placeholder:text-ink/20 focus:outline-none sm:text-6xl"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="nickname" className="font-bold">
              Ton pseudo
            </label>
            <input
              id="nickname"
              name="nickname"
              autoComplete="nickname"
              maxLength={20}
              placeholder="Comment les autres te verront"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="min-h-14 rounded-2xl bg-white/12 px-5 text-xl text-white ring-2 ring-white/40 ring-inset placeholder:text-white/60 focus:ring-white focus:outline-none"
            />
          </div>

          {error ? <Alert>{error}</Alert> : null}

          <Button type="submit" variant="light" size="lg" busy={busy} className="self-start">
            Rejoindre la partie
          </Button>
        </motion.form>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-white/80">
        Tu animes un groupe ? Crée ton quiz, projette-le, et chacun répond depuis son téléphone.{' '}
        <Link to="/register" className="font-bold text-white underline underline-offset-4">
          Créer un compte hôte
        </Link>
      </footer>
    </div>
  );
}
