import type { ReactNode } from 'react';
import type { ConnectionStatus } from '../stores/game-store';

interface StageShellProps {
  children: ReactNode;
  /** Couleur de fond (la scène change de couleur sur l'écran de résultat du joueur). */
  tone?: string;
  connection: ConnectionStatus;
}

/** Fond plein écran des écrans de jeu, avec un bandeau en cas de coupure réseau. */
export function StageShell({ children, tone = 'bg-stage', connection }: StageShellProps) {
  return (
    <div
      className={`on-stage flex min-h-dvh flex-col text-white transition-colors duration-500 ${tone}`}
    >
      {connection === 'disconnected' ? (
        <div role="status" className="bg-ink px-4 py-2 text-center font-bold">
          Connexion perdue, reconnexion en cours…
        </div>
      ) : null}
      {children}
    </div>
  );
}
