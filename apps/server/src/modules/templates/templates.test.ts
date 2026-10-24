import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionInputSchema } from '@quiz/shared';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import {
  buildTemplateQuestions,
  findTemplate,
  shuffle,
  TEMPLATES,
  toTemplateDto,
} from './templates';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../web/public');

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : tirages reproductibles. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const byName = new Map(COUNTRIES.map((country) => [country.name, country]));
const byCapital = new Map(COUNTRIES.map((country) => [country.capital, country]));

describe('données des pays', () => {
  it('a des codes uniques et une image de drapeau et de carte pour chaque pays', () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(existsSync(join(publicDir, 'quiz-images/flags', `${code}.svg`)), code).toBe(true);
      expect(existsSync(join(publicDir, 'quiz-images/maps', `${code}.svg`)), code).toBe(true);
    }
  });

  it('écrit correctement le complément « de la / du / des / de l’ »', () => {
    for (const country of COUNTRIES) {
      expect(country.of, country.name).toMatch(/^(de la |du |des |de l'|de )/);
      expect(country.of.endsWith(country.name), country.name).toBe(true);
    }
  });

  it('a assez de pays par région pour proposer trois mauvaises réponses', () => {
    const counts = new Map<string, number>();
    for (const country of COUNTRIES)
      counts.set(country.region, (counts.get(country.region) ?? 0) + 1);
    for (const [region, count] of counts) expect(count, region).toBeGreaterThanOrEqual(4);
  });
});

describe('quiz prêts à jouer', () => {
  for (const template of TEMPLATES) {
    describe(template.title, () => {
      const questions = buildTemplateQuestions(template, seeded(42));

      it('produit le bon nombre de questions, toutes valides', () => {
        expect(questions).toHaveLength(template.questionCount);
        for (const question of questions) {
          expect(questionInputSchema.safeParse(question).success, question.text).toBe(true);
        }
      });

      it('ne pose pas deux fois la même question', () => {
        const images = questions.map((question) => question.imageUrl);
        expect(new Set(images).size).toBe(images.length);
      });

      it('propose 4 réponses distinctes dont une seule juste, cohérente avec l’image', () => {
        for (const question of questions) {
          const texts = question.choices.map((choice) => choice.text);
          expect(new Set(texts).size).toBe(4);

          const correct = question.choices.filter((choice) => choice.isCorrect);
          expect(correct).toHaveLength(1);
          const country =
            template.kind === 'flag'
              ? byName.get(correct[0]!.text)
              : byCapital.get(correct[0]!.text);
          expect(country, correct[0]!.text).toBeDefined();
          expect(question.imageUrl).toContain(`/${country!.code}.svg`);
          if (template.kind === 'capital') expect(question.text).toContain(country!.of);
        }
      });

      it('choisit les mauvaises réponses dans la même région', () => {
        for (const question of questions) {
          const lookup = template.kind === 'flag' ? byName : byCapital;
          const regions = new Set(
            question.choices.map((choice) => lookup.get(choice.text)?.region),
          );
          expect(regions.size).toBe(1);
        }
      });

      it('double les points de la dernière question uniquement', () => {
        expect(questions.at(-1)?.basePoints).toBe(2000);
        expect(questions.slice(0, -1).every((question) => question.basePoints === 1000)).toBe(true);
      });

      it('expose un aperçu avec des images existantes', () => {
        const dto = toTemplateDto(template);
        expect(dto.previewImages).toHaveLength(4);
        for (const image of dto.previewImages)
          expect(existsSync(join(publicDir, image))).toBe(true);
      });
    });
  }

  it('mélange les continents dans les quiz « du monde »', () => {
    const template = findTemplate('drapeaux-monde')!;
    const questions = buildTemplateQuestions(template, seeded(7));
    const regions = new Set(
      questions.map(
        (question) => byName.get(question.choices.find((c) => c.isCorrect)!.text)?.region,
      ),
    );
    expect(regions.size).toBe(5);
  });

  it('donne une partie différente à chaque tirage, et la même avec la même graine', () => {
    const template = findTemplate('capitales-europe')!;
    const first = buildTemplateQuestions(template, seeded(1)).map((q) => q.text);
    const again = buildTemplateQuestions(template, seeded(1)).map((q) => q.text);
    const other = buildTemplateQuestions(template, seeded(2)).map((q) => q.text);
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('mélange sans modifier le tableau reçu', () => {
    const items = [1, 2, 3, 4, 5];
    const mixed = shuffle(items, seeded(3));
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...mixed].sort()).toEqual(items);
  });
});
