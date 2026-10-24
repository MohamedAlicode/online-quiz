import type { QuestionData, QuizTemplateDto } from '@quiz/shared';
import { COUNTRIES, type Country, type Region } from './countries';

/** Générateur aléatoire injectable (Math.random en production, graine fixe dans les tests). */
export type Random = () => number;

type TemplateKind = 'flag' | 'capital';

export interface TemplateDefinition {
  slug: string;
  title: string;
  description: string;
  kind: TemplateKind;
  /** Régions dont sont tirés les pays ; `null` pour le monde entier. */
  regions: Region[] | null;
  questionCount: number;
  timeLimitSec: number;
  /** Pays montrés en aperçu dans la bibliothèque. */
  previewCodes: string[];
}

export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    slug: 'drapeaux-europe',
    title: "Drapeaux d'Europe",
    description: 'Reconnais les drapeaux européens. Idéal pour démarrer une partie.',
    kind: 'flag',
    regions: ['europe'],
    questionCount: 10,
    timeLimitSec: 15,
    previewCodes: ['fr', 'de', 'it', 'se'],
  },
  {
    slug: 'drapeaux-monde',
    title: 'Drapeaux du monde',
    description: 'Des drapeaux des cinq continents, pour les joueurs qui ont voyagé.',
    kind: 'flag',
    regions: null,
    questionCount: 12,
    timeLimitSec: 20,
    previewCodes: ['jp', 'br', 'ke', 'au'],
  },
  {
    slug: 'capitales-europe',
    title: "Capitales d'Europe",
    description: 'Retrouve la capitale de chaque pays européen, avec sa carte en indice.',
    kind: 'capital',
    regions: ['europe'],
    questionCount: 10,
    timeLimitSec: 20,
    previewCodes: ['es', 'pl', 'gr', 'no'],
  },
  {
    slug: 'capitales-monde',
    title: 'Capitales du monde',
    description: 'Des capitales des cinq continents, avec la carte de chaque pays en indice.',
    kind: 'capital',
    regions: null,
    questionCount: 12,
    timeLimitSec: 20,
    previewCodes: ['ca', 'eg', 'in', 'nz'],
  },
];

const CHOICES_PER_QUESTION = 4;

export const flagImage = (code: string) => `/quiz-images/flags/${code}.svg`;
export const mapImage = (code: string) => `/quiz-images/maps/${code}.svg`;

/** Mélange de Fisher-Yates, sans modifier le tableau reçu. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/**
 * Tire les pays d'un quiz. Pour le monde entier, on alterne les continents : sinon l'Europe,
 * la plus représentée dans la liste, prendrait la majorité des questions.
 */
function pickCountries(definition: TemplateDefinition, random: Random): Country[] {
  const pool = COUNTRIES.filter(
    (country) => definition.regions === null || definition.regions.includes(country.region),
  );
  if (definition.regions !== null) {
    return shuffle(pool, random).slice(0, definition.questionCount);
  }

  const byRegion = new Map<Region, Country[]>();
  for (const country of shuffle(pool, random)) {
    byRegion.set(country.region, [...(byRegion.get(country.region) ?? []), country]);
  }
  const queues = shuffle([...byRegion.values()], random);
  const picked: Country[] = [];
  while (picked.length < definition.questionCount && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < definition.questionCount) picked.push(next);
    }
  }
  return shuffle(picked, random);
}

/** Mauvaises réponses : des pays de la même région, pour que la question reste un vrai défi. */
function distractors(country: Country, random: Random): Country[] {
  const sameRegion = COUNTRIES.filter(
    (candidate) => candidate.region === country.region && candidate.code !== country.code,
  );
  return shuffle(sameRegion, random).slice(0, CHOICES_PER_QUESTION - 1);
}

function buildQuestion(
  definition: TemplateDefinition,
  country: Country,
  random: Random,
  isLast: boolean,
): QuestionData {
  const label = (candidate: Country) =>
    definition.kind === 'flag' ? candidate.name : candidate.capital;
  const options = shuffle([country, ...distractors(country, random)], random);

  return {
    type: 'SINGLE',
    text:
      definition.kind === 'flag'
        ? 'À quel pays appartient ce drapeau ?'
        : `Quelle est la capitale ${country.of} ?`,
    imageUrl: definition.kind === 'flag' ? flagImage(country.code) : mapImage(country.code),
    timeLimitSec: definition.timeLimitSec,
    // Question finale à points doubles, comme dans les jeux télévisés.
    basePoints: isLast ? 2000 : 1000,
    choices: options.map((option) => ({
      text: label(option),
      isCorrect: option.code === country.code,
    })),
  };
}

export function buildTemplateQuestions(
  definition: TemplateDefinition,
  random: Random,
): QuestionData[] {
  const countries = pickCountries(definition, random);
  return countries.map((country, index) =>
    buildQuestion(definition, country, random, index === countries.length - 1),
  );
}

export function findTemplate(slug: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.slug === slug);
}

export function toTemplateDto(definition: TemplateDefinition): QuizTemplateDto {
  const image = definition.kind === 'flag' ? flagImage : mapImage;
  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    questionCount: definition.questionCount,
    previewImages: definition.previewCodes.map(image),
  };
}
