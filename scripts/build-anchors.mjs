#!/usr/bin/env node
/**
 * Place every surveyed recipe on the triangles.
 *
 * Reads data/sources.csv (itself regenerated from the verbatim ingredient lines
 * by build-dataset.mjs), projects each recipe onto both families, and writes
 * data/anchors.json for the UI to plot.
 *
 * WHAT THIS IS FOR. Until now the corpus justified the vertices and then sat in
 * a markdown file. Plotting it puts every claim the model makes next to the
 * recipes it was derived from: you can see whether the well-rated recipes really
 * do sit where the surface is high, whether the two families are as separated as
 * §11.1 says, and — from the residuals — how much of real practice the triangles
 * actually span.
 *
 * A recipe whose residual exceeds MAX_PLOTTABLE_RESIDUAL is kept in the file and
 * marked unplottable rather than dropped, because "this many surveyed recipes do
 * not fit on either triangle" is a finding about the model, not a data problem
 * to be hidden.
 *
 *   node scripts/build-anchors.mjs [--verbose]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FAMILIES } from '../src/model/families.js';
import { projectOntoFamily, MAX_PLOTTABLE_RESIDUAL, MAX_PLOTTABLE_FIELD, GOOD_RESIDUAL } from '../src/model/project.js';

const VERBOSE = process.argv.includes('--verbose');

/** Minimal CSV reader — the file is machine-generated, so quoting is regular. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length)
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * ONE DOCUMENTED CORRECTION, applied here rather than silently.
 *
 * ATK's Easy Blueberry Cobbler puts a 14 oz can of sweetened condensed milk in
 * the batter. The extractor counts all 397 g as LIQUID and none of it as sugar,
 * which is why that row reads 304 parts liquid against 29 parts sugar — both
 * far outside every other batter in the survey. The record's own flag says so:
 * "sugar is understated here: the condensed milk carries roughly 218 g more".
 *
 * Decomposed at 54% sugar / 27% water / 8% fat, it becomes fat 85, sugar 155,
 * liquid 134 — which agrees with the folk Magic Cobbler (90 / 160 / 144) to
 * within 6% on all three. The correction is applied to the ANCHOR only; fixing
 * it at source means teaching units.js to decompose compound ingredients, which
 * is a larger change than this script should make.
 */
const CORRECTIONS = {
  'batter-atk-easy-blueberry': {
    fatPct: 85, sugarPct: 155, liquidPct: 134,
    why: 'condensed milk decomposed into sugar / water / fat — see SOURCES §11.3',
  },
};

/**
 * Self-rising flour, unpacked.
 *
 * The extractor records "1 cup self-rising flour" as flour and nothing else, so
 * those rows carry ZERO leavening. The poured vertices unpack it — the batter
 * cobbler's 4.8 parts baking powder come from exactly this — so leaving the
 * anchors packed compares a recipe with no leavening against a vertex with 4.8
 * and calls a perfectly ordinary batter off-plane.
 *
 * US self-rising flour is conventionally 1.5 tsp baking powder + 0.5 tsp salt
 * per cup (125 g): 6 g / 125 g = 4.8 parts, 2.85 g / 125 g = 2.3 parts.
 *
 * Detected from the VERBATIM INGREDIENT LINES rather than the flags column. The
 * first version matched on flags and missed ATK's blueberry cobbler, whose flag
 * talks about the assembly and never mentions the flour — leaving it with zero
 * leavening against a vertex with 4.8, and reporting the single worst off-plane
 * deviation in the survey for what is actually the family's founding recipe.
 */
const SELF_RISING = { bakingPowder: 4.8, salt: 2.3 };

// Matches BOTH spellings. The first version used /self[- ]r[ai]ising/, which
// requires a letter between the r and the "ising" — so it matched the British
// "self-raising" and silently missed every American "self-rising", including the
// two recipes the batter-cobbler vertex is built from.
const SELF_RISING_RE = /self[- ]ra?ising/i;

const sourcesJson = JSON.parse(
  readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8'),
);
const SELF_RISING_IDS = new Set(
  sourcesJson.records
    .filter((rec) =>
      (rec.topping ?? []).some((line) => SELF_RISING_RE.test(line.verbatim ?? '')))
    .map((rec) => rec.id),
);

const csv = parseCsv(readFileSync(new URL('../data/sources.csv', import.meta.url), 'utf8'));
const families = Object.values(FAMILIES);

const anchors = [];
const skipped = [];

