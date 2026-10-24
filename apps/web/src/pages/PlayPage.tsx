import type { GameStatePayload } from '@quiz/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { Spinner } from '../components/ui';
import { answerStyle, playerColor } from '../lib/answers';
import { clearPlayerSession } from '../lib/player-session';
import { AnswerTile } from '../game/AnswerTile';
import { AutoNextHint } from '../game/AutoNextHint';
import { Countdown } from '../game/Countdown';
import { QuestionImage } from '../game/QuestionImage';
import { StageShell } from '../game/StageShell';
import { TimerBar } from '../game/TimerBar';
import { usePlayerGame } from '../game/useGameSession';

/** Écran du joueur, pensé pour le téléphone. */
export function PlayPage() {
  const { session, state, connection, notice, answer } = usePlayerGame();

  if (!session && !notice) return <Navigate to="/" replace />;

  if (notice) {
    return (
      <StageShell connection={connection}>
        <Centered>
          <p className="font-display text-3xl font-extrabold">{notice}</p>
          <HomeLink label="Retour à l’accueil" />
        </Centered>
      </StageShell>
    );
  }

  if (!state) {
    return (
      <StageShell connection={connection}>
        <Centered>
          <Spinner label="Connexion à la partie…" />
        </Centered>
      </StageShell>
    );
  }

  const tone =
    state.view.status === 'RESULTS' && state.view.myResult
      ? state.view.myResult.isCorrect
        ? 'bg-meadow'
        : state.view.myResult.answered
          ? 'bg-tomato'
          : 'bg-stage-deep'
      : 'bg-stage';

  return (
    <StageShell connection={connection} tone={tone}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <span
          className={`rounded-full px-4 py-1.5 font-bold text-ink ${playerColor(state.me?.nickname ?? '')}`}
        >
          {state.me?.nickname}
        </span>
        <span
          className="numerals text-xl font-black"
          aria-label={`Score : ${state.me?.score ?? 0} points`}
        >
          {state.me?.score ?? 0} pts
        </span>
      </header>
      <AnimatePresence mode="wait">
        <motion.main
          key={`${state.view.status}-${'questionIndex' in state.view ? state.view.questionIndex : ''}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col px-4 pb-6"
        >
          <PlayerView state={state} onAnswer={answer} />
        </motion.main>
      </AnimatePresence>
    </StageShell>
  );
}

function PlayerView({
  state,
  onAnswer,
}: {
  state: GameStatePayload;
  onAnswer: (questionId: string, choiceId: string) => Promise<void>;
}) {
  const { view, me } = state;

  switch (view.status) {
    case 'LOBBY':
      return (
        <Centered>
          <p className="font-display text-4xl font-extrabold">Tu es dans la partie</p>
          <p className="max-w-sm text-lg text-white/85">
            Ton pseudo est affiché sur l’écran de l’animateur. La partie commence dès qu’il la
            lance.
          </p>
        </Centered>
      );

    case 'COUNTDOWN':
      return (
        <Countdown
          endsAt={view.endsAt}
          label={`Question ${view.questionIndex + 1} sur ${view.totalQuestions}`}
        />
      );

    case 'QUESTION':
      return <QuestionScreen state={state} onAnswer={onAnswer} />;

    case 'RESULTS': {
      const result = view.myResult;
      const correctIndex = view.question.choices.findIndex((c) => c.id === view.correctChoiceId);
      const correct = view.question.choices[correctIndex];
      const autoNext = view.autoNextAt ? (
        <AutoNextHint
          at={view.autoNextAt}
          label={view.questionIndex === view.totalQuestions - 1 ? 'Podium' : 'Question suivante'}
        />
      ) : null;
      if (!result?.answered) {
        return (
          <Centered>
            <p className="font-display text-4xl font-extrabold">Temps écoulé</p>
            <p className="text-lg">
              La bonne réponse était {answerStyle(correctIndex).letter} : {correct?.text}
            </p>
            {autoNext}
          </Centered>
        );
      }
      return (
        <Centered>
          <motion.div
            className="flex flex-col items-center gap-4"
            animate={
              result.isCorrect ? { scale: [0.9, 1.08, 1] } : { x: [0, -14, 14, -10, 10, -4, 0] }
            }
            transition={{ duration: result.isCorrect ? 0.6 : 0.5 }}
          >
            <p className="font-display text-5xl font-extrabold">
              {result.isCorrect ? 'Bonne réponse' : 'Raté'}
            </p>
            {result.isCorrect ? (
              <p
                className="numerals text-7xl font-black"
                style={{ ['--wdth' as string]: 140 }}
                aria-label={`${result.points} points gagnés`}
              >
                +{result.points}
              </p>
            ) : (
              <p className="max-w-sm text-xl">
                La bonne réponse était {answerStyle(correctIndex).letter} : {correct?.text}
              </p>
            )}
            {result.isCorrect && result.speedRank ? (
              <p className="text-xl font-bold">
                {result.speedRank === 1
                  ? 'Le plus rapide à trouver !'
                  : `${result.speedRank}e plus rapide à trouver`}
              </p>
            ) : null}
            {result.isCorrect && result.streak >= 2 ? (
              <p className="rounded-full bg-ink px-4 py-1.5 font-bold">
                Série de {result.streak} bonnes réponses (+{result.streakBonus})
              </p>
            ) : null}
          </motion.div>
          {me ? <p className="text-lg font-bold">Tu es {ordinal(me.rank)} pour l’instant</p> : null}
          {autoNext}
        </Centered>
      );
    }

    case 'LEADERBOARD':
      return (
        <Centered>
          <p className="text-xl font-bold text-white/85">Ta place</p>
          <p
            className="numerals text-[8rem] leading-none font-black"
            style={{ ['--wdth' as string]: 120 }}
          >
            {me?.rank ?? '–'}
          </p>
          <p className="text-xl">
            {me?.score ?? 0} points, {me?.correctCount ?? 0} bonne
            {(me?.correctCount ?? 0) > 1 ? 's' : ''} réponse
            {(me?.correctCount ?? 0) > 1 ? 's' : ''}
          </p>
          {view.top.some((player) => player.id === me?.id) ? (
            <p className="rounded-full bg-mustard px-4 py-1.5 font-bold text-ink">
              Tu es dans le top 5
            </p>
          ) : null}
        </Centered>
      );

    case 'PODIUM':
    case 'FINISHED':
      return (
        <Centered>
          <p className="font-display text-4xl font-extrabold">
            {me && me.rank <= 3 ? `Tu montes sur le podium` : 'Partie terminée'}
          </p>
          <p
            className="numerals text-[7rem] leading-none font-black"
            style={{ ['--wdth' as string]: 130 }}
          >
            {me ? ordinal(me.rank) : '–'}
          </p>
          <p className="text-xl">
            {me?.score ?? 0} points, {me?.correctCount ?? 0} bonne
            {(me?.correctCount ?? 0) > 1 ? 's' : ''} réponse
            {(me?.correctCount ?? 0) > 1 ? 's' : ''}
          </p>
          <ol className="w-full max-w-sm text-left">
            {view.podium.map((player) => (
              <li
                key={player.id}
                className="flex justify-between border-b border-white/25 py-2 text-lg"
              >
                <span>
                  {ordinal(player.rank)} {player.nickname}
                </span>
                <span className="numerals font-black">{player.score}</span>
              </li>
            ))}
          </ol>
          <HomeLink label="Rejouer" onClick={clearPlayerSession} />
        </Centered>
      );
  }
}

function QuestionScreen({
  state,
  onAnswer,
}: {
  state: GameStatePayload;
  onAnswer: (questionId: string, choiceId: string) => Promise<void>;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = state.view;
  if (view.status !== 'QUESTION') return null;

  const chosen = view.myChoiceId ?? sending;

  async function choose(choiceId: string) {
    if (chosen || view.status !== 'QUESTION') return;
    setSending(choiceId);
    setError(null);
    try {
      await onAnswer(view.question.id, choiceId);
    } catch (caught) {
      setSending(null);
      setError(caught instanceof Error ? caught.message : 'Réponse non envoyée');
    }
  }

  return (
    <div className="relative flex flex-1 flex-col gap-5">
      <TimerBar
        endsAt={view.endsAt}
        totalMs={view.question.timeLimitSec * 1000}
        paused={view.paused}
        pausedRemainingMs={view.remainingMs}
      />
      <h1 className="font-display text-2xl leading-snug font-extrabold">{view.question.text}</h1>
      {view.question.imageUrl ? (
        <QuestionImage src={view.question.imageUrl} size="phone" className="self-center" />
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-ink px-4 py-2 font-bold">
          {error}
        </p>
      ) : null}
      <div className="mt-auto grid gap-3 sm:grid-cols-2">
        {view.question.choices.map((choice, index) => (
          <AnswerTile
            key={choice.id}
            index={index}
            text={choice.text}
            size="phone"
            disabled={Boolean(chosen) || view.paused}
            state={chosen ? (chosen === choice.id ? 'selected' : 'dimmed') : 'idle'}
            onSelect={() => void choose(choice.id)}
          />
        ))}
      </div>
      {chosen ? (
        <p className="text-center text-lg font-bold" role="status">
          Réponse envoyée. On attend les autres…
        </p>
      ) : null}
      {view.paused ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-stage-deep/90">
          <p className="font-display text-5xl font-extrabold">Pause</p>
        </div>
      ) : null}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      {children}
    </div>
  );
}

function HomeLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className="rounded-xl bg-white px-6 py-3 text-lg font-bold text-ink"
    >
      {label}
    </Link>
  );
}

function ordinal(rank: number): string {
  return rank === 1 ? '1re' : `${rank}e`;
}
