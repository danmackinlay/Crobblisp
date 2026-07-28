#!/usr/bin/env node
/**
 * Regenerate data/sources.csv from data/sources.json.
 *
 * The JSON holds verbatim ingredient lines; every figure in the CSV is derived
 * from them here. Nothing in the CSV is hand-entered, so a disputed number can
 * always be traced back to the line and the conversion factor that produced it —
 * which is precisely what the original hand-normalised survey could not do.
 *
 *   node scripts/build-dataset.mjs           write CSV + print summary
 *   node scripts/build-dataset.mjs --trace ID  show every conversion for one record
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractAll, summarise } from '../src/data/extract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { records } = JSON.parse(readFileSync(join(root, 'data/sources.json'), 'utf8'));
const rows = extractAll(records);

const traceId = process.argv.includes('--trace')
  ? process.argv[process.argv.indexOf('--trace') + 1]
  : null;

if (traceId) {
  const row = rows.find((r) => r.id === traceId);
  if (!row) {
    console.error(`No record with id "${traceId}". Available:\n  ${rows.map((r) => r.id).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`\n${row.source} — ${row.title}\n${row.url}\n`);
  console.log('line'.padEnd(58), 'role'.padEnd(13), 'grams'.padStart(8), '  factor  from');
  console.log('-'.repeat(110));
  for (const t of row._trace) {
    const g = t.grams == null ? '—' : t.grams.toFixed(1);
    const delta = t.conventionDelta != null ? ` (${t.conventionDelta > 0 ? '+' : ''}${t.conventionDelta}% vs default)` : '';
    console.log(
      String(t.verbatim ?? '').slice(0, 56).padEnd(58),
      String(t.role).padEnd(13),
      g.padStart(8),
      ' ',
      String(t.factor ?? '—').padEnd(7),
      (t.factorFrom ?? '—') + delta,
    );
    for (const n of t.notes ?? []) console.log(' '.repeat(60), '⚠', n);
  }
  console.log('-'.repeat(110));
  console.log(`basis (flour+oats) ${row.basisG} g → fat ${row.fatPct} · sugar ${row.sugarPct} · liquid ${row.liquidPct} · salt ${row.saltPct} per 100`);
  if (row.inferredFields) console.log(`\nINFERRED: ${row.inferredFields}`);
  if (row.excluded) console.log(`\nEXCLUDED: ${row.exclusionReason}`);
  process.exit(0);
}

// --- CSV -------------------------------------------------------------------

const COLUMNS = [
  'id', 'corpus', 'source', 'title', 'url', 'tier', 'retrieval',
  'ratingStars', 'ratingCount',
  'flourG', 'oatsG', 'fatG', 'sugarG', 'saltG', 'liquidG',
  'bakingPowderG', 'bakingSodaG', 'nutsG', 'eggG', 'toppingG', 'fruitG', 'basisG',
  'oatFractionPct', 'fatPct', 'sugarPct', 'sugarBrownPct', 'saltPct',
  'liquidPct', 'bakingPowderPct', 'bakingSodaPct', 'nutsPct',
  'dish', 'areaCm2', 'loadGPerCm2', 'fruitToToppingRatio',
  'ovenC', 'bakeMinutes', 'restMinutes', 'prebakeFruit', 'butterState',
  'sodaToAcidLiquid', 'acidLiquidG',
  'inferredFields', 'excluded', 'exclusionReason', 'flags', 'notes',
];

const esc = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = [
  COLUMNS.join(','),
  ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(',')),
].join('\n');

writeFileSync(join(root, 'data/sources.csv'), csv + '\n');
console.log(`Wrote data/sources.csv — ${rows.length} records, ${COLUMNS.length} columns`);

// --- Summary ---------------------------------------------------------------

const included = rows.filter((r) => !r.excluded);
console.log(`\n${included.length} included, ${rows.length - included.length} excluded\n`);

const HAND = {
  crumble: { fatPct: 66.7, sugarPct: 57 },
  crisp: { oatFractionPct: 41, fatPct: 70, sugarPct: 75 },
  'cobbler-a': { fatPct: 45, sugarPct: 30, liquidPct: 80 },
};

for (const corpus of ['crumble', 'crisp', 'cobbler-a']) {
  const sub = included.filter((r) => r.corpus === corpus);
  if (!sub.length) continue;
  console.log(`${corpus}  (n=${sub.length})`);
  for (const field of ['oatFractionPct', 'fatPct', 'sugarPct', 'liquidPct', 'saltPct', 'loadGPerCm2']) {
    const s = summarise(sub, field);
    if (!s.n) continue;
    const vertex = HAND[corpus]?.[field];
    const flag = vertex != null
      ? `   vertex ${vertex}${Math.abs(s.median - vertex) / (vertex || 1) > 0.15 ? '  ← DIVERGES' : ''}`
      : '';
    console.log(
      `  ${field.padEnd(17)} n=${String(s.n).padStart(2)}  median=${String(s.median).padStart(7)}` +
      `  range ${s.min}–${s.max}${flag}`,
    );
  }
  console.log();
}

const noRating = included.filter((r) => r.ratingCount == null).length;
const inferred = included.filter((r) => r.inferredFields).length;
console.log(`Provenance: ${noRating}/${included.length} have no rating data; ${inferred} carry at least one inferred conversion.`);
