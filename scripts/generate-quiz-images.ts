/**
 * Génère les images des quiz prêts à jouer dans apps/web/public/quiz-images :
 * - flags/<code>.svg : drapeaux, copiés depuis le paquet flag-icons (licence MIT) ;
 * - maps/<code>.svg : cartes de situation où le pays est mis en évidence, découpées dans
 *   la carte du monde de @svg-maps/world (licence CC BY 4.0).
 *
 * Les images sont versionnées : ce script ne sert qu'à les régénérer si la liste des pays change.
 *   npx tsx scripts/generate-quiz-images.ts
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import world from '@svg-maps/world';
import { svgPathBbox } from 'svg-path-bbox';
import svgpath from 'svgpath';
import { COUNTRIES } from '../apps/server/src/modules/templates/countries';

type Box = { x0: number; y0: number; x1: number; y1: number };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/web/public/quiz-images');
const flagSource = join(root, 'node_modules/flag-icons/flags/4x3');

// Palette alignée sur l'écran de jeu (indigo « scène » et moutarde).
const SEA = '#2a1ea3';
const LAND = '#5b4fe0';
const TARGET = '#f5b700';
const INK = '#1b1446';

const [, , WORLD_W, WORLD_H] = world.viewBox.split(' ').map(Number) as [
  number,
  number,
  number,
  number,
];

/** Zones à cadrer à la main quand le pays a des territoires très éloignés. */
const FOCUS_OVERRIDES: Record<string, Box> = {
  us: { x0: 150, y0: 255, x1: 300, y1: 345 }, // États-Unis contigus (sans l'Alaska ni Hawaï)
  ru: { x0: 545, y0: 140, x1: 1000, y1: 330 },
  fj: { x0: 971, y0: 508, x1: 982, y1: 518 }, // îles principales de l'archipel
  no: { x0: 490, y0: 160, x1: 560, y1: 255 }, // Norvège continentale (sans le Svalbard)
};

/** Archipels aux îles minuscules : toujours entourés pour être repérables. */
const ALWAYS_RING = new Set(['fj']);

const toBox = ([x0, y0, x1, y1]: [number, number, number, number]): Box => ({ x0, y0, x1, y1 });
const width = (b: Box) => b.x1 - b.x0;
const height = (b: Box) => b.y1 - b.y0;
const intersects = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});

/** Cadre sur la partie principale du pays (plus grand polygone et ses voisins proches). */
function focusBox(absolutePath: string): Box {
  const subpaths = absolutePath
    .split(/(?=M)/)
    .map((d) => d.trim())
    .filter(Boolean);
  const boxes = subpaths.map((d) => toBox(svgPathBbox(d)));
  const largest = boxes.reduce((a, b) => (width(b) * height(b) > width(a) * height(a) ? b : a));
  const margin = Math.max(width(largest), height(largest)) * 0.9;
  const zone = {
    x0: largest.x0 - margin,
    y0: largest.y0 - margin,
    x1: largest.x1 + margin,
    y1: largest.y1 + margin,
  };
  return union(boxes.filter((box) => intersects(box, zone)));
}

/** Fenêtre 4:3 autour du pays, avec du contexte et sans sortir de la carte. */
function viewBox(focus: Box): Box {
  const cx = (focus.x0 + focus.x1) / 2;
  const cy = (focus.y0 + focus.y1) / 2;
  const w = Math.min(WORLD_W, Math.max(70, width(focus) * 1.7, height(focus) * 1.7 * (4 / 3)));
  const h = (w * 3) / 4;
  const x0 = Math.min(Math.max(cx - w / 2, 0), WORLD_W - w);
  const y0 = Math.min(Math.max(cy - h / 2, 0), WORLD_H - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

const round = (value: number) => Math.round(value * 10) / 10;

const locations = world.locations.map((location: { id: string; path: string }) => {
  const absolute = svgpath(location.path).abs().round(2).toString();
  return { id: location.id, absolute, box: toBox(svgPathBbox(absolute)) };
});

/** Tracé allégé : la précision s'adapte au zoom (inutile de garder des décimales sur une vue large). */
const compact = (absolute: string, digits: number) =>
  svgpath(absolute).round(digits).rel().round(digits).toString();
const byId = new Map(locations.map((location) => [location.id, location]));

function mapSvg(code: string): string {
  const target = byId.get(code);
  if (!target) throw new Error(`Pays absent de la carte : ${code}`);

  const focus = FOCUS_OVERRIDES[code] ?? focusBox(target.absolute);
  const view = viewBox(focus);
  const w = width(view);
  const digits = w >= 250 ? 0 : w >= 110 ? 1 : 2;
  const neighbours = locations
    .filter((location) => location.id !== code && intersects(location.box, view))
    .map((location) => `<path d="${compact(location.absolute, Math.min(digits, 1))}"/>`)
    .join('');

  // Un petit pays est entouré d'un cercle pour rester visible.
  const small = Math.max(width(focus), height(focus)) < w / 10 || ALWAYS_RING.has(code);
  const ring = small
    ? `<circle cx="${round((focus.x0 + focus.x1) / 2)}" cy="${round((focus.y0 + focus.y1) / 2)}" r="${round(w / 11)}" fill="none" stroke="${TARGET}" stroke-width="${round(w / 110)}"/>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(view.x0)} ${round(view.y0)} ${round(w)} ${round(height(view))}">`,
    `<rect x="${round(view.x0)}" y="${round(view.y0)}" width="${round(w)}" height="${round(height(view))}" fill="${SEA}"/>`,
    `<g fill="${LAND}" stroke="${SEA}" stroke-width="${round(w / 500) || 0.1}" stroke-linejoin="round">${neighbours}</g>`,
    `<path d="${compact(target.absolute, digits)}" fill="${TARGET}" stroke="${INK}" stroke-width="${round(w / 350) || 0.1}" stroke-linejoin="round"/>`,
    ring,
    '</svg>',
  ].join('');
}

function main() {
  const flags = new Set(readdirSync(flagSource).map((file) => file.replace(/\.svg$/, '')));
  const missing = COUNTRIES.filter(
    (country) => !flags.has(country.code) || !byId.has(country.code),
  );
  if (missing.length > 0) {
    throw new Error(`Images introuvables pour : ${missing.map((c) => c.code).join(', ')}`);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'flags'), { recursive: true });
  mkdirSync(join(outDir, 'maps'), { recursive: true });

  for (const country of COUNTRIES) {
    copyFileSync(
      join(flagSource, `${country.code}.svg`),
      join(outDir, 'flags', `${country.code}.svg`),
    );
    writeFileSync(join(outDir, 'maps', `${country.code}.svg`), mapSvg(country.code));
  }
  console.log(`${COUNTRIES.length} drapeaux et ${COUNTRIES.length} cartes générés dans ${outDir}`);
}

main();
