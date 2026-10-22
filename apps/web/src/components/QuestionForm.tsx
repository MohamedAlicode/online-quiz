import { LIMITS, questionInputSchema, type QuestionDto, type QuestionType } from '@quiz/shared';
import { useId, useState, type FormEvent } from 'react';
import { answerStyle } from '../lib/answers';
import { Alert, Button, TextField } from './ui';

interface DraftChoice {
  text: string;
  isCorrect: boolean;
}

export interface QuestionDraft {
  type: QuestionType;
  text: string;
  imageUrl: string;
  timeLimitSec: number;
  basePoints: number;
  choices: DraftChoice[];
}

const TRUE_FALSE_CHOICES: DraftChoice[] = [
  { text: 'Vrai', isCorrect: true },
  { text: 'Faux', isCorrect: false },
];

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const POINT_OPTIONS = [
  { value: 1000, label: 'Standard (1000)' },
  { value: 2000, label: 'Double (2000)' },
  { value: 0, label: 'Sans points' },
];

export function emptyDraft(): QuestionDraft {
  return {
    type: 'SINGLE',
    text: '',
    imageUrl: '',
    timeLimitSec: LIMITS.defaultTimeLimitSec,
    basePoints: 1000,
    choices: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}

export function draftFromQuestion(question: QuestionDto): QuestionDraft {
  return {
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl ?? '',
    timeLimitSec: question.timeLimitSec,
    basePoints: question.basePoints,
    choices: question.choices.map(({ text, isCorrect }) => ({ text, isCorrect })),
  };
}

interface QuestionFormProps {
  initial: QuestionDraft;
  submitLabel: string;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
}

export function QuestionForm({ initial, submitLabel, onSubmit, onCancel }: QuestionFormProps) {
  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const groupName = useId();
  const isTrueFalse = draft.type === 'TRUE_FALSE';

  const patch = (changes: Partial<QuestionDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const setType = (type: QuestionType) =>
    patch({
      type,
      choices:
        type === 'TRUE_FALSE'
          ? TRUE_FALSE_CHOICES
          : draft.type === 'TRUE_FALSE'
            ? emptyDraft().choices
            : draft.choices,
    });

  const updateChoice = (index: number, changes: Partial<DraftChoice>) =>
    patch({
      choices: draft.choices.map((choice, i) => (i === index ? { ...choice, ...changes } : choice)),
    });

  const markCorrect = (index: number) =>
    patch({ choices: draft.choices.map((choice, i) => ({ ...choice, isCorrect: i === index })) });

  const removeChoice = (index: number) => {
    const choices = draft.choices.filter((_, i) => i !== index);
    if (!choices.some((choice) => choice.isCorrect) && choices[0])
      choices[0] = { ...choices[0], isCorrect: true };
    patch({ choices });
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Les réponses vides en fin de liste sont ignorées (on peut n'en remplir que deux).
    const choices = isTrueFalse
      ? draft.choices
      : draft.choices.filter((choice) => choice.text.trim() !== '');
    const parsed = questionInputSchema.safeParse({ ...draft, choices });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Question invalide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 font-bold">Type de question</legend>
        {(
          [
            ['SINGLE', 'Choix unique'],
            ['TRUE_FALSE', 'Vrai ou faux'],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`cursor-pointer rounded-xl px-4 py-2 font-bold ring-2 ring-inset has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-stage ${
              draft.type === value ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'
            }`}
          >
            <input
              type="radio"
              name={`${groupName}-type`}
              value={value}
              checked={draft.type === value}
              onChange={() => setType(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${groupName}-text`} className="font-bold">
          Intitulé
        </label>
        <textarea
          id={`${groupName}-text`}
          rows={2}
          maxLength={LIMITS.questionTextMax}
          value={draft.text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="Ex. Quelle est la capitale de l’Italie ?"
          className="rounded-xl border-2 border-line bg-white px-3.5 py-2.5 focus:border-stage focus:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Temps pour répondre"
          value={draft.timeLimitSec}
          options={TIME_OPTIONS.map((seconds) => ({
            value: seconds,
            label: `${seconds} secondes`,
          }))}
          onChange={(timeLimitSec) => patch({ timeLimitSec })}
        />
        <SelectField
          label="Points"
          value={draft.basePoints}
          options={POINT_OPTIONS}
          onChange={(basePoints) => patch({ basePoints })}
        />
      </div>

      <TextField
        label="Image (facultatif)"
        type="url"
        placeholder="https://…"
        hint="Lien direct vers une image, affichée sur l’écran projeté."
        value={draft.imageUrl}
        onChange={(event) => patch({ imageUrl: event.target.value })}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-bold">Réponses (coche la bonne)</legend>
        {draft.choices.map((choice, index) => {
          const style = answerStyle(index);
          return (
            <div key={index} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`numerals flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-ink ${style.bg}`}
              >
                {style.letter}
              </span>
              <input
                aria-label={`Texte de la réponse ${style.letter}`}
                value={choice.text}
                readOnly={isTrueFalse}
                maxLength={LIMITS.choiceTextMax}
                onChange={(event) => updateChoice(index, { text: event.target.value })}
                placeholder={index < 2 ? 'Réponse' : 'Réponse (facultatif)'}
                className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 read-only:bg-paper focus:border-stage focus:outline-none"
              />
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 font-bold">
                <input
                  type="radio"
                  name={`${groupName}-correct`}
                  checked={choice.isCorrect}
                  onChange={() => markCorrect(index)}
                  className="size-5 accent-meadow"
                />
                <span className="sr-only sm:not-sr-only">Bonne</span>
                <span className="sr-only"> réponse {style.letter}</span>
              </label>
              {!isTrueFalse && draft.choices.length > LIMITS.minChoices ? (
                <button
                  type="button"
                  onClick={() => removeChoice(index)}
                  aria-label={`Retirer la réponse ${style.letter}`}
                  className="rounded-lg px-2 py-2 text-ink-soft hover:bg-line/60"
                >
                  ✕
                </button>
              ) : null}
            </div>
          );
        })}
        {!isTrueFalse && draft.choices.length < LIMITS.maxChoices ? (
          <Button
            variant="quiet"
            className="self-start"
            onClick={() => patch({ choices: [...draft.choices, { text: '', isCorrect: false }] })}
          >
            Ajouter une réponse
          </Button>
        ) : null}
      </fieldset>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-12 rounded-xl border-2 border-line bg-white px-3 focus:border-stage focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
