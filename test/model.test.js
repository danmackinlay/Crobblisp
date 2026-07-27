import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VERTICES, VERTEX_KEYS } from '../src/model/vertices.js';
import { BERRIES, DISHES } from '../src/model/fruit.js';
import { blend } from '../src/model/blend.js';
import { morphology } from '../src/model/morphology.js';
import { weightedGeometricMean, SCORE_DOMAIN } from '../src/model/score.js';
import { buildRecipe, scoreAt } from '../src/model/recipe.js';

const at = (crumble, crisp, cobbler) => ({ crumble, crisp, cobbler });
const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ~${b}, got ${a}`);

const DAIRY = { vegan: false, glutenFree: false };
const VEGAN = { vegan: true, glutenFree: false };
const GF = { vegan: false, glutenFree: true };
const BOTH = { vegan: true, glutenFree: true };

// --- Basis and interpolation -------------------------------------------------

test('vertices round-trip through the blend unchanged', () => {
  for (const key of VERTEX_KEYS) {
    const b = blend(at(key === 'crumble' ? 1 : 0, key === 'crisp' ? 1 : 0, key === 'cobbler' ? 1 : 0));
    for (const [field, expected] of Object.entries(VERTICES[key].ingredients)) {
      close(b.ingredients[field], expected, 1e-9, `${key}.${field}`);
    }
  }
});

test('flour + oats = 100 everywhere on the triangle', () => {
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; i + j <= 10; j++) {
      const b = blend(at(i / 10, j / 10, (10 - i - j) / 10));
      close(b.ingredients.flour + b.ingredients.oats, 100, 1e-9, 'dry structure basis');
    }
  }
});

test('no ingredient peaks in the interior — affine over a simplex', () => {
  const fields = Object.keys(VERTICES.crumble.ingredients);
  const maxAtVertex = {};
  const minAtVertex = {};
  for (const f of fields) {
    maxAtVertex[f] = Math.max(...VERTEX_KEYS.map((k) => VERTICES[k].ingredients[f]));
    minAtVertex[f] = Math.min(...VERTEX_KEYS.map((k) => VERTICES[k].ingredients[f]));
  }
  for (let i = 0; i <= 20; i++) {
    for (let j = 0; i + j <= 20; j++) {
      const b = blend(at(i / 20, j / 20, (20 - i - j) / 20));
      for (const f of fields) {
        assert.ok(
          b.ingredients[f] <= maxAtVertex[f] + 1e-9 && b.ingredients[f] >= minAtVertex[f] - 1e-9,
          `${f} escaped its vertex range in the interior`,
        );
      }
    }
  }
});

test('every ingredient is monotone along every edge', () => {
  const edges = [
    ['crumble', 'crisp'],
    ['crisp', 'cobbler'],
    ['crumble', 'cobbler'],
  ];
  const fields = Object.keys(VERTICES.crumble.ingredients);
  for (const [from, to] of edges) {
    for (const f of fields) {
      let prev = null;
      let dir = 0;
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        const coords = { crumble: 0, crisp: 0, cobbler: 0 };
        coords[from] = 1 - t;
        coords[to] = t;
        const v = blend(coords).ingredients[f];
        if (prev !== null) {
          const d = Math.sign(Math.round((v - prev) * 1e6));
          if (d !== 0) {
            if (dir === 0) dir = d;
            else assert.equal(d, dir, `${f} is not monotone on ${from}->${to}`);
          }
        }
        prev = v;
      }
    }
  }
});

// --- Chemistry constraints ---------------------------------------------------

test('soda never exceeds the acid budget plus its browning allowance', () => {
  // The old version of this test used 2.8 g soda per 240 g buttermilk, which is
  // the folk "half a teaspoon per cup" rule rather than a chemical ceiling —
  // reaching it would need ~1.25% titratable acidity, well outside real
  // buttermilk. Stoichiometry at 0.8% TA gives 1.79 g. The test passed against
  // the wrong number and guarded nothing.
  const stoichiometric = 1.79 / 240;
  const allowed = stoichiometric * 1.35;
  for (const diet of [DAIRY, VEGAN]) {
    const capacity = diet.vegan ? 0.54 : 1;
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; i + j <= 20; j++) {
        const b = blend(at(i / 20, j / 20, (20 - i - j) / 20), diet);
        const ceiling = b.ingredients.buttermilk * allowed * capacity;
        assert.ok(
          b.ingredients.bakingSoda <= ceiling + 1e-9,
          `soda ${b.ingredients.bakingSoda} exceeds ${ceiling}`,
        );
      }
    }
  }
});

test('the acid guard is satisfied by construction, never by clamping', () => {
  // Soda and buttermilk both originate at the cobbler vertex, so affine
  // interpolation holds their ratio constant over the whole triangle and the
  // acid cap can never bind. The leavening-removal note is a different guard and
  // is expected to fire near the dry edge.
  for (let i = 0; i <= 16; i++) {
    for (let j = 0; i + j <= 16; j++) {
      const b = blend(at(i / 16, j / 16, (16 - i - j) / 16));
      assert.ok(
        !b.constraintNotes.some((n) => n.includes('cut back')),
        'the acid cap should never bind on the dairy path',
      );
    }
  }
});

test('trace leavening is stripped near the dry edge, and only there', () => {
  const notes = (c) => blend(c).constraintNotes.join(' ');
  assert.match(notes(at(0.96, 0, 0.04)), /Leavening removed/);
  assert.doesNotMatch(notes(at(0.7, 0, 0.3)), /Leavening removed/);
  assert.doesNotMatch(notes(at(0, 0, 1)), /Leavening removed/);
});

test('leavening is stripped where there is no water to activate it', () => {
  const b = blend(at(0.97, 0, 0.03));
  assert.ok(b.hydration < 8);
  assert.equal(b.ingredients.bakingPowder, 0);
  assert.equal(b.ingredients.bakingSoda, 0);
});

// --- Morphology --------------------------------------------------------------

test('morphology walks the regime ladder with hydration', () => {
  assert.equal(morphology(0).regime, 'loose-crumb');
  assert.equal(morphology(16).regime, 'clumped-crumb');
  assert.equal(morphology(28).regime, 'rollable-sheet');
  assert.equal(morphology(42).regime, 'slack-drop');
  assert.equal(morphology(68).regime, 'biscuit-drop');
});

test('exposure index is continuous — no banding artefacts in the surface', () => {
  let prev = morphology(0).effectiveExposure;
  for (let h = 0.5; h <= 80; h += 0.5) {
    const v = morphology(h).effectiveExposure;
    // 0.04 per half-point of hydration. The rubble-to-dough transition around
    // 22-26% is genuinely steep — porosity collapses from 0.45 to 0.10 as loose
    // crumb becomes cohesive dough — but it stays continuous, and at heatmap
    // resolution half a hydration point is about three pixels.
    assert.ok(Math.abs(v - prev) < 0.04, `exposure jumped at h=${h}: ${prev} -> ${v}`);
    prev = v;
  }
});

test('dry-heat exposure dips in the middle and recovers at both ends', () => {
  const crumble = morphology(0).effectiveExposure;
  const middle = morphology(40).effectiveExposure;
  const cobbler = morphology(80).effectiveExposure;
  assert.ok(middle < crumble, 'the middle should sit more of its mass against the fruit');
  assert.ok(middle < cobbler, 'separated mounds should stand clearer than a slumped sheet');
});

// --- Quantities --------------------------------------------------------------

test('vertex RATIOS match the surveyed medians', () => {
  // Ratios are the sourced quantity. Absolute masses depend on target thickness,
  // raw density and oven expansion, which are still estimates.
  const crumble = buildRecipe(at(1, 0, 0), 'mixed', 'square20').topping;
  close(crumble.butterG / crumble.flourG, 0.667, 0.02, 'crumble butter:flour (median 66.7)');
  close(crumble.sugarTotalG / crumble.flourG, 0.57, 0.02, 'crumble sugar:flour (median 57.1)');

  const crisp = buildRecipe(at(0, 1, 0), 'mixed', 'square20').topping;
  const dryStructure = crisp.flourG + crisp.oatsG;
  close(crisp.oatsG / dryStructure, 0.41, 0.02, 'crisp oat fraction (median 40.6%)');
  close(crisp.butterG / dryStructure, 0.70, 0.02, 'crisp butter (median 70.1)');

  const cobbler = buildRecipe(at(0, 0, 1), 'mixed', 'square20').topping;
  close(cobbler.buttermilkG / cobbler.flourG, 0.80, 0.02, 'cobbler buttermilk');
  close(cobbler.butterG / cobbler.flourG, 0.45, 0.02, 'cobbler butter (median 45.4)');
  close(cobbler.sugarTotalG / cobbler.flourG, 0.30, 0.02, 'cobbler sugar (median 30.4)');

  // Cross-vertex sanity: a cobbler biscuit is leaner and far less sweet than a
  // crumble, which is what separates the two dishes.
  assert.ok(cobbler.butterG / cobbler.flourG < crumble.butterG / crumble.flourG);
  assert.ok(cobbler.sugarTotalG / cobbler.flourG < crumble.sugarTotalG / crumble.flourG);
});

test('topping load matches the surveyed medians at each corner', () => {
  // This is the figure the survey actually pins down. Fruit-to-topping ratio
  // spans 11x across British sources and is useless as a design rule; load per
  // unit of dish area clusters tightly and is what practice really holds fixed.
  const load = (c) => buildRecipe(c, 'mixed', 'square20').topping.totalG / 400;
  close(load(at(1, 0, 0)), 1.008, 0.03, 'crumble load g/cm2');
  close(load(at(0, 1, 0)), 0.830, 0.03, 'crisp load g/cm2');
  close(load(at(0, 0, 1)), 0.846, 0.03, 'cobbler load g/cm2');
});

test('both raw and dry mass fall toward the cobbler corner', () => {
  // Corrected against sourced loads. An earlier version of this test asserted
  // that RAW mass rises toward cobbler because buttermilk is heavy. It does not:
  // measured practice puts less total topping on a cobbler than on a crumble
  // (0.846 vs 1.008 g/cm2), which outweighs the liquid.
  const crumble = buildRecipe(at(1, 0, 0)).context;
  const cobbler = buildRecipe(at(0, 0, 1)).context;
  assert.ok(cobbler.dryToFruitRatio < crumble.dryToFruitRatio, 'dry mass should fall');
  assert.ok(cobbler.toppingToFruitRatio < crumble.toppingToFruitRatio, 'raw mass falls too');
});

test('thickener tracks the berry, not just the dish', () => {
  const straw = buildRecipe(at(1, 0, 0), 'strawberry').filling.tapiocaG;
  const blue = buildRecipe(at(1, 0, 0), 'blueberry').filling.tapiocaG;
  assert.ok(straw > blue * 1.5, 'strawberry should need far more starch than blueberry');
  close(straw, 23, 4, 'strawberry tapioca for 700 g');
});

test('a sealing topping calls for more thickener than an open one', () => {
  const open = buildRecipe(at(1, 0, 0), 'mixed').filling.tapiocaG;
  const sealing = buildRecipe(at(0.38, 0, 0.62), 'mixed').filling.tapiocaG;
  assert.ok(sealing > open, 'sealed topping traps water and needs more starch');
});

// --- Bake --------------------------------------------------------------------

test('nothing gets a two-stage bake — one source in thirty changes temperature', () => {
  for (const c of [at(1, 0, 0), at(0, 1, 0), at(0, 0, 1), at(0.3, 0.3, 0.4)]) {
    const bake = buildRecipe(c).bake;
    assert.equal(bake.twoStage, false);
    assert.equal(bake.stages.length, 1);
    assert.equal(bake.stages[0].minutes, bake.totalMinutes);
  }
});

test('oven temperature differs by corner, as the corpora do', () => {
  // A single flat schedule is a good crisp and a bad crumble.
  const crumble = buildRecipe(at(1, 0, 0)).bake;
  const crisp = buildRecipe(at(0, 1, 0)).bake;
  const cobbler = buildRecipe(at(0, 0, 1)).bake;

  assert.equal(crumble.celsius, 200, 'British crumble median, and its mode');
  assert.equal(crisp.celsius, 175, '350 F — 9 of 16 crisps sit exactly there');
  assert.equal(cobbler.celsius, 190, 'median of a flat 350-425 F plateau');

  assert.equal(crumble.fahrenheit, 400);
  assert.equal(crisp.fahrenheit, 350);
  assert.equal(cobbler.fahrenheit, 375);

  // Temperature and time trade off — the hotter corner is the shorter one.
  assert.ok(crumble.totalMinutes < crisp.totalMinutes, 'hotter bakes shorter');
  assert.ok(crumble.restMinutes < cobbler.restMinutes);
});

// --- The quality surface -----------------------------------------------------

test('all three corners score well', () => {
  for (const c of [at(1, 0, 0), at(0, 1, 0), at(0, 0, 1)]) {
    const s = buildRecipe(c, 'mixed').score.overall;
    assert.ok(s > 0.85, `corner scored only ${s.toFixed(3)}`);
  }
});

test('the crumble-crisp edge stays strong throughout — it is fully miscible', () => {
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const s = buildRecipe(at(1 - t, t, 0), 'mixed').score.overall;
    assert.ok(s > 0.85, `crumble-crisp at t=${t.toFixed(1)} scored ${s.toFixed(3)}`);
  }
});

test('the crumble-cobbler edge has a real trough around 60% cobbler', () => {
  let worst = { s: 1, t: null };
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const s = buildRecipe(at(1 - t, 0, t), 'mixed').score.overall;
    if (s < worst.s) worst = { s, t };
  }
  assert.ok(worst.s < 0.7, `expected a visible trough, worst was ${worst.s.toFixed(3)}`);
  assert.ok(worst.t > 0.45 && worst.t < 0.8, `trough at t=${worst.t.toFixed(2)}, expected mid-high`);
});

test('oats rescue the interior — the centroid beats the crumble-cobbler midpoint', () => {
  const centroid = buildRecipe(at(1 / 3, 1 / 3, 1 / 3), 'mixed').score.overall;
  const edgeMid = buildRecipe(at(0.5, 0, 0.5), 'mixed').score.overall;
  assert.ok(centroid > edgeMid, 'expected the oat-bearing interior to beat the dry edge');
});

test('a cobbler crust is crisp too — both routes to a crisp surface work', () => {
  // The corpus names crisp more often than any other target for sweet biscuit
  // cobbler toppings. A model where only dry toppings can crisp is wrong.
  const crisp = buildRecipe(at(0, 1, 0)).score;
  const cobbler = buildRecipe(at(0, 0, 1)).score;
  assert.ok(crisp.surfaceCrisp > 0.85, 'sugar-glass route');
  assert.ok(cobbler.surfaceCrisp > 0.85, 'bake-crust route');
  assert.ok(cobbler.tenderCrumb > 0.9, 'and a tender interior underneath it');
  assert.ok(crisp.tenderCrumb < 0.05, 'which a dry topping does not have');
});

test('stratification is what the middle fails at, not an either/or', () => {
  const cobbler = buildRecipe(at(0, 0, 1)).score;
  const mid = buildRecipe(at(0.5, 0, 0.5)).score;
  assert.ok(cobbler.stratification > 0.9, 'crisp above, tender below');
  assert.ok(mid.stratification < 0.6, 'the middle develops neither properly');
  // And it fails through real defects, not through an assumed exclusivity.
  assert.ok(mid.components.cooked.risk > 0.2, 'the middle is undercooked');
  assert.ok(mid.components.height.risk > 0.2, 'and it slumps');
});

test('wetter berries lower the surface everywhere', () => {
  for (const c of [at(1, 0, 0), at(0, 0, 1), at(0.4, 0.2, 0.4)]) {
    const straw = buildRecipe(c, 'strawberry').score.overall;
    const blue = buildRecipe(c, 'blueberry').score.overall;
    assert.ok(blue > straw, 'blueberry should be more forgiving than strawberry');
  }
});

test('the unattested defect terms are gone, not merely dormant', () => {
  // Across ~50 surveyed recipes not one warns about a dry, greasy or burnt
  // topping. Terms with no attestation were removed rather than left in scoring
  // at weight zero, so that the component list reflects the evidence.
  const s = buildRecipe(at(0.4, 0.3, 0.3), 'strawberry').score;
  assert.equal(s.components.grease, undefined);
  assert.equal(s.components.bland, undefined);
  // What replaced them is attested: powderiness is cited as often as sogginess.
  assert.ok(s.components.cohesion, 'under-cohesion is a real, cited defect');
  assert.ok(s.components.underside, 'and a contested one, weighted accordingly');
  assert.ok(s.components.underside.weight < s.components.cooked.weight,
    'contested defects must weigh less than agreed ones');
});

test('one bad component tanks the point — geometric, not arithmetic', () => {
  // A single near-zero component must not be rescuable by strong ones. An
  // arithmetic mean of this set is 0.83; the geometric mean must be far lower.
  const withOneFailure = [
    { value: 1.0, weight: 1 },
    { value: 1.0, weight: 1 },
    { value: 1.0, weight: 1 },
    { value: 0.03, weight: 1 },
    { value: 1.0, weight: 1 },
  ];
  assert.ok(
    weightedGeometricMean(withOneFailure) < 0.55,
    'a sealed gummy underside must not be rescuable by an excellent crunch',
  );

  // And on the real surface, the worst point sits below its own weighted mean.
  const s = buildRecipe(at(0.38, 0, 0.62), 'strawberry').score;
  const vals = Object.values(s.components);
  const arithmetic =
    vals.reduce((a, c) => a + c.value * c.weight, 0) / vals.reduce((a, c) => a + c.weight, 0);
  assert.ok(s.overall < arithmetic - 0.01, 'geometric mean should sit below the arithmetic one');
});

test('the score domain covers the whole surface across every berry', () => {
  let min = Infinity;
  let max = -Infinity;
  for (const berryKey of Object.keys(BERRIES)) {
    for (let i = 0; i <= 30; i++) {
      for (let j = 0; i + j <= 30; j++) {
        const v = buildRecipe(at(i / 30, j / 30, (30 - i - j) / 30), berryKey).score.overall;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  assert.ok(min >= SCORE_DOMAIN[0], `surface min ${min.toFixed(3)} falls below the ramp floor`);
  assert.ok(max <= SCORE_DOMAIN[1], `surface max ${max.toFixed(3)} exceeds the ramp ceiling`);
  assert.ok(min < SCORE_DOMAIN[0] + 0.12, 'ramp floor is wastefully far below the surface');
});

test('scoreAt matches buildRecipe on the same point', () => {
  const c = at(0.25, 0.35, 0.4);
  close(
    scoreAt(c, BERRIES.raspberry, DISHES.square20),
    buildRecipe(c, 'raspberry', 'square20').score.overall,
    1e-12,
  );
});

test('the surface is finite and bounded everywhere', () => {
  for (const berryKey of Object.keys(BERRIES)) {
    for (let i = 0; i <= 15; i++) {
      for (let j = 0; i + j <= 15; j++) {
        const s = buildRecipe(at(i / 15, j / 15, (15 - i - j) / 15), berryKey).score.overall;
        assert.ok(Number.isFinite(s) && s > 0 && s <= 1, `bad score ${s}`);
      }
    }
  }
});

// --- Diet substitutions ------------------------------------------------------

test('vegan raises the fat weight to match butter fat content', () => {
  const dairy = buildRecipe(at(1, 0, 0), 'mixed', 'square20', DAIRY);
  const vegan = buildRecipe(at(1, 0, 0), 'mixed', 'square20', VEGAN);
  const ratio = vegan.basis.butter / dairy.basis.butter;
  close(ratio, 0.81 / 0.78, 1e-9, 'fat-matched weight');
  assert.ok(vegan.topping.butterG > dairy.topping.butterG);
});

test('the vegan block brings extra water in with it', () => {
  const dairy = buildRecipe(at(1, 0, 0), 'mixed', 'square20', DAIRY);
  const vegan = buildRecipe(at(1, 0, 0), 'mixed', 'square20', VEGAN);
  assert.equal(dairy.axes.hydration, 0);
  assert.ok(vegan.axes.hydration > 0 && vegan.axes.hydration < 5,
    `expected a small hydration bump, got ${vegan.axes.hydration}`);
});

test('the acid budget has two tiers, and each fires on the right path', () => {
  const dairy = blend(at(0, 0, 1), DAIRY);
  const vegan = blend(at(0, 0, 1), VEGAN);

  // Dairy sits above stoichiometry but inside the browning allowance — a
  // deliberate alkaline surplus, reported rather than corrected.
  assert.ok(dairy.constraintNotes.some((n) => n.includes('deliberate')));
  assert.ok(!dairy.constraintNotes.some((n) => n.includes('cut back')));

  // Soured soy milk carries ~54% of the acid, so the allowance is exceeded.
  assert.ok(vegan.constraintNotes.some((n) => n.includes('cut back')));
  assert.ok(vegan.ingredients.bakingSoda < dairy.ingredients.bakingSoda);
  assert.ok(vegan.ingredients.bakingPowder > dairy.ingredients.bakingPowder);
});

test('the cobbler vertex sits inside the browning allowance, not past it', () => {
  const c = blend(at(0, 0, 1), DAIRY).ingredients;
  const ratio = c.bakingSoda / c.buttermilk;
  const stoichiometric = 1.79 / 240;
  assert.ok(ratio > stoichiometric, 'a small surplus is wanted, for browning');
  assert.ok(ratio < stoichiometric * 1.35, 'but not past the allowance');
  close(ratio / stoichiometric, 1.17, 0.02, 'surplus multiple');
});

test('converting soda to powder preserves total lift', () => {
  for (const t of [0.4, 0.7, 1.0]) {
    const dairy = blend(at(1 - t, 0, t), DAIRY);
    const vegan = blend(at(1 - t, 0, t), VEGAN);
    close(vegan.leaveningPower, dairy.leaveningPower, 1e-9, `lift at ${t} cobbler`);
  }
});

test('a gluten-free crumble gets NO xanthan, and a biscuit gets a full dose', () => {
  const pctOf = (c) => {
    const t = buildRecipe(c, 'mixed', 'square20', GF).topping;
    return (t.xanthanG / t.flourG) * 100;
  };
  // Loose rubble has no crumb to bind and no gas to trap, and xanthan would only
  // hold water — which depresses the glass transition the crunch depends on.
  assert.equal(pctOf(at(1, 0, 0)), 0, 'crumble must get none');
  assert.equal(pctOf(at(0, 1, 0)), 0, 'crisp must get none');
  close(pctOf(at(0, 0, 1)), 1.1, 0.05, 'cobbler xanthan % (published band 0.8-1.2)');
  assert.equal(buildRecipe(at(1, 0, 0), 'mixed', 'square20', DAIRY).topping.xanthanG, 0);
});

test('gluten-free is nearly free at the dry corners and costs at the cobbler corner', () => {
  const cost = (c) =>
    buildRecipe(c, 'mixed', 'square20', DAIRY).score.overall -
    buildRecipe(c, 'mixed', 'square20', GF).score.overall;

  const crumbleCost = cost(at(1, 0, 0));
  const crispCost = cost(at(0, 1, 0));
  const cobblerCost = cost(at(0, 0, 1));

  assert.ok(Math.abs(crumbleCost) < 0.005, `crumble should be ~free, cost ${crumbleCost.toFixed(4)}`);
  assert.ok(Math.abs(crispCost) < 0.005, `crisp should be ~free, cost ${crispCost.toFixed(4)}`);
  assert.ok(cobblerCost > 0.02, `cobbler should pay a real cost, got ${cobblerCost.toFixed(4)}`);
});

test('every diet combination stays finite and bounded across the whole triangle', () => {
  for (const diet of [DAIRY, VEGAN, GF, BOTH]) {
    for (const berryKey of Object.keys(BERRIES)) {
      for (let i = 0; i <= 12; i++) {
        for (let j = 0; i + j <= 12; j++) {
          const r = buildRecipe(at(i / 12, j / 12, (12 - i - j) / 12), berryKey, 'square20', diet);
          assert.ok(Number.isFinite(r.score.overall) && r.score.overall > 0 && r.score.overall <= 1);
          for (const v of Object.values(r.topping)) {
            if (typeof v === 'number') assert.ok(Number.isFinite(v) && v >= 0, 'bad topping quantity');
          }
        }
      }
    }
  }
});

test('the cobbler corner leads on dairy — it is the only corner that stratifies', () => {
  // A change of result, and a sourced one. Under the previous scoring the crisp
  // corner won everywhere. Now the cobbler leads, because it is the only point
  // that develops BOTH a crisp crust and a tender interior, which is exactly how
  // the surveyed sources define a successful cobbler topping. The dry corners
  // are not penalised for lacking an interior: stratification's weight scales
  // with hydration, so it barely applies to them.
  for (const berryKey of Object.keys(BERRIES)) {
    const s = (c) => buildRecipe(c, berryKey, 'square20', DAIRY).score.overall;
    assert.ok(s(at(0, 0, 1)) > s(at(0, 1, 0)), `cobbler should lead on ${berryKey}`);
    assert.ok(s(at(0, 1, 0)) > s(at(1, 0, 0)), `crisp should beat crumble on ${berryKey}`);
  }
});

test('gluten-free moves the optimum from the cobbler corner to the crisp corner', () => {
  // The cleanest expression of "GF is free where flour is filler and costly
  // where it is structure". Losing gluten costs the cobbler its oven spring and
  // therefore its tender interior and its stratification; the crisp corner,
  // which relies on neither, is untouched.
  for (const berryKey of Object.keys(BERRIES)) {
    const gf = (c) => buildRecipe(c, berryKey, 'square20', GF).score.overall;
    assert.ok(gf(at(0, 1, 0)) > gf(at(0, 0, 1)), `crisp should lead on GF for ${berryKey}`);

    const dairy = (c) => buildRecipe(c, berryKey, 'square20', DAIRY).score.overall;
    close(gf(at(0, 1, 0)), dairy(at(0, 1, 0)), 1e-9, 'GF is free at the crisp corner');
    assert.ok(gf(at(0, 0, 1)) < dairy(at(0, 0, 1)) - 0.02, 'and costs at the cobbler corner');
  }
});

test('substitutions are described wherever they are applied', () => {
  assert.equal(buildRecipe(at(0, 0, 1), 'mixed', 'square20', DAIRY).substitutions.length, 0);
  assert.ok(buildRecipe(at(0, 0, 1), 'mixed', 'square20', VEGAN).substitutions.length >= 3);
  assert.ok(buildRecipe(at(0, 0, 1), 'mixed', 'square20', GF).substitutions.length >= 2);
  const both = buildRecipe(at(0, 0, 1), 'mixed', 'square20', BOTH);
  assert.ok(both.substitutions.length >= 5);
  assert.ok(both.dietNotes.length >= 2);
});

test('gluten-free labels the oats as certified', () => {
  assert.match(buildRecipe(at(0, 1, 0), 'mixed', 'square20', GF).labels.oats, /[Cc]ertified/);
});
