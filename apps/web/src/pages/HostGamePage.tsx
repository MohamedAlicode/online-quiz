import type { GameSettings, GameStatePayload, GameView } from '@quiz/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import QRCode from 'react-qr-code';
import { Link, useParams } from 'react-router';
import { Alert, Button, Logo, Spinner } from '../components/ui';
import { AnswerTile } from '../game/AnswerTile';
import { AutoNextHint } from '../game/AutoNextHint';
import { Countdown } from '../game/Countdown';
import { FastestList } from '../game/FastestList';
import { Histogram } from '../game/Histogram';
import { Leaderboard } from '../game/Leaderboard';
import { LobbyPlayers } from '../game/LobbyPlayers';
import { Podium } from '../game/Podium';
import { QuestionImage } from '../game/QuestionImage';
import { SoundToggle } from '../game/SoundToggle';
import { StageShell } from '../game/StageShell';
import { TimerBar } from '../game/TimerBar';
import { useHostGame } from '../game/useGameSession';

type Command = 'host:start-game' | 'host:next';

/** Libellé et commande du bouton principal selon la phase. */
function primaryAction(
  view: GameView,
  settings: GameSettings,
): { label: string; command: Command } | null {
  switch (view.status) {
    case 'LOBBY':
      return view.players.length > 0
        ? { label: `Lancer la partie (${view.players.length})`, command: 'host:start-game' }
        : null;
    case 'QUESTION':
      return { label: 'Passer la question', command: 'host:next' };
    case 'RESULTS':
      if (settings.autoAdvance) {
        // Enchaînement automatique : le bouton permet de ne pas attendre la fin du décompte.
        const isLast = view.questionIndex === view.totalQuestions - 1;
        return { label: isLast ? 'Voir le podium' : 'Question suivante', command: 'host:next' };
      }
      return { label: 'Voir le classement', command: 'host:next' };
    case 'LEADERBOARD':
      return {
        label: view.isLastQuestion ? 'Voir le podium' : 'Question suivante',
        command: 'host:next',
      };
    case 'PODIUM':
      return { label: 'Terminer la partie', command: 'host:next' };
    default:
      return null;
  }
}

