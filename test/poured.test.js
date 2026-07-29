import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FAMILIES } from '../src/model/families.js';
import { POURED_VERTICES, POURED_KEYS, hydrationOf } from '../src/model/poured/vertices.js';
import { fluidity, inversionCapacity } from '../src/model/poured/morphology.js';
import { blend } from '../src/model/blend.js';
import { buildRecipe, scoreAt } from '../src/model/recipe.js';
import { BERRIES, DISHES } from '../src/model/fruit.js';

const at = (batter, sonker, cake) => ({ batter, sonker, cake });
const P = FAMILIES.poured;
const DAIRY = { vegan: false, glutenFree: false };
const VEGAN = { vegan: true, glutenFree: false };
const GF = { vegan: false, glutenFree: true };
const build = (c, diet = DAIRY) => buildRecipe(c, 'mixed', 'square20', diet, 'poured');
const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ~${b}, got ${a}`);

// --- Basis and interpolation -------------------------------------------------

test('poured vertices round-trip through the blend unchanged', () => {
  for (const key of POURED_KEYS) {
    const coords = { batter: 0, sonker: 0, cake: 0, [key]: 1 };
    const b = blend(coords, DAIRY, P);
    for (const [field, expected] of Object.entries(POURED_VERTICES[key].ingredients)) {
      close(b.ingredients[field], expected, 1e-9, `${key}.${field}`);
    }
  }
});

test('flour = 100 everywhere on the poured triangle', () => {
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; i + j <= 10; j++) {
      const b = blend(at(i / 10, j / 10, (10 - i - j) / 10), DAIRY, P);
      close(b.ingredients.flour + b.ingredients.oats, 100, 1e-9, 'dry structure basis');
    }
  }
});

test('no ingredient peaks in the interior — affine over a simplex', () => {
  const fields = Object.keys(POURED_VERTICES.batter.ingredients);
  for (const f of fields) {
    const hi = Math.max(...POURED_KEYS.map((k) => POURED_VERTICES[k].ingredients[f]));
    const lo = Math.min(...POURED_KEYS.map((k) => POURED_VERTICES[k].ingredients[f]));
    for (let i = 0; i <= 16; i++) {
      for (let j = 0; i + j <= 16; j++) {
        const v = blend(at(i / 16, j / 16, (16 - i - j) / 16), DAIRY, P).ingredients[f];
        assert.ok(v <= hi + 1e-9 && v >= lo - 1e-9, `${f} escaped its vertex range`);
      }
    }
  }
});

// --- Hydration counts egg ----------------------------------------------------

test('egg counts as water, or the pudding cake reads three times too dry', () => {
  // The cake corner pours in only 23 parts of milk but carries 83 parts of egg,
  // which is ~75% water. Reading the liquid field alone would call it drier than
  // any other point in the family and put it in the wrong regime entirely.
  const ing = POURED_VERTICES.cake.ingredients;
  assert.equal(ing.buttermilk, 23);
  close(hydrationOf(ing), 23 + 83 * 0.75, 1e-9, 'cake hydration');

  const r = build(at(0, 0, 1));
  assert.ok(r.axes.hydration > 80, 'the cake is a wet batter, not a dry one');
  assert.ok(r.axes.hydration > r.basis.buttermilk * 3);
});

// --- The inversion -----------------------------------------------------------

test('fluidity and inversion capacity rank the corners as the sources describe', () => {
  const f = (k) => fluidity(POURED_VERTICES[k].ingredients);
  assert.ok(f('batter') > f('sonker'), 'the sugariest, wettest batter is the most mobile');
  assert.ok(f('sonker') > f('cake'), 'and the lean egg batter is the stiffest');

  const cap = (k) =>
    inversionCapacity(
      POURED_VERTICES[k].ingredients,
      POURED_VERTICES[k].ingredients.bakingPowder,
    );
  assert.ok(cap('batter') > 0.9, 'the batter cobbler is the one that really inverts');
});

test('the sonker pours over pre-baked fruit; the batter cobbler inverts under it', () => {
  const sonker = build(at(0, 1, 0));
  assert.equal(sonker.morphology.assembly.key, 'poured-over');
  assert.equal(sonker.bake.prebake, true);
  assert.equal(sonker.bake.prebakeMinutes, 30, 'a real head start, not the rubbed 10 minutes');
  assert.equal(sonker.morphology.inversion, 0, 'pre-baking forecloses inversion');

  const batter = build(at(1, 0, 0));
  assert.equal(batter.morphology.assembly.key, 'self-inverting');
  assert.equal(batter.bake.prebake, false);
  assert.ok(batter.morphology.inversion > 0.9);
  assert.match(batter.morphology.assembly.steps.join(' '), /DO NOT STIR/);
});

test('REGRESSION: the form label describes what happens, not unused capacity', () => {
  // The sonker has ample capacity to invert and deliberately declines to use it.
  // Choosing the label from capacity announced "Full inversion" on the one corner
  // whose source says "it doesn't rise much, it's designed to stay flat".
  const sonker = build(at(0, 1, 0));
  assert.ok(sonker.morphology.inversionCapacity > 0.7, 'it could have inverted');
  assert.equal(sonker.morphology.regime, 'flat-lid', 'but it does not, and says so');
});

test('REGRESSION: the pre-bake is given once, not twice', () => {
  // The bake schedule owns the pre-bake timing. The poured-over assembly used to
  // open with its own "bake the fruit alone" line as well, so the sonker method
  // told you to do it twice in consecutive steps.
  const sonker = build(at(0, 1, 0));
  assert.equal(sonker.bake.prebake, true);
  const selfDescribed = sonker.morphology.assembly.steps.filter((x) =>
    /bake the fruit alone/i.test(x),
  );
  assert.equal(selfDescribed.length, 0, 'the assembly leaves the pre-bake to the schedule');
});

test('REGRESSION: deleting an inapplicable term is not neutral in a geometric mean', () => {
  // A sonker is not a failed batter cobbler, so it must not be marked down for
  // declining to invert. The FIRST attempt at that gave the inversion term zero
  // weight where the fruit is pre-baked — which backfired: the term's value at an
  // inverting point (~0.89) sits well above the overall score, so removing it
  // pulled the mean DOWN. The sonker was penalised by the very device meant to
  // excuse it, producing a 0.15 cliff and a visible hard edge on the surface.
  //
  // The term now asks whether the CHOSEN assembly worked, of both assemblies.
  const sonker = build(at(0, 1, 0));
  const batter = build(at(1, 0, 0));
  assert.ok(sonker.score.components.inversion.weight > 0.5, 'the term still applies');
  assert.ok(sonker.score.components.inversion.value > 0.8,
    'pouring onto hot fruit is a reliable assembly on its own terms');
  assert.equal(sonker.score.components.inversion.label, 'Assembly');
  assert.equal(batter.score.components.inversion.label, 'Inversion');
});

test('the pre-bake boundary is a step, and it is bounded', () => {
  // Pre-baking is a genuine either/or, so a discontinuity there is honest rather
  // than an artefact — but it was 0.15 when it was mostly the scoring bug above,
  // and it should not silently grow back. The residual step is a real
  // disagreement with the sonker source and is documented in poured/score.js.
  let biggest = 0;
  let prev = null;
  for (let i = 0; i <= 20; i++) {
    const s = i / 20;
    const v = scoreAt({ sonker: s, cake: 0, batter: 1 - s },
      BERRIES.mixed, DISHES.square20, DAIRY, 'poured');
    if (prev !== null) biggest = Math.max(biggest, Math.abs(v - prev));
    prev = v;
  }
  assert.ok(biggest < 0.12, `step at the pre-bake boundary grew to ${biggest.toFixed(3)}`);
});

// --- Chemistry ---------------------------------------------------------------

test('no poured vertex uses soda, so nothing is soured', () => {
  for (const key of POURED_KEYS) {
    assert.equal(POURED_VERTICES[key].ingredients.bakingSoda, 0, `${key} soda`);
  }
  // ... and therefore the vegan path uses plain soy milk with no lemon, because
  // the lemon is only ever there to replace buttermilk's acid.
  const r = build(at(1, 0, 0), VEGAN);
  assert.equal(r.topping.liquidSplit.lemonG, 0);
  assert.ok(r.topping.liquidSplit.soyG > 50, 'all of the liquid, none of it soured');
  assert.ok(!r.dietNotes.some((n) => /sour the soy milk/i.test(n)));
});

test('the acid guard never fires on the poured family', () => {
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; i + j <= 8; j++) {
      for (const diet of [DAIRY, VEGAN]) {
        const b = blend(at(i / 8, j / 8, (8 - i - j) / 8), diet, P);
        assert.equal(b.ingredients.bakingSoda, 0);
        assert.ok(!b.constraintNotes.some((n) => /cut back|Leavening removed/.test(n)));
      }
    }
  }
});

test('vegan replaces egg with a flax egg and says what that costs', () => {
  const dairy = build(at(0, 0, 1));
  const vegan = build(at(0, 0, 1), VEGAN);

  assert.ok(dairy.topping.eggG > 50, 'the cake corner is built on egg');
  assert.equal(vegan.topping.eggG, 0, 'and the vegan path has none');
  assert.ok(vegan.topping.groundFlaxG > 1, 'replaced by ground flaxseed');
  // The water the egg carried is still in the mixture.
  assert.ok(vegan.axes.hydration > dairy.axes.hydration * 0.9);

  const sub = vegan.substitutions.find((s) => s.from === 'Egg');
  assert.ok(sub, 'the swap is declared');
  assert.match(sub.why, /coagulate/, 'and is honest that flax cannot set like egg protein');
});

test('vegan leaves the egg-free corners alone', () => {
  const vegan = build(at(1, 0, 0), VEGAN);
  assert.equal(vegan.topping.groundFlaxG, 0, 'no flax where there was no egg');
  assert.ok(!vegan.substitutions.some((s) => s.from === 'Egg'));
});

// --- Quantities and bake -----------------------------------------------------

test('poured mass comes straight from the measured load per cm²', () => {
  for (const [key, expected] of [['batter', 1.12], ['sonker', 1.38], ['cake', 0.91]]) {
    const coords = { batter: 0, sonker: 0, cake: 0, [key]: 1 };
    const r = build(coords);
    close(r.topping.totalG / DISHES.square20.areaCm2, expected, 1e-6, `${key} load`);
  }
});

test('the poured family uses plain granulated sugar, the rubbed one does not', () => {
  // Sourced, not stylistic: every poured source specifies white.
  const p = build(at(1, 0, 0));
  assert.equal(p.topping.sugarBrownG, 0);
  const rubbed = buildRecipe({ crumble: 1, crisp: 0, cobbler: 0 }, 'mixed', 'square20', DAIRY);
  assert.ok(rubbed.topping.sugarBrownG > 0);
});

// --- Family isolation --------------------------------------------------------

test('the two families are genuinely separate, not a relabelling', () => {
  const rubbed = buildRecipe({ crumble: 0, crisp: 0, cobbler: 1 }, 'mixed', 'square20', DAIRY);
  const poured = build(at(1, 0, 0));

  assert.equal(rubbed.family.key, 'rubbed');
  assert.equal(poured.family.key, 'poured');
  // Different score models produce different component sets.
  assert.ok('surfaceCrisp' in rubbed.score.components);
  assert.ok('lid' in poured.score.components);
  assert.ok(!('lid' in rubbed.score.components));
  assert.ok(!('surfaceCrisp' in poured.score.components));
  // Different display domains, so the two maps are not read against each other.
  assert.notDeepEqual(rubbed.scoreDomain, poured.scoreDomain);
});

test('THE GAP IS REAL: no poured point is reachable from the rubbed triangle', () => {
  // The survey splits cobbler liquid into a dough cluster at 41-72 and a batter
  // cluster at 94-176 with nothing between. This is the whole justification for
  // two triangles rather than one, so it gets a test.
  let rubbedMax = 0;
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; i + j <= 12; j++) {
      const b = blend({ crumble: i / 12, crisp: j / 12, cobbler: (12 - i - j) / 12 });
      rubbedMax = Math.max(rubbedMax, b.hydration);
    }
  }
  let pouredMin = Infinity;
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; i + j <= 12; j++) {
      const b = blend(at(i / 12, j / 12, (12 - i - j) / 12), DAIRY, P);
      pouredMin = Math.min(pouredMin, b.hydration);
    }
  }
  assert.ok(rubbedMax <= 80.001, `rubbed tops out at ${rubbedMax}`);
  assert.ok(pouredMin >= 85, `poured bottoms out at ${pouredMin}`);
  assert.ok(pouredMin > rubbedMax, 'the two families do not overlap in hydration');
});

// --- Surface sanity ----------------------------------------------------------

test('the poured surface is continuous — no banding artefacts', () => {
  const N = 24;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const c = at(i / N, 0, 1 - i / N);
    const v = scoreAt(c, BERRIES.mixed, DISHES.square20, DAIRY, 'poured');
    if (prev !== null) assert.ok(Math.abs(v - prev) < 0.06, `jump along the batter-cake edge at ${i}`);
    prev = v;
  }
});

test('every poured point produces a coherent recipe', () => {
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; i + j <= 6; j++) {
      for (const diet of [DAIRY, VEGAN, GF]) {
        const r = build(at(i / 6, j / 6, (6 - i - j) / 6), diet);
        assert.ok(r.topping.totalG > 100, 'has mass');
        assert.ok(r.topping.flourG > 0 && r.topping.buttermilkG > 0, 'pourable');
        assert.ok(r.score.overall > 0 && r.score.overall <= 1, 'scored');
        assert.ok(r.morphology.assembly.steps.length >= 1, 'has an assembly');
        assert.ok(r.naming.name, 'has a name');
      }
    }
  }
});
