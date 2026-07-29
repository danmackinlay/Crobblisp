#!/usr/bin/env node
/**
 * Read the contributed bake records back and check the model against them.
 *
 * This is the other half of the loop the rating form opens. A record pairs a
 * prediction with an outcome, so with enough of them the questions the corpus
 * cannot answer become answerable:
 *
 *   - does a high predicted score actually correspond to a well-rated bake?
 *   - do the individual COMPONENTS earn their weight, or is one of them noise?
 *   - is the poured family's uncalibrated surface anywhere near right?
 *
 * It deliberately reports how little it knows. With a handful of records the
 * honest output is "not enough data", and saying so is the whole point — this
 * project has twice had to retract a conclusion drawn from too little.
 *
 *   node scripts/bakes-report.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateBakeRecord, observationsFor } from '../src/model/bake-record.js';

const dir = fileURLToPath(new URL('../data/bakes/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

const records = [];
const bad = [];
for (const f of files) {
  let rec;
  try {
    rec = JSON.parse(readFileSync(dir + f, 'utf8'));
  } catch (e) {
    bad.push([f, `unparseable: ${e.message}`]);
    continue;
  }
  const { ok, errors } = validateBakeRecord(rec);
  if (ok) records.push(rec); else bad.push([f, errors.join('; ')]);
}

console.log(`${records.length} valid record(s), ${bad.length} rejected\n`);
for (const [f, why] of bad) console.log(`  REJECTED ${f}: ${why}`);

if (!records.length) {
  console.log('Nothing to report yet. Contribute one from the "Made it?" panel in the app.');
  process.exit(0);
}

/** Pearson r. Returned with n so a correlation from four points is not quoted alone. */
function correlation(pairs) {
  const n = pairs.length;
  if (n < 2) return { r: null, n };
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n };
}

const byFamily = {};
for (const r of records) (byFamily[r.point.family] ??= []).push(r);

for (const [fam, list] of Object.entries(byFamily)) {
  console.log(`\n${fam.toUpperCase()} — ${list.length} record(s)`);
  const clean = list.filter((r) => r.outcome.followedRecipe !== false);
  if (clean.length < list.length) {
    console.log(`  (${list.length - clean.length} excluded from the fit: recipe was changed)`);
  }

  const { r, n } = correlation(clean.map((x) => [x.predicted.overall, x.outcome.rating]));
  if (r == null || n < 5) {
    console.log(`  predicted vs actual: n=${n} — NOT ENOUGH DATA to say anything.`);
  } else {
    console.log(`  predicted vs actual: r=${r.toFixed(2)} over n=${n}`
      + (n < 15 ? '  (still thin — treat as a hint, not a finding)' : ''));
  }

  for (const x of clean.sort((a, b) => a.outcome.rating - b.outcome.rating)) {
    const gap = x.outcome.rating / 5 - x.predicted.overall;
    const flag = Math.abs(gap) > 0.25 ? '  <-- MODEL DISAGREES' : '';
    console.log(`    ${x.outcome.rating}/5  predicted ${x.predicted.overall.toFixed(2)}`
      + `  ${Object.entries(x.point.coords).map(([k, v]) => `${k[0]}${Math.round(v * 100)}`).join(' ')}`
      + `  ${x.id}${flag}`);
  }

  // Per-component: when somebody reports a defect, what did the term that is
  // supposed to predict it actually say?
  const catalogue = observationsFor(fam);
  const perComponent = {};
  for (const x of clean) {
    for (const key of x.outcome.observations) {
      const o = catalogue.find((c) => c.key === key);
      if (!o?.component) continue;
      const predicted = x.predicted.components[o.component];
      if (predicted == null) continue;
      (perComponent[o.component] ??= { good: [], bad: [] })[o.polarity === 'good' ? 'good' : 'bad']
        .push(predicted);
    }
  }
  const rows = Object.entries(perComponent);
  if (rows.length) {
    console.log('\n  component        when reported GOOD   when reported BAD');
    for (const [comp, { good, bad: b }] of rows) {
      const mean = (a) => (a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : '  -');
      const warn = good.length && b.length && Number(mean(b)) >= Number(mean(good))
        ? '   <-- scored the failures HIGHER than the successes' : '';
      console.log(`  ${comp.padEnd(16)} ${mean(good)} (n=${good.length})`.padEnd(42)
        + `${mean(b)} (n=${b.length})${warn}`);
    }
    console.log('\n  A component whose "bad" mean is not clearly below its "good" mean is not');
    console.log('  measuring what it claims to. That is the check this file exists for.');
  }
}