for (const r of csv) {
  if (r.excluded === 'true' || r.excluded === '1') {
    skipped.push({ id: r.id, why: r.exclusionReason || 'excluded in the corpus' });
    continue;
  }

  const basis = num(r.basisG);
  const correction = CORRECTIONS[r.id];
  const ing = {
    oats: num(r.oatFractionPct) ?? 0,
    butter: correction?.fatPct ?? num(r.fatPct),
    sugar: correction?.sugarPct ?? num(r.sugarPct),
    buttermilk: correction?.liquidPct ?? num(r.liquidPct) ?? 0,
    egg: basis && num(r.eggG) ? (num(r.eggG) / basis) * 100 : 0,
    bakingPowder: num(r.bakingPowderPct) ?? 0,
    bakingSoda: num(r.bakingSodaPct) ?? 0,
  };
  if (SELF_RISING_IDS.has(r.id) && ing.bakingPowder === 0) ing.bakingPowder = SELF_RISING.bakingPowder;

  // A recipe with no fat or no sugar figure cannot be placed; the two fields
  // carry most of the discrimination between these dishes.
  if (ing.butter == null || ing.sugar == null) {
    skipped.push({ id: r.id, why: 'no usable fat or sugar figure' });
    continue;
  }

  const fits = families
    .map((f) => ({ family: f.key, ...projectOntoFamily(ing, f) }))
    .sort((a, b) => a.residual - b.residual);
  const best = fits[0];

  anchors.push({
    id: r.id,
    source: r.source,
    title: r.title,
    url: r.url || null,
    corpus: r.corpus,
    tier: r.tier,
    rating: num(r.ratingStars),
    ratingCount: num(r.ratingCount),
    family: best.family,
    coords: Object.fromEntries(
      Object.entries(best.coords).map(([k, v]) => [k, Number(v.toFixed(4))]),
    ),
    residual: Number(best.residual.toFixed(3)),
    worst: { field: best.worst.field, delta: Number(best.worst.delta.toFixed(3)), direction: best.worst.direction },
    plottable: best.plottable,
    onPlane: best.onPlane,
    // Kept so a recipe filed under one heading but fitting the other family is
    // visible rather than quietly reassigned.
    alternateFamily: fits[1]
      ? { family: fits[1].family, residual: Number(fits[1].residual.toFixed(3)) }
      : null,
    corrected: correction ? correction.why : null,
  });
}

anchors.sort((a, b) => a.residual - b.residual);

const out = {
  _readme:
    'Surveyed recipes projected onto the two triangles. Generated by scripts/build-anchors.mjs — do not edit by hand. '
    + 'RESIDUAL is the distance from the triangle plane in units of "fraction of the range the triangle spans on each fitted field"; '
    + 'a large residual means the plotted position is a shadow, not a location.',
  generatedFrom: 'data/sources.csv',
  maxPlottableResidual: MAX_PLOTTABLE_RESIDUAL,
  maxPlottableField: MAX_PLOTTABLE_FIELD,
  goodResidual: GOOD_RESIDUAL,
  anchors,
  skipped,
};

writeFileSync(new URL('../data/anchors.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

// --- report ------------------------------------------------------------------
const byFamily = (k) => anchors.filter((a) => a.family === k && a.plottable);
console.log(`${anchors.length} placed, ${skipped.length} skipped`);
console.log(`self-rising flour unpacked for ${SELF_RISING_IDS.size} records\n`);

for (const f of families) {
  const list = byFamily(f.key);
  const onPlane = list.filter((a) => a.onPlane).length;
  console.log(`${f.label.toUpperCase()} — ${list.length} plottable, ${onPlane} comfortably on-plane`);
  const rated = list.filter((a) => a.rating != null && a.rating >= 4.5)
    .sort((a, b) => b.rating - a.rating).slice(0, 5);
  for (const a of rated) {
    const c = f.keys.map((k) => `${Math.round((a.coords[k] ?? 0) * 100)}`).join('/');
    console.log(`   ${a.rating}★  ${c.padEnd(12)} res ${a.residual.toFixed(2)}  ${a.source} — ${a.title.slice(0, 40)}`);
  }
  console.log();
}

const off = anchors.filter((a) => !a.plottable);
console.log(`OFF-PLANE (not drawn): ${off.length}`);
for (const a of off) {
  console.log(
    `   rms ${a.residual.toFixed(2)}  ${a.worst.field} sits ${a.worst.delta.toFixed(2)} ${a.worst.direction} the triangle`
    + `  [${a.corpus}] ${a.source} — ${a.title.slice(0, 38)}`,
  );
}

const crossed = anchors.filter((a) => a.plottable && a.corpus.startsWith('cobbler') && a.family === 'poured');
if (crossed.length) {
  console.log(`\nFiled as a cobbler, fits the POURED family (${crossed.length}):`);
  for (const a of crossed) console.log(`   ${a.id} — res ${a.residual.toFixed(2)}`);
}

if (VERBOSE) {
  console.log('\nSKIPPED:');
  for (const s of skipped) console.log(`   ${s.id}: ${s.why}`);
}
