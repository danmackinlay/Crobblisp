import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseQuantity, toGrams, conventionDelta, DEFAULT_FACTORS } from '../src/data/units.js';
import { extract, extractAll, median, summarise } from '../src/data/extract.js';
import { glassTransitionC, brittleness, BROWNING_THRESHOLD } from '../src/model/glass.js';
import { GRAMS_PER_TSP } from '../src/model/vertices.js';

const records = JSON.parse(readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8')).records;

// --- Quantity parsing --------------------------------------------------------

test('parses whole numbers, fractions and mixed numbers', () => {
  const cases = [
    ['1', 1], ['3/4', 0.75], ['1 1/2', 1.5], ['2 1/4', 2.25],
    ['¾', 0.75], ['½', 0.5], ['2½', 2.5], ['1⅓', 1 + 1 / 3],
  ];
  for (const [input, expected] of cases) {
    assert.ok(Math.abs(parseQuantity(input).value - expected) < 1e-9, `${input} → ${expected}`);
  }
});

test('REGRESSION: bare decimals are not parsed as zero', () => {
  // "0.5" matched the leading-whole-number branch as "0" — the digit is followed
  // by ".", which is neither a digit nor a slash — set matched, and returned 0.
  // Silent, plausible, and wrong by a factor of infinity. Found by testing the
  // parser directly rather than by reading it.
  for (const [input, expected] of [['0.5', 0.5], ['0.25', 0.25], ['1.5', 1.5], ['.75', 0.75]]) {
    assert.equal(parseQuantity(input).value, expected, `${input} must not collapse to 0`);
  }
});

test('ranges become their midpoint, and are flagged as inferred', () => {
  const r = parseQuantity('2 to 3');
  assert.equal(r.value, 2.5);
  assert.ok(r.inferred, 'a midpoint is not a stated quantity');
  assert.match(r.note, /midpoint/);
});

test('unparseable quantities return null rather than guessing', () => {
  for (const junk of ['a pinch', 'to taste', 'some', '']) {
    assert.equal(parseQuantity(junk).value, null, `${junk} must not become a number`);
  }
});

// --- Conversion and its provenance -------------------------------------------

test('mass units need no factor and are never inferred', () => {
  const g = toGrams({ quantity: '175', unit: 'g', ingredient: 'flour' });
  assert.equal(g.grams, 175);
  assert.equal(g.factorFrom, 'stated');
  assert.equal(g.inferred, false);
});

test("a source's own gram convention overrides the project default", () => {
  const generic = toGrams({ quantity: '1', unit: 'cup', ingredient: 'flour' });
  const atk = toGrams({ quantity: '1', unit: 'cup', ingredient: 'flour', sourceId: 'atk' });
  const ka = toGrams({ quantity: '1', unit: 'cup', ingredient: 'flour', sourceId: 'kingarthur' });

  assert.equal(generic.grams, 125);
  assert.equal(generic.factorFrom, 'default');
  assert.equal(atk.grams, 142);
  assert.equal(atk.factorFrom, 'source:atk');
  assert.equal(ka.grams, 120);

  // The gap that silently manufactured a fake pattern in the hand survey.
  assert.ok(atk.grams / ka.grams > 1.17, 'ATK vs King Arthur is an ~18% spread');
});

test('convention deltas are reported so the discrepancy is visible', () => {
  const d = conventionDelta('atk', 'flour', 'cup');
  assert.ok(d.pctDelta > 13 && d.pctDelta < 14, `ATK flour is +13.6% vs default, got ${d.pctDelta}`);
  assert.equal(conventionDelta('kingarthur', 'oats', 'cup').pctDelta, 0, 'KA oats match the default exactly');
  assert.equal(conventionDelta('nobody', 'flour', 'cup'), null);
});

test('irreducibly ambiguous ingredients are always flagged', () => {
  const k = toGrams({ quantity: '1', unit: 'tsp', ingredient: 'kosher salt' });
  assert.ok(k.inferred, 'kosher salt spans a 1.7x brand range and can never be exact');
  assert.ok(k.notes.some((n) => /Diamond|Morton/.test(n)));
});

test('a missing factor returns null rather than a silent zero', () => {
  const r = toGrams({ quantity: '1', unit: 'furlong', ingredient: 'flour' });
  assert.equal(r.grams, null);
  assert.ok(r.notes.some((n) => /no factor/.test(n)));
});

// --- Extraction --------------------------------------------------------------

test('normalises to flour + oats = 100', () => {
  const r = extract(records.find((x) => x.id === 'crisp-sallys'));
  assert.equal(r.basisG, 179); // 94 flour + 85 oats
  assert.ok(Math.abs(r.oatFractionPct - 47.5) < 0.1);
  assert.ok(Math.abs(r.fatPct - 63.1) < 0.5, `fat ${r.fatPct}`);
});

test('lines marked exclude are held out of the totals but kept in the trace', () => {
  const r = extract(records.find((x) => x.id === 'crisp-king-arthur'));
  assert.equal(r.nutsG, 0, 'optional nuts must not enter the totals');
  assert.ok(r._trace.some((t) => t.excluded), 'but the line is still recorded');
});

test('soda ratio is computed against ACIDIC liquid only', () => {
  // Dorie's dough holds 238 g of heavy cream, which is essentially non-acidic and
  // does not neutralise bicarbonate. Counting it would understate her alkalinity
  // by a factor of three. The corpus contains exactly this trap.
  const r = extract(records.find((x) => x.id === 'cobbler-dorie'));
  assert.equal(r.acidLiquidG, 120, 'only the buttermilk counts');
  assert.ok(Math.abs(r.sodaToAcidLiquid - 0.01) < 0.0005, `got ${r.sodaToAcidLiquid}`);
  assert.ok(r.liquidG > 350, 'while total liquid includes the cream');
});

test('load per unit area is computed where a dish area exists', () => {
  const r = extract(records.find((x) => x.id === 'crisp-sallys'));
  assert.ok(r.loadGPerCm2 > 0.5 && r.loadGPerCm2 < 0.7, `got ${r.loadGPerCm2}`);
  const noDish = extract(records.find((x) => x.id === 'crumble-delia-643'));
  assert.equal(noDish.loadGPerCm2, null, 'no area means no load, not a zero');
});

test('every record carries a tier and a retrieval route', () => {
  for (const r of extractAll(records)) {
    assert.ok(['T1', 'T2', 'T3', 'T4'].includes(r.tier), `${r.id} has tier ${r.tier}`);
    assert.ok(r.retrieval, `${r.id} has no retrieval route`);
  }
});

test('excluded records state a reason', () => {
  for (const r of extractAll(records).filter((x) => x.excluded)) {
    assert.ok(r.exclusionReason && r.exclusionReason.length > 20, `${r.id} needs a real reason`);
  }
});

test('summaries skip nulls rather than treating them as zero', () => {
  assert.equal(median([1, null, 3]), 2);
  assert.equal(median([]), null);
  const rows = extractAll(records);
  const s = summarise(rows, 'loadGPerCm2');
  assert.ok(s.n < rows.length, 'records without a dish are dropped, not zeroed');
  assert.ok(s.median > 0.5 && s.median < 1.3);
});

test('excluded records are held out of summaries by default', () => {
  const rows = extractAll(records);
  const withOut = summarise(rows, 'fatPct');
  const withIn = summarise(rows, 'fatPct', { includeExcluded: true });
  assert.ok(withIn.n > withOut.n, 'the excluded rows exist but do not count');
});

// --- Independent confirmation of the model's calibration ---------------------

test('the corpus reproduces the topping loads the model was calibrated to', () => {
  // These were derived by a separate route — the model's physical constants were
  // fitted to published medians, while these come from summing verbatim
  // ingredient lines. Agreement is a real cross-check, not a tautology.
  const rows = extractAll(records).filter((r) => !r.excluded);
  const loadFor = (corpus) => summarise(rows.filter((r) => r.corpus === corpus), 'loadGPerCm2').median;

  assert.ok(Math.abs(loadFor('crisp') - 0.83) < 0.06, `crisp load ${loadFor('crisp')} vs calibrated 0.830`);
  assert.ok(Math.abs(loadFor('cobbler-a') - 0.846) < 0.08, `cobbler load ${loadFor('cobbler-a')} vs 0.846`);
  assert.ok(Math.abs(loadFor('crumble') - 1.008) < 0.12, `crumble load ${loadFor('crumble')} vs 1.008`);
});

test('King Arthur cherry cobbler matches its own published dough weight', () => {
  // The single strongest cross-check available: KA states 9 mounds x 50 g = 450 g.
  // Summing their ingredient list independently should land on the same figure.
  const r = extract(records.find((x) => x.id === 'cobbler-king-arthur-cherry'));
  const stated = 450;
  const error = Math.abs(r.toppingG - stated) / stated;
  assert.ok(error < 0.025, `summed ${r.toppingG} g against a stated ${stated} g — ${(error * 100).toFixed(1)}% off`);
});

// --- Glass transition --------------------------------------------------------

test('Gordon-Taylor reproduces the confirmed sucrose anchors', () => {
  assert.equal(Math.round(glassTransitionC(0)), 62, 'anhydrous sucrose, confirmed');
  assert.ok(Math.abs(glassTransitionC(0.047) - 25) < 0.5, 'Tg crosses room temp at 4.7% water');
  assert.ok(Math.abs(glassTransitionC(0.089) - 0) < 0.5, 'and freezing at 8.9%');
});

test('REGRESSION: the linear "10 degrees per 1% water" rule is wrong', () => {
  // It is the tangent at bone-dry, and even there it is 8.9. Averaged over the
  // realistic 0-5% band it is 7.8, so the linear rule overstates the depression
  // by roughly 40%. Carried a long time from an untraced secondary source.
  const first = glassTransitionC(0) - glassTransitionC(0.01);
  assert.ok(first < 9.5, `first 1% drops ${first.toFixed(1)}, not 10`);
  const avg = (glassTransitionC(0) - glassTransitionC(0.05)) / 5;
  assert.ok(avg < 8 && avg > 7.5, `average over 0-5% is ${avg.toFixed(1)}`);
});

test('the equation is unit-invariant between C and K', () => {
  // It is a weighted average, so both bases agree. Asserted so nobody "fixes"
  // it into a Kelvin conversion later.
  const inC = glassTransitionC(0.03);
  const inK = glassTransitionC(0.03, { tgAnhydrousC: 335.15, tgWaterC: 138.15, k: 4.7 }) - 273.15;
  assert.ok(Math.abs(inC - inK) < 1e-9, `${inC} vs ${inK}`);
});

test('brittleness collapses over a narrow moisture band', () => {
  // The physically interesting result: 2.5 points of moisture separate a crisp
  // topping from a limp one. That is why crispness is fragile, and why anything
  // touching wet fruit is lost regardless of oven temperature.
  assert.ok(brittleness(0.02) > 0.95, 'a dry topping is fully glassy');
  assert.equal(brittleness(0.05), 0, 'past 5% it is rubbery, not merely less crisp');
  assert.equal(brittleness(0.1), 0, 'and stays there');
});

test('the browning threshold is dual, and a wet interface fails both halves', () => {
  assert.equal(BROWNING_THRESHOLD.minSurfaceC, 120);
  assert.equal(BROWNING_THRESHOLD.maxWaterActivity, 0.6);
  assert.ok(100 < BROWNING_THRESHOLD.minSurfaceC, 'pinned at 100 C: too cool');
  assert.ok(1.0 > BROWNING_THRESHOLD.maxWaterActivity, 'and saturated: too wet');
});

// --- Cross-layer constants ---------------------------------------------------

test('the extraction layer and the model agree on teaspoon weights', () => {
  // These constants live in two modules by design — units.js is the data layer,
  // vertices.js is the model layer, and the data layer must not depend on the
  // model. But this project has already been bitten by exactly this: a
  // researcher used 12.5 g/tbsp for demerara in one pass and 15 in another and
  // never reconciled them. Duplication is tolerable; silent divergence is not.
  assert.equal(DEFAULT_FACTORS.salt.tsp, GRAMS_PER_TSP.salt);
  assert.equal(DEFAULT_FACTORS['baking powder'].tsp, GRAMS_PER_TSP.bakingPowder);
  assert.equal(DEFAULT_FACTORS['baking soda'].tsp, GRAMS_PER_TSP.bakingSoda);
});

test('every structural ingredient can be converted from volume', () => {
  // The bug this guards: flour had a cup factor and no tbsp, so "1/4 cup plus 2
  // tablespoons flour" silently collapsed the basis to oats alone and inflated
  // every ratio threefold.
  for (const key of ['flour', 'oats', 'cornmeal', 'self-raising flour']) {
    for (const unit of ['cup', 'tbsp']) {
      const g = toGrams({ quantity: '1', unit, ingredient: key });
      assert.ok(g.grams > 0, `${key} has no ${unit} factor`);
    }
  }
});

test('a broken basis nulls the ratios instead of computing them', () => {
  const broken = extract({
    id: 'synthetic', corpus: 'crisp', source: 'x', title: 'x', tier: 'T1', retrieval: 'direct',
    topping: [
      { qty: '1', unit: 'furlong', ingredient: 'flour', verbatim: '1 furlong flour' },
      { qty: '90', unit: 'g', ingredient: 'oats', verbatim: '90 g oats' },
      { qty: '100', unit: 'g', ingredient: 'butter', verbatim: '100 g butter' },
    ],
    fruit: [],
  });
  assert.equal(broken.basisBroken, true);
  assert.equal(broken.fatPct, null, 'must not report fat against a partial basis');
  assert.equal(broken.basisG, null);
  assert.equal(broken.fatG, 100, 'absolute grams are still reported — only ratios are void');
});
