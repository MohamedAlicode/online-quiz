import { loginSchema, registerSchema, type AuthResponse } from '@quiz/shared';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert, Button, Logo, TextField } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

type Mode = 'login' | 'register';

const COPY: Record<
  Mode,
  { title: string; submit: string; switchText: string; switchLink: string; switchTo: string }
> = {
  login: {
    title: 'Connexion',
    submit: 'Se connecter',
    switchText: 'Pas encore de compte ?',
    switchLink: 'Créer un compte hôte',
    switchTo: '/register',
  },
  register: {
    title: 'Créer un compte hôte',
    submit: 'Créer mon compte',
    switchText: 'Déjà inscrit ?',
    switchLink: 'Se connecter',
    switchTo: '/login',
  },
};

export function AuthPage({ mode }: { mode: Mode }) {
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/host';

  const [values, setValues] = useState({ email: '', password: '', displayName: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  if (token) return <Navigate to={redirectTo} replace />;

  const update = (field: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const schema = mode === 'login' ? loginSchema : registerSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setError(null);
    setBusy(true);
    try {
      const session = await api<AuthResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: parsed.data,
      });
      setSession(session);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 py-4">
        <Link to="/" aria-label="Retour à l’accueil">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <h1 className="font-display text-3xl font-extrabold">{copy.title}</h1>
        {mode === 'register' ? (
          <p className="mt-2 text-ink-soft">
            Un compte sert à créer tes quiz et à lancer les parties. Les joueurs, eux, n’en ont pas
            besoin.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
          {mode === 'register' ? (
            <TextField
              label="Ton nom"
              hint="Affiché dans ton espace, pas aux joueurs."
              autoComplete="name"
              value={values.displayName}
              onChange={update('displayName')}
              error={fieldErrors.displayName}
            />
          ) : null}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            error={fieldErrors.email}
          />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            hint={mode === 'register' ? '8 caractères minimum.' : undefined}
            value={values.password}
            onChange={update('password')}
            error={fieldErrors.password}
          />
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" size="lg" busy={busy}>
            {copy.submit}
          </Button>
        </form>

        <p className="mt-6 text-ink-soft">
          {copy.switchText}{' '}
          <Link
            to={copy.switchTo}
            state={location.state}
            className="font-bold text-stage underline underline-offset-4"
          >
            {copy.switchLink}
          </Link>
        </p>
      </main>
    </div>
  );
}
