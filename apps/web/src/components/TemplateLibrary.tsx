import type { QuizTemplateDto } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Alert, Button, Spinner } from './ui';

interface TemplateLibraryProps {
  /** Ajoute une copie du quiz puis lance directement la partie. */
  onPlay: (template: QuizTemplateDto) => void;
  /** Ajoute une copie du quiz dans « Mes quiz » pour la modifier. */
  onAdd: (template: QuizTemplateDto) => void;
  busyKey: string | null;
}

/** Bibliothèque de quiz prêts à jouer (drapeaux, capitales), proposée à tous les hôtes. */
export function TemplateLibrary({ onPlay, onAdd, busyKey }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<QuizTemplateDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ templates: QuizTemplateDto[] }>('/templates')
      .then(({ templates: list }) => setTemplates(list))
      .catch((caught: unknown) => setError(errorMessage(caught)));
  }, []);

  return (
    <section aria-labelledby="templates-title" className="flex flex-col gap-4">
      <div>
        <h2 id="templates-title" className="font-display text-2xl font-extrabold">
          Quiz prêts à jouer
        </h2>
        <p className="mt-1 text-ink-soft">
          Les pays sont tirés au hasard à chaque partie, et la dernière question compte double.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {templates === null && !error ? <Spinner label="Chargement des quiz prêts à jouer…" /> : null}

      {templates ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <li
              key={template.slug}
              className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white"
            >
              <div aria-hidden="true" className="grid grid-cols-4 gap-1 bg-stage p-3">
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
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-xl font-bold">{template.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    {template.questionCount} questions. {template.description}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    onClick={() => onPlay(template)}
                    busy={busyKey === `play:${template.slug}`}
                    disabled={busyKey !== null}
                  >
                    Jouer maintenant
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onAdd(template)}
                    busy={busyKey === `add:${template.slug}`}
                    disabled={busyKey !== null}
                  >
                    Ajouter à mes quiz
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
