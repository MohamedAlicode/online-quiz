import type { QuizDto, QuizSummaryDto, QuizTemplateDto } from '@quiz/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TemplateLibrary } from '../components/TemplateLibrary';
import { Alert, Button, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate, plural } from '../lib/format';
import { createSampleQuiz } from '../lib/sample-quiz';
import { getSocket, request } from '../lib/socket';
import { useAuthStore } from '../stores/auth-store';

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { quizzes: list } = await api<{ quizzes: QuizSummaryDto[] }>('/quizzes');
      setQuizzes(list);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function withBusy(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  const createQuiz = () =>
    withBusy('new', async () => {
      const { quiz } = await api<{ quiz: QuizDto }>('/quizzes', {
        method: 'POST',
        body: { title: 'Nouveau quiz' },
      });
      navigate(`/host/quizzes/${quiz.id}`);
    });

  const createSample = () =>
    withBusy('sample', async () => {
      await createSampleQuiz();
      await load();
    });

  const launch = (quiz: QuizSummaryDto) =>
    withBusy(quiz.id, async () => {
      const { gameId } = await request(getSocket(token), 'host:create-game', { quizId: quiz.id });
      navigate(`/host/game/${gameId}`);
    });

  const duplicate = (quiz: QuizSummaryDto) =>
    withBusy(quiz.id, async () => {
      await api(`/quizzes/${quiz.id}/duplicate`, { method: 'POST' });
      await load();
    });

  /** Copie un quiz prêt à jouer dans le compte de l'hôte (nouveau tirage des pays). */
  const importTemplate = async (template: QuizTemplateDto) => {
    const { quiz } = await api<{ quiz: QuizDto }>(`/templates/${template.slug}/import`, {
      method: 'POST',
    });
    return quiz;
  };

  const playTemplate = (template: QuizTemplateDto) =>
    withBusy(`play:${template.slug}`, async () => {
      const quiz = await importTemplate(template);
      const { gameId } = await request(getSocket(token), 'host:create-game', { quizId: quiz.id });
      navigate(`/host/game/${gameId}`);
    });

  const addTemplate = (template: QuizTemplateDto) =>
    withBusy(`add:${template.slug}`, async () => {
      const quiz = await importTemplate(template);
      navigate(`/host/quizzes/${quiz.id}`);
    });

  const remove = (quiz: QuizSummaryDto) => {
    if (!window.confirm(`Supprimer « ${quiz.title} » ? L’historique des parties est conservé.`))
      return;
    void withBusy(quiz.id, async () => {
      await api(`/quizzes/${quiz.id}`, { method: 'DELETE' });
      setQuizzes((current) => current?.filter((item) => item.id !== quiz.id) ?? null);
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Mes quiz</h1>
          {user ? <p className="mt-1 text-ink-soft">Bonjour {user.displayName}.</p> : null}
        </div>
        <Button onClick={() => void createQuiz()} busy={busyId === 'new'}>
          Nouveau quiz
        </Button>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {quizzes === null ? (
        <Spinner label="Chargement de tes quiz…" />
      ) : quizzes.length === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-line bg-white px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-extrabold">Aucun quiz pour l’instant</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            Crée ton premier quiz, ou lance tout de suite un des quiz prêts à jouer ci-dessous :
            drapeaux et capitales du monde.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void createQuiz()} busy={busyId === 'new'}>
              Créer un quiz
            </Button>
            <Button
              variant="secondary"
              onClick={() => void createSample()}
              busy={busyId === 'sample'}
            >
              Ajouter le quiz d’exemple
            </Button>
          </div>
        </section>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/host/quizzes/${quiz.id}`}
                  className="text-xl font-bold underline-offset-4 hover:underline"
                >
                  {quiz.title}
                </Link>
                <p className="mt-1 text-sm text-ink-soft">
                  {plural(quiz.questionCount, 'question')}, modifié le {formatDate(quiz.updatedAt)}
                  {quiz.isPublic ? ', public' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  onClick={() => void launch(quiz)}
                  busy={busyId === quiz.id}
                  disabled={quiz.questionCount === 0}
                  title={quiz.questionCount === 0 ? 'Ajoute au moins une question' : undefined}
                >
                  Lancer
                </Button>
                <Link
                  to={`/host/quizzes/${quiz.id}`}
                  className="rounded-xl px-4 py-2.5 font-bold hover:bg-line/60"
                >
                  Modifier
                </Link>
                <Button
                  variant="quiet"
                  onClick={() => void duplicate(quiz)}
                  disabled={busyId === quiz.id}
                >
                  Dupliquer
                </Button>
                <Button variant="danger" onClick={() => remove(quiz)} disabled={busyId === quiz.id}>
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateLibrary
        busyKey={busyId}
        onPlay={(template) => void playTemplate(template)}
        onAdd={(template) => void addTemplate(template)}
      />
    </div>
  );
}
