import type { GameResultsDto } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Spinner } from '../components/ui';
import { answerStyle } from '../lib/answers';
import { api, downloadFile, errorMessage } from '../lib/api';
import { formatDateTime, formatPercent, plural } from '../lib/format';

export function ResultsPage() {
  const { gameId = '' } = useParams();
  const [results, setResults] = useState<GameResultsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api<{ results: GameResultsDto }>(`/games/${gameId}/results`)
      .then(({ results: loaded }) => setResults(loaded))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, [gameId]);

  async function exportCsv() {
    setDownloading(true);
    try {
      await downloadFile(`/games/${gameId}/results.csv`, 'resultats.csv');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDownloading(false);
    }
  }

  if (error && !results) return <Alert>{error}</Alert>;
  if (!results) return <Spinner label="Chargement des résultats…" />;

  const hardest = new Set(results.hardestQuestionIds);
  const averageSuccess =
    results.questions.length > 0
      ? results.questions.reduce((sum, question) => sum + question.successRate, 0) /
        results.questions.length
      : 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/host/history" className="font-bold text-ink-soft hover:text-ink">
            Retour à l’historique
          </Link>
          <h1 className="mt-2 font-display text-4xl font-extrabold">{results.game.quizTitle}</h1>
          <p className="mt-1 text-ink-soft">
            {formatDateTime(results.game.startedAt)}, {plural(results.game.playerCount, 'joueur')},{' '}
            {plural(results.questions.length, 'question jouée', 'questions jouées')},{' '}
            {formatPercent(averageSuccess)} de bonnes réponses en moyenne
          </p>
        </div>
        <Button variant="secondary" onClick={() => void exportCsv()} busy={downloading}>
          Exporter en CSV
        </Button>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <section aria-labelledby="ranking-title" className="flex flex-col gap-4">
        <h2 id="ranking-title" className="font-display text-2xl font-extrabold">
          Classement final
        </h2>
        <div className="overflow-x-auto rounded-3xl border border-line bg-white">
          <table className="w-full min-w-[28rem] text-left">
            <thead className="border-b border-line text-sm text-ink-soft">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Rang
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Joueur
                </th>
                <th scope="col" className="px-5 py-3 text-right font-bold">
                  Score
                </th>
                <th scope="col" className="px-5 py-3 text-right font-bold">
                  Bonnes réponses
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.ranking.map((row) => (
                <tr key={row.nickname}>
                  <td className="numerals px-5 py-3 text-xl font-black">{row.rank}</td>
                  <td className="px-5 py-3 font-bold">{row.nickname}</td>
                  <td className="numerals px-5 py-3 text-right text-lg font-black">{row.score}</td>
                  <td className="px-5 py-3 text-right">
                    {row.correctCount} / {results.questions.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="questions-title" className="flex flex-col gap-4">
        <h2 id="questions-title" className="font-display text-2xl font-extrabold">
          Réussite par question
        </h2>
        <ol className="flex flex-col gap-3">
          {results.questions.map((question) => (
            <li key={question.id} className="rounded-3xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">
                  <span className="numerals mr-2 text-ink-soft">{question.position + 1}</span>
                  {question.text}
                </h3>
                <span className="numerals text-2xl font-black">
                  {formatPercent(question.successRate)}
                </span>
              </div>
              {hardest.has(question.id) && question.successRate < 0.5 ? (
                <p className="mt-1 text-sm font-bold text-tomato-ink">
                  Parmi les questions les plus ratées
                </p>
              ) : null}
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-line"
                role="img"
                aria-label={`${formatPercent(question.successRate)} de bonnes réponses`}
              >
                <div
                  className="h-full rounded-full bg-meadow"
                  style={{ width: `${question.successRate * 100}%` }}
                />
              </div>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {question.choices.map((choice, index) => (
                  <li key={choice.choiceId} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`numerals flex size-7 items-center justify-center rounded-lg font-black ${answerStyle(index).bg}`}
                    >
                      {answerStyle(index).letter}
                    </span>
                    <span className={choice.isCorrect ? 'font-bold' : ''}>
                      {choice.text}
                      {choice.isCorrect ? ' (bonne réponse)' : ''}
                    </span>
                    <span className="ml-auto text-ink-soft">{plural(choice.count, 'réponse')}</span>
                  </li>
                ))}
              </ul>
              {question.averageTimeMs !== null ? (
                <p className="mt-3 text-sm text-ink-soft">
                  Temps de réponse moyen :{' '}
                  {(question.averageTimeMs / 1000).toFixed(1).replace('.', ',')} s
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
