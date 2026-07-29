import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FAMILIES } from '../src/model/families.js';
import { buildRecipe } from '../src/model/recipe.js';
import {
  projectOntoFamily, referenceScales, MAX_PLOTTABLE_FIELD, GOOD_RESIDUAL,
} from '../src/model/project.js';
import {
  buildBakeRecord, validateBakeRecord, observationsFor, vertexFingerprint,
  recordFilename, pullRequestUrl, BAKE_SCHEMA,
} from '../src/model/bake-record.js';

const DAIRY = { vegan: false, glutenFree: false };
const rubbed = (c) => buildRecipe(c, 'mixed', 'square20', DAIRY, 'rubbed');
const poured = (c) => buildRecipe(c, 'mixed', 'square20', DAIRY, 'poured');

// --- Projection --------------------------------------------------------------

test('every vertex projects onto itself with zero residual', () => {
  for (const family of Object.values(FAMILIES)) {
    for (const key of family.keys) {
      const fit = projectOntoFamily(family.vertices[key].ingredients, family);
      assert.ok(fit.residual < 1e-9, `${family.key}/${key} residual ${fit.residual}`);
      assert.ok(fit.coords[key] > 0.999, `${family.key}/${key} should map to its own corner`);
      assert.ok(fit.onPlane && fit.plottable);
    }
  }
});

test('a known blend round-trips back to the coordinates that made it', () => {
  const family = FAMILIES.rubbed;
  const target = { crumble: 0.25, crisp: 0.5, cobbler: 0.25 };
  const blended = rubbed(target).basis;
  const fit = projectOntoFamily(blended, family);
  for (const k of family.keys) {
    assert.ok(Math.abs(fit.coords[k] - target[k]) < 1e-6, `${k}: ${fit.coords[k]} vs ${target[k]}`);
  }
});

test('coordinates stay inside the simplex however extreme the input', () => {
  const family = FAMILIES.rubbed;
  const absurd = { oats: 300, butter: -50, sugar: 900, buttermilk: 400, egg: 200, bakingPowder: 40, bakingSoda: 9 };
  const fit = projectOntoFamily(absurd, family);
  const sum = family.keys.reduce((s, k) => s + fit.coords[k], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'coordinates sum to 1');
  for (const k of family.keys) assert.ok(fit.coords[k] >= -1e-9, `${k} is non-negative`);
  assert.ok(!fit.plottable, 'and it is nowhere near the plane, so it is not drawn');
});

test('REGRESSION: scales are global, so residuals from the two families compare', () => {
  // Scaling per-family made the two residuals different units — and they were
  // being compared, to decide which triangle a recipe belongs to. One surveyed
  // cobbler came out rubbed 0.361 vs poured 0.359, a coin flip between numbers
  // that were never on the same scale.
  const s = referenceScales(Object.values(FAMILIES));
  assert.ok(s.egg > 80, `egg range should span the whole space, got ${s.egg}`);
  assert.ok(s.sugar > 130, `sugar range should span both families, got ${s.sugar}`);
  // Computed from BOTH families, so neither can produce it alone.
  assert.notDeepEqual(
    referenceScales([FAMILIES.rubbed]).sugar,
    referenceScales([FAMILIES.rubbed, FAMILIES.poured]).sugar,
  );
});

test('REGRESSION: one badly-wrong field is not hidden by five right ones', () => {
  // RMS over six fields let the rolled sonker look on-plane: 14.5 parts fat
  // against a rubbed floor of 45 is the single property that makes it rollable,
  // and the documented reason it is out of reach, but the other five fields fit
  // and dragged the average down.
  const rolledSonker = { oats: 0, butter: 14.5, sugar: 0, buttermilk: 51, egg: 0, bakingPowder: 4.8, bakingSoda: 0 };
  const fit = projectOntoFamily(rolledSonker, FAMILIES.rubbed);
  assert.equal(fit.worst.field, 'butter');
  assert.ok(fit.worst.delta > MAX_PLOTTABLE_FIELD, `worst field only ${fit.worst.delta}`);
  assert.equal(fit.worst.direction, 'below', 'it has LESS fat than the triangle can make');
  assert.ok(!fit.plottable, 'so it must not be drawn as a position');
});

// --- The generated anchors ---------------------------------------------------

const anchors = JSON.parse(readFileSync(new URL('../data/anchors.json', import.meta.url), 'utf8'));

test('anchors.json is present, populated and internally consistent', () => {
  assert.ok(anchors.anchors.length > 30, `only ${anchors.anchors.length} anchors`);
  for (const a of anchors.anchors) {
    assert.ok(FAMILIES[a.family], `${a.id} has an unknown family`);
    const sum = Object.values(a.coords).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - 1) < 0.002, `${a.id} coords sum to ${sum}`);
    assert.ok(a.residual >= 0);
    if (a.onPlane) assert.ok(a.plottable, `${a.id} on-plane but not plottable`);
  }
});

test('the batter-cobbler sources land on the vertex they define', () => {
  // ATK and the folk Magic Cobbler are what the batter vertex is built from, so
  // a projection that does not put them there means the vertex, the extractor or
  // the projection disagree with each other.
  const atk = anchors.anchors.find((a) => a.id === 'batter-atk-easy-blueberry');
  assert.ok(atk, 'ATK is in the anchors');
  assert.equal(atk.family, 'poured');
  assert.ok(atk.coords.batter > 0.9, `ATK sits at batter=${atk.coords.batter}`);
  assert.ok(atk.residual < 0.1, `ATK residual ${atk.residual}`);
});

