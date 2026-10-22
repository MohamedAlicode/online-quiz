import type { GameSummaryDto } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDateTime, plural } from '../lib/format';

export function HistoryPage() {
  const [games, setGames] = useState<GameSummaryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ games: GameSummaryDto[] }>('/games')
      .then(({ games: list }) => setGames(list))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-extrabold">Historique des parties</h1>
      {error ? <Alert>{error}</Alert> : null}
      {games === null && !error ? <Spinner label="Chargement de l’historique…" /> : null}
      {games?.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-line bg-white px-6 py-10 text-center text-ink-soft">
          Les parties que tu termines apparaîtront ici, avec le classement et les statistiques par
          question.
        </p>
      ) : null}
      {games && games.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                to={`/host/history/${game.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-lg font-bold">{game.quizTitle}</span>
                <span className="text-sm text-ink-soft">
                  {formatDateTime(game.startedAt)}, {plural(game.playerCount, 'joueur')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
