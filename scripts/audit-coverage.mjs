#!/usr/bin/env node
/**
 * What does the model discard to make a recipe fit?
 *
 * Every ingredient line in the corpus is classified against what the model can
 * actually represent. Three outcomes:
 *
 *   REPRESENTED — the model has a field for it.
 *   COLLAPSED   — kept, but flattened onto a field that means something else.
 *                 Cream becoming "buttermilk" keeps the volume and loses 35% fat
 *                 and all the acid.
 *   DROPPED     — no field at all. The mass is simply gone.
 *
 * And then the category the corpus cannot report on itself: ingredients that were
 * never captured. Those are the dangerous ones, because nothing downstream can
 * see that they are missing.
 *
 *   node scripts/audit-coverage.mjs [--lines]
 */
import { readFileSync } from 'node:fs';

const SHOW_LINES = process.argv.includes('--lines');
const db = JSON.parse(readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8'));

const REPRESENTED = new Set([
  'flour', 'oats', 'quick oats', 'butter', 'sugar', 'salt', 'kosher salt',
  'buttermilk', 'baking powder', 'baking soda', 'egg',
]);

/** Kept, but flattened. The note says what the flattening costs. */
const COLLAPSED = {
  'brown sugar': 'sugar type fixed at a 60/40 light-brown/white blend',
  demerara: 'sugar type fixed; demerara is coarser and browns differently',
  milk: 'becomes "buttermilk" — no acid; see the acid-budget check below',
  cream: 'becomes "buttermilk" — carries ~35% more fat, and no acid',
  yogurt: 'becomes "buttermilk" — thicker, and the acid load differs',
  'creme fraiche': 'becomes "buttermilk" — much fatter, and thicker',
  'half-and-half': 'becomes "buttermilk" — fatter, and no acid',
  'self-raising flour': 'leavener hidden inside the flour, unpacked only in the anchors',
  shortening: 'becomes "butter" — no water and no milk solids, so it cannot brown',
};

/** No field exists. The mass is discarded. */
const DROPPED = {
  nuts: 'no field; can run to 63% of flour weight',
  'sliced almonds': 'no field',
  'ground almonds': 'no field; behaves as a fat-rich flour',
  'almond flour': 'no field; behaves as a fat-rich flour',
  cornmeal: 'no field; a second dry structure former',
};

const rows = [];
for (const rec of db.records) {
  const seen = { represented: [], collapsed: [], dropped: [], unknown: [] };
  for (const line of rec.topping ?? []) {
    const k = (line.ingredient ?? '').toLowerCase();
    if (REPRESENTED.has(k)) seen.represented.push(line);
    else if (COLLAPSED[k]) seen.collapsed.push(line);
    else if (DROPPED[k]) seen.dropped.push(line);
    else seen.unknown.push(line);
  }
  rows.push({ rec, ...seen });
}

const n = rows.length;
const pct = (c) => `${((c / n) * 100).toFixed(0)}%`;
const count = (f) => rows.filter(f).length;

console.log(`${n} records, ${rows.reduce((s, r) => s + r.represented.length + r.collapsed.length + r.dropped.length + r.unknown.length, 0)} topping lines\n`);

console.log('MODIFIED TO FIT');
const anyCollapsed = count((r) => r.collapsed.length);
const anyDropped = count((r) => r.dropped.length);
const clean = count((r) => !r.collapsed.length && !r.dropped.length && !r.unknown.length);
console.log(`  ${clean} of ${n} (${pct(clean)}) pass through with nothing collapsed or dropped`);
console.log(`  ${anyCollapsed} (${pct(anyCollapsed)}) have at least one ingredient FLATTENED onto a field that means something else`);
console.log(`  ${anyDropped} (${pct(anyDropped)}) have at least one ingredient DROPPED entirely\n`);

const tally = (map, pick) => {
  const c = {};
  for (const r of rows) for (const l of pick(r)) c[l.ingredient] = (c[l.ingredient] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${String(v).padStart(3)}x ${k.padEnd(20)} ${map[k]}`).join('\n');
};

console.log('COLLAPSED');
console.log(tally(COLLAPSED, (r) => r.collapsed));
console.log('\nDROPPED');
console.log(tally(DROPPED, (r) => r.dropped));

const unknown = {};
for (const r of rows) for (const l of r.unknown) unknown[l.ingredient] = (unknown[l.ingredient] ?? 0) + 1;
if (Object.keys(unknown).length) {
  console.log('\nUNCLASSIFIED (this script needs updating)');
  for (const [k, v] of Object.entries(unknown)) console.log(`  ${v}x ${k}`);
}

// --- the acid budget, where the collapse becomes a real modelling error ------
//
// The first version of this check just asked "soda plus a non-acid liquid?" and
// called both hits errors. Reading the two records showed it was wrong in an
// interesting way: neither is acid-free. Dorie's carries buttermilk ALONGSIDE
// the cream, and King Arthur's uses Bakewell Cream, a dry leavening acid. So the
// error is not missing acid — it is that the model's accounting is wrong in BOTH
// DIRECTIONS, and the direction depends on where the acid actually lives.
const ACID_LIQUIDS = new Set(['buttermilk', 'yogurt', 'creme fraiche']);
const NEUTRAL_LIQUIDS = new Set(['milk', 'cream', 'half-and-half']);
const DRY_ACID = /bakewell cream|cream of tartar|tartaric/i;

const acidIssues = [];
for (const r of rows) {
  const lines = r.rec.topping ?? [];
  if (!lines.some((l) => l.ingredient === 'baking soda')) continue;
  const neutral = lines.filter((l) => NEUTRAL_LIQUIDS.has(l.ingredient));
  const acid = lines.filter((l) => ACID_LIQUIDS.has(l.ingredient));
  const dryAcid = lines.some((l) => DRY_ACID.test(l.verbatim ?? ''));
  if (dryAcid) {
    acidIssues.push([r.rec, 'UNDER-credits', 'the acid is a DRY leavening acid the model has no field for, so it would cut soda that is correctly dosed']);
  } else if (neutral.length && acid.length) {
    acidIssues.push([r.rec, 'OVER-credits', `${neutral.length} neutral liquid line(s) are counted as buttermilk, inflating the acid ceiling`]);
  } else if (neutral.length && !acid.length) {
    acidIssues.push([r.rec, 'OVER-credits', 'the only liquid is neutral, but the model treats it as acidic']);
  }
}
console.log(`\nACID BUDGET: ${acidIssues.length} record(s) where the liquid collapse corrupts the soda constraint.`);
for (const [rec, dir, why] of acidIssues) console.log(`  ${dir}  ${rec.id} — ${why}`);

// --- what was never captured at all ------------------------------------------
const SPICE = /cinnamon|nutmeg|ginger|allspice|clove|cardamom|vanilla|zest|mace|mixed spice/i;
let spiced = 0;
for (const rec of db.records) {
  const all = [...(rec.topping ?? []), ...(rec.fruit ?? [])];
  if (all.some((l) => SPICE.test(l.verbatim ?? ''))) spiced++;
}
console.log(`\nNEVER CAPTURED`);
console.log(`  Records containing ANY spice, vanilla or zest line: ${spiced} of ${n}.`);
console.log('  Zero is not a fact about these recipes — 18 of them are apple crisps, and');
console.log('  cinnamon-free apple crisp is close to nonexistent in American recipe writing.');
console.log('  It is a capture failure in the survey, and the more serious kind: a dropped');
console.log('  ingredient at least leaves a visible gap, whereas an uncaptured one leaves');
console.log('  nothing downstream able to notice it is missing.');

const noFruit = db.records.filter((r) => !(r.fruit ?? []).length).length;
console.log(`  Records with NO fruit line captured at all: ${noFruit} of ${n}.`);

if (SHOW_LINES) {
  console.log('\n--- per record ---');
  for (const r of rows) {
    if (!r.collapsed.length && !r.dropped.length) continue;
    console.log(`\n${r.rec.id}`);
    for (const l of r.dropped) console.log(`   DROPPED   ${l.verbatim}`);
    for (const l of r.collapsed) console.log(`   COLLAPSED ${l.verbatim}`);
  }
}