test('the rolled sonker is still recorded as unreachable', () => {
  // The documented gap: rollable because of very low fat, and no point in either
  // triangle can produce it. If this ever becomes plottable, either a vertex
  // moved or the projection got too permissive.
  const s = anchors.anchors.find((a) => a.id === 'sonker-rockford');
  assert.ok(s, 'the rolled sonker is in the anchors');
  assert.equal(s.plottable, false);
  assert.equal(s.worst.field, 'butter');
});

// --- Bake records ------------------------------------------------------------

const outcome = {
  rating: 4,
  observations: ['top-crisp', 'filling-just-set'],
  review: 'Good.',
  followedRecipe: true,
  ovenType: 'fan',
};

test('a record captures the prediction and the outcome together', () => {
  const r = rubbed({ crumble: 0, crisp: 1, cobbler: 0 });
  const rec = buildBakeRecord(r, outcome, { family: FAMILIES.rubbed });

  assert.equal(rec.schema, BAKE_SCHEMA);
  assert.equal(rec.outcome.rating, 4);
  assert.equal(rec.predicted.overall, Number(r.score.overall.toFixed(3)));
  assert.ok(rec.predicted.components.surfaceCrisp > 0, 'per-component prediction is kept');
  assert.equal(rec.predicted.calibrated, true);
  // Frozen quantities, so the record survives a vertex revision.
  assert.ok(rec.resolved.grams.total > 100);
  assert.equal(rec.resolved.basisPer100.oats, 41);
  assert.ok(validateBakeRecord(rec).ok);
});

test('a poured record says on its face that it is uncalibrated', () => {
  const rec = buildBakeRecord(poured({ batter: 1, sonker: 0, cake: 0 }), outcome, { family: FAMILIES.poured });
  assert.equal(rec.predicted.calibrated, false);
});

test('the vertex fingerprint changes when a vertex changes', () => {
  const before = vertexFingerprint(FAMILIES.rubbed);
  const tweaked = {
    ...FAMILIES.rubbed,
    vertices: {
      ...FAMILIES.rubbed.vertices,
      crumble: {
        ...FAMILIES.rubbed.vertices.crumble,
        ingredients: { ...FAMILIES.rubbed.vertices.crumble.ingredients, butter: 67.7 },
      },
    },
  };
  assert.notEqual(before, vertexFingerprint(tweaked),
    'a hand-maintained version number would have gone stale here');
});

test('a deviated bake must say what was changed', () => {
  const r = rubbed({ crumble: 1, crisp: 0, cobbler: 0 });
  const bad = buildBakeRecord(r, { ...outcome, followedRecipe: false }, { family: FAMILIES.rubbed });
  const res = validateBakeRecord(bad);
  assert.equal(res.ok, false);
  assert.match(res.errors.join(' '), /what you changed/);

  const good = buildBakeRecord(
    r, { ...outcome, followedRecipe: false, deviations: 'half the sugar' }, { family: FAMILIES.rubbed },
  );
  assert.ok(validateBakeRecord(good).ok);
});

test('ratings outside 1-5 and unknown observations are rejected', () => {
  const r = rubbed({ crumble: 1, crisp: 0, cobbler: 0 });
  assert.equal(validateBakeRecord(buildBakeRecord(r, { ...outcome, rating: 0 }, {})).ok, false);
  assert.equal(validateBakeRecord(buildBakeRecord(r, { ...outcome, rating: 6 }, {})).ok, false);
  const wrong = buildBakeRecord(r, { ...outcome, observations: ['lid-crisp'] }, {});
  assert.match(validateBakeRecord(wrong).errors.join(' '), /unknown observation/,
    'a poured observation on a rubbed bake is not a valid record');
});

test('observations are family-specific and keyed to real score components', () => {
  for (const [famKey, family] of Object.entries(FAMILIES)) {
    const r = famKey === 'poured'
      ? poured({ batter: 1, sonker: 0, cake: 0 })
      : rubbed({ crumble: 0, crisp: 1, cobbler: 0 });
    for (const o of observationsFor(famKey)) {
      if (!o.component) continue;
      assert.ok(o.component in r.score.components,
        `${famKey}: observation "${o.key}" names component "${o.component}", which does not exist`);
    }
    assert.ok(family);
  }
});

test('no two bakes collide on a filename', () => {
  // One file per bake is what keeps contributed pull requests from conflicting,
  // so the ids have to be distinct even for identical bakes in the same second.
  const r = rubbed({ crumble: 1, crisp: 0, cobbler: 0 });
  const now = new Date('2026-07-29T12:00:00Z');
  const a = buildBakeRecord(r, outcome, { now, family: FAMILIES.rubbed });
  const b = buildBakeRecord(rubbed({ crumble: 0, crisp: 1, cobbler: 0 }), outcome, { now, family: FAMILIES.rubbed });
  assert.notEqual(recordFilename(a), recordFilename(b));
  assert.match(recordFilename(a), /^data\/bakes\/2026-07-29-rubbed-.*\.json$/);
});

test('the pull-request link is a plain GitHub URL, and bails out when too long', () => {
  const r = rubbed({ crumble: 1, crisp: 0, cobbler: 0 });
  const rec = buildBakeRecord(r, outcome, { family: FAMILIES.rubbed });
  const url = pullRequestUrl(rec);
  assert.ok(url.startsWith('https://github.com/'), url.slice(0, 40));
  assert.ok(url.includes('filename=data%2Fbakes%2F'));

  // A silently truncated record would be worse than none, so past the limit it
  // returns null and the UI falls back to a download.
  const huge = buildBakeRecord(r, { ...outcome, review: 'x'.repeat(9000) }, { family: FAMILIES.rubbed });
  assert.equal(pullRequestUrl(huge), null);
});
