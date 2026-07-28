#!/usr/bin/env node
/**
 * Score real, published, well-rated recipes with the model and see what happens.
 *
 * THE QUESTION THIS ANSWERS
 *
 * Every vertex in this model is a median of surveyed recipes, and every score
 * weight is an invention. Those are different kinds of claim. The vertices can be
 * checked against sources; the score cannot — until now.
 *
 * A recipe with 101 ratings at 4.91 stars is, by any reasonable standard, good.
 * If the model scores it badly, the model is wrong. That is a real falsification
 * test and it has never been run.
 *
 * WHAT IT CANNOT SHOW
 *
 * Ratings are severely positivity-biased — Food.com's median is 5.0, and the
 * curated sites cluster at 4.7-4.9. So a rank correlation between score and stars
 * is not available; the ratings have almost no variance to correlate against.
 * What IS available is the one-sided check: no well-rated recipe should score
 * poorly. That is the user-facing property that matters.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractAll } from '../src/data/extract.js';
import { morphology } from '../src/model/morphology.js';
import { score } from '../src/model/score.js';
import { SODA_TO_POWDER_EQUIV } from '../src/model/vertices.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { records } = JSON.parse(readFileSync(join(root, 'data/sources.json'), 'utf8'));
const rows = extractAll(records);

/**
 * Score a real recipe using ITS OWN measured composition, not the interpolated
 * composition the triangle would predict at its position. That distinction is the
 * whole point: we are testing the score function, not the interpolation.
 */
function scoreReal(row, waterLoadNorm = 0.69) {
  const ing = {
    flour: (row.flourG / row.basisG) * 100,
    oats: (row.oatsG / row.basisG) * 100,
    butter: row.fatPct ?? 0,
    sugar: row.sugarPct ?? 0,
    salt: row.saltPct ?? 0,
    buttermilk: row.liquidPct ?? 0,
    bakingPowder: row.bakingPowderPct ?? 0,
    bakingSoda: row.bakingSodaPct ?? 0,
  };
  const hydration = ing.buttermilk;
  const morph = morphology(hydration);
  const leaveningPower = ing.bakingPowder + SODA_TO_POWDER_EQUIV * ing.bakingSoda;
  return score({ ingredients: ing, hydration, leaveningPower, morph, waterLoadNorm });
}

/** Where a real recipe lands on the triangle, from its two coordinates. */
function coordsOf(row) {
  const b = Math.max(0, Math.min(1, (row.oatFractionPct ?? 0) / 41));
  const c = Math.max(0, Math.min(1, (row.liquidPct ?? 0) / 80));
  const a = Math.max(0, 1 - b - c);
  const t = a + b + c;
  return { crumble: a / t, crisp: b / t, cobbler: c / t };
}

const usable = rows.filter((r) => !r.excluded && r.basisG > 0);

console.log('Real recipes scored by the model, using their own measured composition.\n');
console.log(
  'recipe'.padEnd(34), 'stars'.padStart(6), 'n'.padStart(6),
  'score'.padStart(7), '  weakest component',
);
console.log('-'.repeat(104));

const scored = usable.map((r) => {
  const s = scoreReal(r);
  const weakest = Object.entries(s.components)
    .sort((a, b) => a[1].value - b[1].value)[0];
  return { row: r, s, weakest };
}).sort((a, b) => a.s.overall - b.s.overall);

for (const { row, s, weakest } of scored) {
  const stars = row.ratingStars != null ? row.ratingStars.toFixed(2) : '—';
  const n = row.ratingCount != null ? String(row.ratingCount) : '—';
  const flag = s.overall < 0.7 ? '  <-- LOW' : '';
  console.log(
    `${row.source} ${row.title}`.slice(0, 33).padEnd(34),
    stars.padStart(6), n.padStart(6),
    s.overall.toFixed(3).padStart(7),
    ` ${weakest[1].label} ${weakest[1].value.toFixed(2)}${flag}`,
  );
}

// --- The one-sided check ---------------------------------------------------

console.log('\n' + '='.repeat(104));
console.log('THE FALSIFICATION TEST: does any well-rated recipe score badly?');
console.log('='.repeat(104));

const wellRated = scored.filter(
  ({ row }) => row.ratingStars != null && row.ratingStars >= 4.5 && (row.ratingCount ?? 0) >= 20,
);
console.log(`\n${wellRated.length} recipes rated >=4.5 stars with >=20 ratings:\n`);
let failures = 0;
for (const { row, s, weakest } of wellRated) {
  const ok = s.overall >= 0.7;
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${s.overall.toFixed(3)}  ${row.ratingStars}★/${row.ratingCount}` +
    `  ${row.source} — weakest: ${weakest[1].label} ${weakest[1].value.toFixed(2)}`,
  );
}
console.log(
  failures === 0
    ? '\nNo well-rated recipe scores below 0.70. The model does not condemn anything people love.'
    : `\n${failures} well-rated recipe(s) score below 0.70 — the model contradicts real reception.`,
);

// --- Corner coverage -------------------------------------------------------

console.log('\n' + '='.repeat(104));
console.log('CORNER COVERAGE: is each vertex anchored by a real, well-rated recipe?');
console.log('='.repeat(104));

const CORNERS = {
  crumble: (c) => c.crumble > 0.8,
  crisp: (c) => c.crisp > 0.55,
  cobbler: (c) => c.cobbler > 0.6,
};

for (const [corner, test] of Object.entries(CORNERS)) {
  const near = scored
    .map((x) => ({ ...x, c: coordsOf(x.row) }))
    .filter((x) => test(x.c))
    .sort((a, b) => (b.row.ratingStars ?? 0) - (a.row.ratingStars ?? 0));

  console.log(`\n${corner.toUpperCase()}  — ${near.length} corpus recipes land here`);
  if (!near.length) {
    console.log('  NONE. This vertex has no real anchor in the corpus.');
    continue;
  }
  for (const { row, s, c } of near.slice(0, 4)) {
    const stars = row.ratingStars != null ? `${row.ratingStars}★/${row.ratingCount}` : 'unrated';
    console.log(
      `  ${s.overall.toFixed(3)}  ${stars.padEnd(12)}  ` +
      `[${(c.crumble * 100).toFixed(0)}/${(c.crisp * 100).toFixed(0)}/${(c.cobbler * 100).toFixed(0)}]  ${row.source} ${row.title}`.slice(0, 84),
    );
  }
  const best = near.filter((x) => (x.row.ratingStars ?? 0) >= 4.5);
  console.log(
    best.length
      ? `  -> anchored: ${best.length} recipe(s) at >=4.5 stars, best model score ${Math.max(...best.map((x) => x.s.overall)).toFixed(3)}`
      : '  -> NOT anchored by any >=4.5-star recipe in the corpus',
  );
}
