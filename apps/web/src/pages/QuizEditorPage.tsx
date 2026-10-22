import type { QuestionDto, QuizDto } from '@quiz/shared';
import { quizInputSchema } from '@quiz/shared';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { draftFromQuestion, emptyDraft, QuestionForm } from '../components/QuestionForm';
import { Alert, Button, Spinner, TextField } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { plural } from '../lib/format';
import { getSocket, request } from '../lib/socket';
import { useAuthStore } from '../stores/auth-store';

type Editing = { mode: 'new' } | { mode: 'edit'; question: QuestionDto } | null;

export function QuizEditorPage() {
  const { quizId = '' } = useParams();
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [order, setOrder] = useState<QuestionDto[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [launching, setLaunching] = useState(false);
  const orderRef = useRef<QuestionDto[]>([]);

  const applyQuiz = useCallback((next: QuizDto) => {
    setQuiz(next);
    setOrder(next.questions);
    orderRef.current = next.questions;
  }, []);

  const load = useCallback(async () => {
    try {
      const { quiz: loaded } = await api<{ quiz: QuizDto }>(`/quizzes/${quizId}`);
      applyQuiz(loaded);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
      else setError(errorMessage(caught));
    }
  }, [quizId, applyQuiz]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Enregistre le nouvel ordre une fois le glisser-déposer terminé. */
  const persistOrder = useCallback(
    async (questions: QuestionDto[]) => {
      const before = quiz?.questions.map((q) => q.id).join();
      const after = questions.map((q) => q.id).join();
      if (before === after) return;
      try {
        const { quiz: updated } = await api<{ quiz: QuizDto }>(
          `/quizzes/${quizId}/questions/reorder`,
          {
            method: 'PUT',
            body: { questionIds: questions.map((q) => q.id) },
          },
        );
        applyQuiz(updated);
      } catch (caught) {
        setError(errorMessage(caught));
        if (quiz) applyQuiz(quiz);
      }
    },
    [quiz, quizId, applyQuiz],
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    setOrder(next);
    orderRef.current = next;
    void persistOrder(next);
  };

  const removeQuestion = async (question: QuestionDto) => {
    if (!window.confirm('Supprimer cette question ?')) return;
    try {
      await api(`/questions/${question.id}`, { method: 'DELETE' });
      if (editing?.mode === 'edit' && editing.question.id === question.id) setEditing(null);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const saveQuestion = async (data: unknown) => {
    if (editing?.mode === 'edit') {
      await api(`/questions/${editing.question.id}`, { method: 'PUT', body: data });
    } else {
      await api(`/quizzes/${quizId}/questions`, { method: 'POST', body: data });
    }
    setEditing(null);
    await load();
  };

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const { gameId } = await request(getSocket(token), 'host:create-game', { quizId });
      navigate(`/host/game/${gameId}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setLaunching(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-display text-3xl font-extrabold">Ce quiz n’existe pas ou plus</h1>
        <Link to="/host" className="font-bold text-stage underline underline-offset-4">
          Retour à mes quiz
        </Link>
      </div>
    );
  }
  if (!quiz) return error ? <Alert>{error}</Alert> : <Spinner label="Chargement du quiz…" />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/host" className="font-bold text-ink-soft hover:text-ink">
          Retour à mes quiz
        </Link>
        <div className="flex flex-wrap gap-2">
          {quiz.questions.length > 0 ? (
            <Link
              to={`/host/quizzes/${quiz.id}/preview`}
              className="inline-flex min-h-11 items-center rounded-xl px-4 font-bold ring-2 ring-line ring-inset hover:ring-ink"
            >
              Aperçu
            </Link>
          ) : null}
          <Button
            onClick={() => void launch()}
            busy={launching}
            disabled={quiz.questions.length === 0}
          >
            Lancer la partie
          </Button>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <QuizDetails quiz={quiz} onSaved={applyQuiz} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="questions-title" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="questions-title" className="font-display text-2xl font-extrabold">
              {plural(quiz.questions.length, 'question')}
            </h2>
            <Button variant="secondary" onClick={() => setEditing({ mode: 'new' })}>
              Ajouter une question
            </Button>
          </div>

          {order.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line bg-white px-5 py-8 text-center text-ink-soft">
              Ajoute une première question pour pouvoir lancer une partie.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">
                Fais glisser une question pour changer l’ordre, ou utilise les flèches.
              </p>
              <Reorder.Group
                axis="y"
                values={order}
                onReorder={(next: QuestionDto[]) => {
                  setOrder(next);
                  orderRef.current = next;
                }}
                className="flex flex-col gap-2"
              >
                {order.map((question, index) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    index={index}
                    total={order.length}
                    active={editing?.mode === 'edit' && editing.question.id === question.id}
                    onDragEnd={() => void persistOrder(orderRef.current)}
                    onMove={(delta) => move(index, delta)}
                    onEdit={() => setEditing({ mode: 'edit', question })}
                    onDelete={() => void removeQuestion(question)}
                  />
                ))}
              </Reorder.Group>
            </>
          )}
        </section>

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.section
              key={editing.mode === 'edit' ? editing.question.id : 'new'}
              aria-label={editing.mode === 'edit' ? 'Modifier la question' : 'Nouvelle question'}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-3xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-6"
            >
              <h2 className="mb-5 font-display text-2xl font-extrabold">
                {editing.mode === 'edit'
                  ? `Question ${order.findIndex((q) => q.id === editing.question.id) + 1}`
                  : 'Nouvelle question'}
              </h2>
              <QuestionForm
                initial={
                  editing.mode === 'edit' ? draftFromQuestion(editing.question) : emptyDraft()
                }
                submitLabel={
                  editing.mode === 'edit' ? 'Enregistrer la question' : 'Ajouter la question'
                }
                onSubmit={saveQuestion}
                onCancel={() => setEditing(null)}
              />
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  index,
  total,
  active,
  onDragEnd,
  onMove,
  onEdit,
  onDelete,
}: {
  question: QuestionDto;
  index: number;
  total: number;
  active: boolean;
  onDragEnd: () => void;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={question}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 24px -12px rgb(27 20 70 / 0.35)' }}
      className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-3 py-3 ${active ? 'border-stage' : 'border-line'}`}
    >
      <button
        type="button"
        aria-label="Faire glisser pour réordonner"
        onPointerDown={(event) => controls.start(event)}
        className="cursor-grab touch-none rounded-lg px-1.5 py-2 text-ink-soft active:cursor-grabbing"
      >
        <svg aria-hidden="true" width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
          {[3, 10, 17].map((y) => (
            <g key={y}>
              <circle cx="4" cy={y} r="1.8" />
              <circle cx="10" cy={y} r="1.8" />
            </g>
          ))}
        </svg>
      </button>
      <span className="numerals w-6 text-xl font-black">{index + 1}</span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block truncate font-bold">{question.text}</span>
        <span className="text-sm text-ink-soft">
          {question.type === 'TRUE_FALSE'
            ? 'Vrai ou faux'
            : plural(question.choices.length, 'réponse')}
          , {question.timeLimitSec} s
          {question.basePoints === 2000
            ? ', points doubles'
            : question.basePoints === 0
              ? ', sans points'
              : ''}
        </span>
      </button>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Monter la question"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="rounded-lg px-2 py-2 hover:bg-line/60 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Descendre la question"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="rounded-lg px-2 py-2 hover:bg-line/60 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          aria-label="Supprimer la question"
          onClick={onDelete}
          className="rounded-lg px-2 py-2 text-tomato-ink hover:bg-tomato/10"
        >
          ✕
        </button>
      </div>
    </Reorder.Item>
  );
}

function QuizDetails({ quiz, onSaved }: { quiz: QuizDto; onSaved: (quiz: QuizDto) => void }) {
  const [values, setValues] = useState({
    title: quiz.title,
    description: quiz.description,
    isPublic: quiz.isPublic,
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty =
    values.title !== quiz.title ||
    values.description !== quiz.description ||
    values.isPublic !== quiz.isPublic;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = quizInputSchema.safeParse({ ...values, coverUrl: quiz.coverUrl });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Données invalides');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const { quiz: saved } = await api<{ quiz: QuizDto }>(`/quizzes/${quiz.id}`, {
        method: 'PUT',
        body: parsed.data,
      });
      onSaved(saved);
      setStatus('saved');
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('idle');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-3xl border border-line bg-white p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
    >
      <TextField
        label="Titre du quiz"
        value={values.title}
        maxLength={120}
        onChange={(event) => {
          setValues({ ...values, title: event.target.value });
          setStatus('idle');
        }}
      />
      <TextField
        label="Description"
        value={values.description}
        maxLength={500}
        placeholder="Pour qui, sur quel thème…"
        onChange={(event) => {
          setValues({ ...values, description: event.target.value });
          setStatus('idle');
        }}
      />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={values.isPublic}
          onChange={(event) => {
            setValues({ ...values, isPublic: event.target.checked });
            setStatus('idle');
          }}
          className="size-5 accent-stage"
        />
        <span>
          <span className="font-bold">Quiz public</span>
          <span className="block text-sm text-ink-soft">
            Les autres hôtes peuvent le lancer et le dupliquer.
          </span>
        </span>
      </label>
      {error ? (
        <div className="md:col-span-2">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <div className="flex items-center gap-3 md:justify-end">
        <Button type="submit" variant="secondary" busy={status === 'saving'} disabled={!dirty}>
          Enregistrer
        </Button>
        {status === 'saved' && !dirty ? (
          <span role="status" className="font-bold text-ink">
            ✓ Enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}
