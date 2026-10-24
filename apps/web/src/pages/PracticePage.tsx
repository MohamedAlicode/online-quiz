import { TIMING, type PracticeQuizDto, type QuizDto } from '@quiz/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Logo, Spinner } from '../components/ui';
import { AnswerTile, type TileState } from '../game/AnswerTile';
import { AutoNextHint } from '../game/AutoNextHint';
import { Countdown } from '../game/Countdown';
import { QuestionImage } from '../game/QuestionImage';
import { SoundToggle } from '../game/SoundToggle';
import { TimerBar } from '../game/TimerBar';
import { useSoundCue } from '../game/useSound';
import { api, errorMessage } from '../lib/api';
import { plural } from '../lib/format';
import {
  initialPracticeState,
  missedQuestions,
  practiceFromQuiz,
  practiceReducer,
  type PracticeMode,
  type PracticeQuestion,
  type PracticeState,
} from '../lib/practice';
import { readJson, writeJson } from '../lib/storage';
import { useGameStore } from '../stores/game-store';

interface PracticeSource {
  key: string;
  title: string;
  description: string;
  questions: PracticeQuestion[];
}

interface BestScore {
  score: number;
  correct: number;
  total: number;
}

const bestKey = (sourceKey: string, mode: PracticeMode) =>
  `quiz-live:practice-best:${sourceKey}:${mode}`;

