import type { QuizSummaryDto, QuizTemplateDto } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Logo, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { plural } from '../lib/format';
import { useAuthStore } from '../stores/auth-store';

/** Choix d'un quiz pour s'entraîner seul, sans compte ni code de partie. */
export function PracticeHomePage() {
  const token = useAuthStore((state) => state.token);
  const [templates, setTemplates] = useState<QuizTemplateDto[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ templates: QuizTemplateDto[] }>('/practice/templates')
      .then(({ templates: list }) => setTemplates(list))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, []);

  useEffect(() => {
    if (!token) return;
    api<{ quizzes: QuizSummaryDto[] }>('/quizzes')
      .then(({ quizzes: list }) => setQuizzes(list.filter((quiz) => quiz.questionCount > 0)))
      .catch(() => setQuizzes([]));
  }, [token]);

  return (
    <div className="on-stage min-h-dvh bg-stage text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" aria-label="Quiz Live, accueil">
          <Logo />
        </Link>
        <Link to="/" className="rounded-lg px-3 py-2 font-bold underline-offset-4 hover:underline">
          Rejoindre une partie
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-16">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
            S’entraîner seul
          </h1>
          <p className="mt-3 text-lg text-white/85">
            Choisis un quiz, puis apprends à ton rythme ou lance-toi un défi chronométré. Pas besoin
            de compte ni de code.
          </p>
        </div>

        {error ? <Alert>{error}</Alert> : null}
        {templates === null && !error ? <Spinner label="Chargement des quiz…" /> : null}

        {templates ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {templates.map((template) => (
              <li key={template.slug}>
                <Link
                  to={`/practice/${template.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white text-ink"
                >
                  <div aria-hidden="true" className="grid grid-cols-4 gap-1 bg-stage-deep p-3">
                    {template.previewImages.map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-4 p-5">
                    <div>
                      <h2 className="text-xl font-bold group-hover:underline group-hover:underline-offset-4">
                        {template.title}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {template.questionCount} questions
                      </p>
                    </div>
                    <span className="rounded-xl bg-stage px-4 py-2.5 font-bold text-white">
                      Commencer
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {quizzes.length > 0 ? (
          <section aria-labelledby="my-quizzes" className="flex flex-col gap-3">
            <h2 id="my-quizzes" className="font-display text-2xl font-extrabold">
              Tes quiz
            </h2>
            <ul className="divide-y divide-white/15 overflow-hidden rounded-3xl bg-white/10">
              {quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <Link
                    to={`/practice/quiz/${quiz.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/10"
                  >
                    <span className="font-bold">{quiz.title}</span>
                    <span className="text-sm text-white/80">
                      {plural(quiz.questionCount, 'question')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
