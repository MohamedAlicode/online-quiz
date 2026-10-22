import type { QuizDto } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Spinner } from '../components/ui';
import { AnswerTile } from '../game/AnswerTile';
import { api, errorMessage } from '../lib/api';

/** Aperçu des questions telles qu'elles seront projetées, avant de lancer la partie. */
export function QuizPreviewPage() {
  const { quizId = '' } = useParams();
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    api<{ quiz: QuizDto }>(`/quizzes/${quizId}`)
      .then(({ quiz: loaded }) => setQuiz(loaded))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, [quizId]);

  if (error) return <Alert>{error}</Alert>;
  if (!quiz) return <Spinner label="Chargement de l’aperçu…" />;

  const question = quiz.questions[index];
  const go = (delta: number) => {
    setIndex((current) => Math.min(Math.max(current + delta, 0), quiz.questions.length - 1));
    setRevealed(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/host/quizzes/${quiz.id}`} className="font-bold text-ink-soft hover:text-ink">
          Retour à l’édition
        </Link>
        <p className="font-bold">
          Question {index + 1} sur {quiz.questions.length}
        </p>
      </div>

      {question ? (
        <section
          aria-label="Aperçu de l’écran projeté"
          className="on-stage flex aspect-auto flex-col gap-6 rounded-3xl bg-stage p-5 text-white sm:aspect-video sm:p-8"
        >
          <p className="text-sm font-bold text-white/80">
            {question.timeLimitSec} secondes
            {question.basePoints === 2000
              ? ', points doubles'
              : question.basePoints === 0
                ? ', sans points'
                : ''}
          </p>
          <h1 className="font-display text-2xl leading-tight font-extrabold sm:text-4xl">
            {question.text}
          </h1>
          {question.imageUrl ? (
            <img
              src={question.imageUrl}
              alt=""
              className="max-h-40 self-start rounded-2xl object-contain"
            />
          ) : null}
          <div className="mt-auto grid gap-3 md:grid-cols-2">
            {question.choices.map((choice, choiceIndex) => (
              <AnswerTile
                key={choice.id}
                index={choiceIndex}
                text={choice.text}
                state={revealed ? (choice.isCorrect ? 'correct' : 'dimmed') : 'idle'}
              />
            ))}
          </div>
        </section>
      ) : (
        <p>Ce quiz n’a pas encore de question.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => go(-1)} disabled={index === 0}>
          Question précédente
        </Button>
        <Button variant="secondary" onClick={() => setRevealed((value) => !value)}>
          {revealed ? 'Masquer la réponse' : 'Afficher la réponse'}
        </Button>
        <Button onClick={() => go(1)} disabled={index >= quiz.questions.length - 1}>
          Question suivante
        </Button>
      </div>
    </div>
  );
}