/** Entraînement en solo : sur un quiz prêt à jouer (`/practice/:slug`) ou sur un de ses quiz. */
export function PracticePage({ from }: { from: 'template' | 'quiz' }) {
  const { slug = '', quizId = '' } = useParams();
  const [source, setSource] = useState<PracticeSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);

  const load = useCallback(async (): Promise<PracticeSource> => {
    if (from === 'template') {
      const { practice } = await api<{ practice: PracticeQuizDto }>(`/practice/templates/${slug}`);
      return { key: slug, ...practice };
    }
    const { quiz } = await api<{ quiz: QuizDto }>(`/quizzes/${quizId}`);
    return {
      key: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questions: practiceFromQuiz(quiz),
    };
  }, [from, slug, quizId]);

  useEffect(() => {
    // Les minuteries du mode solo utilisent l'horloge locale, pas celle d'une partie en direct.
    useGameStore.getState().reset();
    // Chaque appel tire une nouvelle série : on ignore la réponse d'un chargement abandonné.
    let active = true;
    load()
      .then((loaded) => active && setSource(loaded))
      .catch((caught: unknown) => active && setError(errorMessage(caught)));
    return () => {
      active = false;
    };
  }, [load]);

  const start = (mode: PracticeMode, questions: PracticeQuestion[]) =>
    dispatch({ type: 'start', mode, questions, now: Date.now() });

  /** Nouvelle série : nouveau tirage pour un quiz prêt à jouer, mêmes questions sinon. */
  const restart = async (mode: PracticeMode) => {
    try {
      const fresh = from === 'template' ? await load() : source;
      if (!fresh) return;
      setSource(fresh);
      start(mode, fresh.questions);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  usePracticeTimers(state, dispatch);

  const backLink = from === 'template' ? '/practice' : '/host';

  return (
    <div className="on-stage flex min-h-dvh flex-col bg-stage text-white">
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <Link to={backLink} aria-label="Retour aux quiz">
          <Logo />
        </Link>
        {source ? <span className="font-bold text-white/85">{source.title}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          {state.phase === 'question' || state.phase === 'feedback' ? (
            <span className="font-bold">
              {state.mode === 'challenge'
                ? `${state.score} pts`
                : plural(
                    state.answers.filter((answer) => answer.isCorrect).length,
                    'bonne réponse',
                    'bonnes réponses',
                  )}
            </span>
          ) : null}
          <SoundToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-8">
        {error ? (
          <Centered>
            <Alert>{error}</Alert>
            <Link to={backLink} className="font-bold underline underline-offset-4">
              Retour
            </Link>
          </Centered>
        ) : !source ? (
          <Centered>
            <Spinner label="Préparation des questions…" />
          </Centered>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={phaseKey(state)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col"
            >
              <PracticeView
                source={source}
                state={state}
                onStart={(mode) => start(mode, source.questions)}
                onAnswer={(choiceId) => dispatch({ type: 'answer', choiceId, now: Date.now() })}
                onNext={() => dispatch({ type: 'next', now: Date.now() })}
                onReviewMistakes={(mode, questions) => start(mode, questions)}
                onRestart={(mode) => void restart(mode)}
                onChangeMode={() => dispatch({ type: 'reset' })}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

const phaseKey = (state: PracticeState) =>
  state.phase === 'question' || state.phase === 'feedback' ? `q-${state.index}` : state.phase;

/** Compte à rebours, chrono du mode défi, passage automatique et raccourcis clavier. */
function usePracticeTimers(
  state: PracticeState,
  dispatch: (action: Parameters<typeof practiceReducer>[1]) => void,
) {
  useEffect(() => {
    let timer: number | undefined;
    if (state.phase === 'countdown') {
      timer = window.setTimeout(
        () => dispatch({ type: 'begin', now: Date.now() }),
        Math.max(0, state.endsAt - Date.now()),
      );
    } else if (state.phase === 'question' && state.mode === 'challenge') {
      const question = state.questions[state.index];
      const limit = (question?.timeLimitSec ?? 20) * 1000;
      timer = window.setTimeout(
        () => dispatch({ type: 'timeUp', now: Date.now() }),
        Math.max(0, state.startedAt + limit - Date.now()),
      );
    } else if (state.phase === 'feedback') {
      // Comme en partie : 5 secondes pour voir la bonne réponse, puis la suite.
      timer = window.setTimeout(
        () => dispatch({ type: 'next', now: Date.now() }),
        Math.max(0, state.answeredAt + TIMING.autoAdvanceMs - Date.now()),
      );
    }
    return () => window.clearTimeout(timer);
  }, [state, dispatch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
      if (state.phase === 'question') {
        const index = ['1', '2', '3', '4'].indexOf(event.key) + 1 || 'abcd'.indexOf(event.key) + 1;
        const choice = state.questions[state.index]?.choices[index - 1];
        if (index > 0 && choice) dispatch({ type: 'answer', choiceId: choice.id, now: Date.now() });
      } else if (state.phase === 'feedback' && ['Enter', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
        dispatch({ type: 'next', now: Date.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, dispatch]);
}

interface PracticeViewProps {
  source: PracticeSource;
  state: PracticeState;
  onStart: (mode: PracticeMode) => void;
  onAnswer: (choiceId: string) => void;
  onNext: () => void;
  onReviewMistakes: (mode: PracticeMode, questions: PracticeQuestion[]) => void;
  onRestart: (mode: PracticeMode) => void;
  onChangeMode: () => void;
}

function PracticeView({ source, state, onStart, onAnswer, onNext, ...actions }: PracticeViewProps) {
  switch (state.phase) {
    case 'intro':
      return <Intro source={source} onStart={onStart} />;

    case 'countdown':
      return (
        <Countdown endsAt={state.endsAt} label={`Question 1 sur ${state.questions.length}`} sound />
      );

    case 'question':
    case 'feedback':
      return <QuestionStep state={state} onAnswer={onAnswer} onNext={onNext} />;

    case 'finished':
      return <Summary source={source} state={state} {...actions} />;
  }
}

function Intro({
  source,
  onStart,
}: {
  source: PracticeSource;
  onStart: (mode: PracticeMode) => void;
}) {
  const modes: { mode: PracticeMode; title: string; text: string }[] = [
    {
      mode: 'learn',
      title: 'Apprendre',
      text: 'Sans chrono. Après chaque réponse, la correction et une phrase pour la retenir.',
    },
    {
      mode: 'challenge',
      title: 'Défi chrono',
      text: 'Le temps compte : plus tu réponds vite, plus tu gagnes de points, avec un bonus de série.',
    },
  ];
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-6">
      <div>
        <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
          {source.title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-white/85">
          {plural(source.questions.length, 'question')}. {source.description}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {modes.map(({ mode, title, text }) => {
          const best = readJson<BestScore>(bestKey(source.key, mode));
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onStart(mode)}
              className="flex flex-col items-start gap-2 rounded-3xl bg-white p-6 text-left text-ink transition-transform hover:-translate-y-0.5"
            >
              <span className="font-display text-2xl font-extrabold">{title}</span>
              <span className="text-ink-soft">{text}</span>
              {best ? (
                <span className="mt-2 rounded-full bg-mustard px-3 py-1 text-sm font-bold">
                  Record :{' '}
                  {mode === 'challenge'
                    ? `${best.score} pts`
                    : `${best.correct} / ${best.total} bonnes réponses`}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionStep({
  state,
  onAnswer,
  onNext,
}: {
  state: Extract<PracticeState, { phase: 'question' | 'feedback' }>;
  onAnswer: (choiceId: string) => void;
  onNext: () => void;
}) {
  const question = state.questions[state.index];
  const answer = state.phase === 'feedback' ? state.answer : null;
  useSoundCue(answer ? (answer.isCorrect ? 'correct' : 'wrong') : null, state.index);
  if (!question) return null;
  const isLast = state.index === state.questions.length - 1;
  const correct = question.choices.find((choice) => choice.isCorrect);

  const tileState = (choiceId: string, isCorrect: boolean): TileState => {
    if (!answer) return 'idle';
    if (isCorrect) return 'correct';
    return answer.choiceId === choiceId ? 'wrong' : 'dimmed';
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="font-bold text-white/85">
        Question {state.index + 1} sur {state.questions.length}
      </p>
      {state.mode === 'challenge' && state.phase === 'question' ? (
        <TimerBar
          endsAt={state.startedAt + question.timeLimitSec * 1000}
          totalMs={question.timeLimitSec * 1000}
          paused={false}
          pausedRemainingMs={0}
          sound
        />
      ) : null}
      <h1 className="font-display text-2xl leading-snug font-extrabold sm:text-4xl">
        {question.text}
      </h1>
      {question.imageUrl ? (
        <QuestionImage src={question.imageUrl} size="phone" className="self-center sm:max-h-56" />
      ) : null}

      {answer ? (
        <motion.div
          role="status"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={
            answer.isCorrect
              ? { scale: [0.96, 1.03, 1], opacity: 1 }
              : { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] }
          }
          transition={{ duration: 0.45 }}
          className={`rounded-2xl px-5 py-4 text-ink ${answer.isCorrect ? 'bg-meadow' : 'bg-tomato'}`}
        >
          <p className="font-display text-2xl font-extrabold">
            {answer.isCorrect
              ? 'Bonne réponse'
              : answer.choiceId === null
                ? 'Temps écoulé'
                : 'Raté'}
            {state.mode === 'challenge' && answer.isCorrect ? ` : +${answer.points} points` : ''}
          </p>
          {!answer.isCorrect && correct ? (
            <p className="font-bold">La bonne réponse : {correct.text}</p>
          ) : null}
          {question.explanation ? <p className="mt-1">{question.explanation}</p> : null}
        </motion.div>
      ) : null}

      <div className="mt-auto grid gap-3 sm:grid-cols-2">
        {question.choices.map((choice, index) => (
          <AnswerTile
            key={choice.id}
            index={index}
            text={choice.text}
            size="phone"
            state={tileState(choice.id, choice.isCorrect)}
            disabled={Boolean(answer)}
            onSelect={() => onAnswer(choice.id)}
          />
        ))}
      </div>

      {answer ? (
        <div className="flex flex-wrap items-center justify-end gap-4">
          {state.phase === 'feedback' ? (
            <AutoNextHint
              at={state.answeredAt + TIMING.autoAdvanceMs}
              label={isLast ? 'Bilan' : 'Question suivante'}
            />
          ) : null}
          <Button variant="light" size="lg" onClick={onNext}>
            {isLast ? 'Voir le bilan' : 'Question suivante'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-white/70">Astuce : touches 1 à 4 pour répondre au clavier.</p>
      )}
    </div>
  );
}

function Summary({
  source,
  state,
  onReviewMistakes,
  onRestart,
  onChangeMode,
}: {
  source: PracticeSource;
  state: Extract<PracticeState, { phase: 'finished' }>;
  onReviewMistakes: (mode: PracticeMode, questions: PracticeQuestion[]) => void;
  onRestart: (mode: PracticeMode) => void;
  onChangeMode: () => void;
}) {
  const correctCount = state.answers.filter((answer) => answer.isCorrect).length;
  const total = state.questions.length;
  const missed = missedQuestions(state);
  const [record, setRecord] = useState(false);
  useSoundCue('fanfare', 'summary', correctCount === total || record);

  // Meilleur score enregistré dans ce navigateur (mêmes questions : quiz complet seulement).
  useEffect(() => {
    if (total !== source.questions.length) return;
    const key = bestKey(source.key, state.mode);
    const best = readJson<BestScore>(key);
    const better =
      !best ||
      (state.mode === 'challenge' ? state.score > best.score : correctCount > best.correct);
    if (better) {
      writeJson(key, { score: state.score, correct: correctCount, total });
      setRecord(Boolean(best));
    }
  }, [source, state, correctCount, total]);

  const answerFor = (questionId: string) =>
    state.answers.find((answer) => answer.questionId === questionId);

  return (
    <div className="flex flex-col gap-8 py-6">
      <section className="flex flex-col items-start gap-2">
        <p className="text-xl font-bold text-white/85">Bilan</p>
        <p
          className="numerals text-7xl leading-none font-black sm:text-8xl"
          style={{ ['--wdth' as string]: 130 }}
        >
          {state.mode === 'challenge' ? `${state.score} pts` : `${correctCount}/${total}`}
        </p>
        <p className="text-lg">
          {plural(correctCount, 'bonne réponse', 'bonnes réponses')} sur {total}
          {correctCount === total ? ' : sans faute !' : '.'}
        </p>
        {record ? (
          <p className="rounded-full bg-mustard px-4 py-1.5 font-bold text-ink">Nouveau record</p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        {missed.length > 0 ? (
          <Button variant="light" size="lg" onClick={() => onReviewMistakes(state.mode, missed)}>
            Revoir mes erreurs ({missed.length})
          </Button>
        ) : null}
        {missed.length > 0 ? (
          <button
            type="button"
            onClick={() => onRestart(state.mode)}
            className="min-h-14 rounded-xl px-7 text-lg font-bold text-white ring-2 ring-white/60 ring-inset hover:bg-white/10"
          >
            Nouvelle série
          </button>
        ) : (
          <Button variant="light" size="lg" onClick={() => onRestart(state.mode)}>
            Nouvelle série
          </Button>
        )}
        <button
          type="button"
          onClick={onChangeMode}
          className="rounded-xl px-4 py-2 font-bold text-white underline-offset-4 hover:underline"
        >
          Changer de mode
        </button>
      </div>

      <section aria-labelledby="correction" className="flex flex-col gap-3">
        <h2 id="correction" className="font-display text-2xl font-extrabold">
          Correction
        </h2>
        <ol className="flex flex-col gap-2">
          {state.questions.map((question, index) => {
            const answer = answerFor(question.id);
            const correct = question.choices.find((choice) => choice.isCorrect);
            const chosen = question.choices.find((choice) => choice.id === answer?.choiceId);
            return (
              <li key={question.id} className="flex items-center gap-4 rounded-2xl bg-white/10 p-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-black text-ink ${
                    answer?.isCorrect ? 'bg-meadow' : 'bg-tomato'
                  }`}
                  aria-label={answer?.isCorrect ? 'Bonne réponse' : 'Erreur'}
                >
                  {answer?.isCorrect ? '✓' : '✗'}
                </span>
                {question.imageUrl ? (
                  <img
                    src={question.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-11 w-16 shrink-0 rounded-md object-contain"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-bold">
                    {index + 1}. {question.text}
                  </p>
                  <p className="text-sm text-white/85">
                    {answer?.isCorrect
                      ? correct?.text
                      : `${chosen ? `Ta réponse : ${chosen.text}. ` : 'Pas de réponse. '}Bonne réponse : ${correct?.text ?? '–'}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
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