export function HostGamePage() {
  const { gameId = '' } = useParams();
  const { state, connection, notice, error, pending, run, kick, setAutoAdvance } =
    useHostGame(gameId);
  const action = state ? primaryAction(state.view, state.settings) : null;

  // Raccourci clavier pour l'hôte qui projette : flèche droite = bouton principal.
  useEffect(() => {
    if (!action) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== 'ArrowRight' || target?.closest('input, textarea, select')) return;
      if (!pending) void run(action.command);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, pending, run]);

  if (notice) {
    return (
      <StageShell connection={connection}>
        <CenteredMessage title={notice}>
          <Link to="/host" className="rounded-xl bg-white px-5 py-3 font-bold text-ink">
            Retour à mes quiz
          </Link>
        </CenteredMessage>
      </StageShell>
    );
  }

  if (!state) {
    return (
      <StageShell connection={connection}>
        <CenteredMessage title={error ?? 'Connexion à la partie…'}>
          {error ? (
            <Link to="/host" className="rounded-xl bg-white px-5 py-3 font-bold text-ink">
              Retour à mes quiz
            </Link>
          ) : (
            <Spinner />
          )}
        </CenteredMessage>
      </StageShell>
    );
  }

  const { view } = state;
  const inGame = view.status !== 'LOBBY' && view.status !== 'PODIUM' && view.status !== 'FINISHED';
  const progress =
    'questionIndex' in view
      ? `Question ${view.questionIndex + 1} sur ${view.totalQuestions}`
      : null;

  return (
    <StageShell connection={connection}>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
        <Logo />
        <span className="font-bold text-white/85">{state.quizTitle}</span>
        {progress && inGame ? <span className="font-bold">{progress}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view.status === 'QUESTION' ? (
            <Button
              variant="light"
              disabled={pending}
              onClick={() => void run(view.paused ? 'host:resume' : 'host:pause')}
            >
              {view.paused ? 'Reprendre' : 'Pause'}
            </Button>
          ) : null}
          {view.status !== 'PODIUM' && view.status !== 'FINISHED' ? (
            <button
              type="button"
              aria-pressed={state.settings.autoAdvance}
              title="Après la bonne réponse, passer seul à la question suivante au bout de 5 secondes"
              disabled={pending}
              onClick={() => void setAutoAdvance(!state.settings.autoAdvance)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-white hover:bg-white/10"
            >
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  state.settings.autoAdvance ? 'bg-mustard' : 'bg-white/25'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0 size-4 rounded-full bg-white transition-transform ${
                    state.settings.autoAdvance ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              Enchaînement auto
            </button>
          ) : null}
          {view.status !== 'FINISHED' ? (
            <button
              type="button"
              className="rounded-xl px-4 py-2 font-bold text-white hover:bg-white/10"
              onClick={() => {
                const message =
                  view.status === 'LOBBY'
                    ? 'Annuler la partie ? Les joueurs seront déconnectés.'
                    : 'Terminer la partie maintenant ? Le podium sera affiché avec les scores actuels.';
                if (window.confirm(message)) void run('host:end-game');
              }}
            >
              {view.status === 'LOBBY' ? 'Annuler la partie' : 'Terminer'}
            </button>
          ) : null}
          <SoundToggle />
          <FullscreenButton />
        </div>
      </header>

      {error ? (
        <div className="px-4 sm:px-8">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.main
          key={`${view.status}-${'questionIndex' in view ? view.questionIndex : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col px-4 pb-6 sm:px-8"
        >
          <HostView
            state={state}
            onKick={(id, nickname) => {
              if (window.confirm(`Exclure ${nickname} de la partie ?`)) void kick(id);
            }}
          />
        </motion.main>
      </AnimatePresence>

      {action ? (
        <footer className="flex flex-wrap items-center justify-end gap-4 px-4 pb-6 sm:px-8">
          {view.status === 'RESULTS' && view.autoNextAt ? (
            <AutoNextHint
              at={view.autoNextAt}
              label={
                view.questionIndex === view.totalQuestions - 1 ? 'Podium' : 'Question suivante'
              }
            />
          ) : null}
          <Button variant="light" size="lg" busy={pending} onClick={() => void run(action.command)}>
            {action.label}
          </Button>
        </footer>
      ) : null}
    </StageShell>
  );
}

function HostView({
  state,
  onKick,
}: {
  state: GameStatePayload;
  onKick: (playerId: string, nickname: string) => void;
}) {
  const { view } = state;

  switch (view.status) {
    case 'LOBBY': {
      const joinUrl = `${window.location.origin}/?code=${state.code}`;
      return (
        <div className="flex flex-1 flex-col gap-10">
          <section className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-2xl font-bold">
                Rejoins sur{' '}
                <span className="underline underline-offset-4">{window.location.host}</span> avec le
                code
              </p>
              <p
                className="numerals mt-2 text-[clamp(4.5rem,15vw,11rem)] leading-none font-black"
                style={{ ['--wdth' as string]: 150 }}
                aria-label={`Code ${state.code.split('').join(' ')}`}
              >
                {state.code}
              </p>
            </div>
            <div className="self-start rounded-2xl bg-white p-4 lg:self-auto">
              <QRCode
                value={joinUrl}
                size={176}
                fgColor="#1b1446"
                title="QR code pour rejoindre la partie"
              />
            </div>
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">
              {view.players.length === 0
                ? 'En attente des joueurs…'
                : `${view.players.length} joueur${view.players.length > 1 ? 's' : ''} dans la partie`}
            </h2>
            <LobbyPlayers
              players={view.players}
              onKick={(player) => onKick(player.id, player.nickname)}
            />
            {view.players.length > 0 ? (
              <p className="text-white/75">Clique sur un pseudo pour exclure le joueur.</p>
            ) : null}
          </section>
        </div>
      );
    }

    case 'COUNTDOWN':
      return (
        <Countdown
          endsAt={view.endsAt}
          label={`Question ${view.questionIndex + 1} sur ${view.totalQuestions}`}
          sound
        />
      );

    case 'QUESTION':
      return (
        <div
          className={`relative flex flex-1 flex-col ${view.question.imageUrl ? 'gap-4' : 'gap-6'}`}
        >
          <h1 className="max-w-5xl font-display text-3xl leading-tight font-extrabold sm:text-5xl">
            {view.question.text}
          </h1>
          {view.question.imageUrl ? (
            <QuestionImage src={view.question.imageUrl} size="stage" className="self-center" />
          ) : null}
          <TimerBar
            endsAt={view.endsAt}
            totalMs={view.question.timeLimitSec * 1000}
            paused={view.paused}
            pausedRemainingMs={view.remainingMs}
            showSeconds
            sound
          />
          <p className="text-xl font-bold" aria-live="polite">
            Réponses : {view.answeredCount} sur {view.playerCount}
          </p>
          <div className="mt-auto grid gap-4 md:grid-cols-2">
            {view.question.choices.map((choice, index) => (
              <AnswerTile
                key={choice.id}
                index={index}
                text={choice.text}
                compact={Boolean(view.question.imageUrl)}
              />
            ))}
          </div>
          {view.paused ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-stage-deep/90">
              <p className="font-display text-6xl font-extrabold">Pause</p>
            </div>
          ) : null}
        </div>
      );

    case 'RESULTS':
      return (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex items-center gap-5">
            {view.question.imageUrl ? (
              <QuestionImage src={view.question.imageUrl} size="small" />
            ) : null}
            <h1 className="max-w-5xl font-display text-3xl leading-tight font-extrabold sm:text-4xl">
              {view.question.text}
            </h1>
          </div>
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-end lg:justify-center lg:gap-12">
            <div className="w-full max-w-2xl">
              <Histogram
                question={view.question}
                distribution={view.distribution}
                correctChoiceId={view.correctChoiceId}
              />
            </div>
            <FastestList fastest={view.fastest} />
          </div>
          <div className="mt-auto grid gap-4 md:grid-cols-2">
            {view.question.choices.map((choice, index) => (
              <AnswerTile
                key={choice.id}
                index={index}
                text={choice.text}
                state={choice.id === view.correctChoiceId ? 'correct' : 'dimmed'}
              />
            ))}
          </div>
        </div>
      );

    case 'LEADERBOARD':
      return (
        <div className="flex flex-1 flex-col items-center gap-8">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Classement</h1>
          <Leaderboard players={view.top} />
        </div>
      );

    case 'PODIUM':
      return (
        <div className="flex flex-1 flex-col items-center justify-end gap-8">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Podium</h1>
          <Podium podium={view.podium} sound />
        </div>
      );

    case 'FINISHED':
      return (
        <CenteredMessage title="Partie terminée">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to={`/host/history/${state.gameId}`}
              className="rounded-xl bg-white px-5 py-3 font-bold text-ink"
            >
              Voir les résultats détaillés
            </Link>
            <Link
              to="/host"
              className="rounded-xl px-5 py-3 font-bold ring-2 ring-white ring-inset"
            >
              Retour à mes quiz
            </Link>
          </div>
        </CenteredMessage>
      );
  }
}

function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="max-w-2xl font-display text-3xl font-extrabold sm:text-4xl">{title}</p>
      {children}
    </div>
  );
}

function FullscreenButton() {
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  return (
    <button
      type="button"
      className="rounded-xl px-4 py-2 font-bold text-white hover:bg-white/10"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
    >
      Plein écran
    </button>
  );
}
