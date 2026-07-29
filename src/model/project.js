/**
 * Where does a real recipe sit on the triangle?
 *
 * ---------------------------------------------------------------------------
 * THE HONEST FRAMING, WHICH MATTERS MORE THAN THE ARITHMETIC
 *
 * The triangle is a two-dimensional slice through a much larger recipe space.
 * Real recipes are NOT on it. Placing one is a projection, and a projection
 * throws something away.
 *
 * So this returns a RESIDUAL alongside the position, and the residual is not a
 * diagnostic afterthought — it is half the answer. A recipe with a small
 * residual really is the blend the model says it is. A recipe with a large one
 * has been forced onto a plane it does not lie near, and its plotted position is
 * a shadow rather than a location. The UI is required to show the difference,
 * and `MAX_PLOTTABLE_RESIDUAL` below is where a point stops being drawn as a
 * position at all.
 *
 * This is the same discipline the rest of the model already applies to itself.
 * The alternative — plotting everything at its nearest point and letting a
 * viewer assume the triangle spans real practice — would manufacture exactly the
 * kind of false confidence this project has twice had to correct.
 * ---------------------------------------------------------------------------
 *
 * SCALING, AND WHY IT IS GLOBAL RATHER THAN PER-FAMILY.
 *
 * Fields are already per 100 units of dry structure, but that does not make them
 * comparable: sugar ranges 30-165 across the whole space while leavening ranges
 * 0-6.45, and equal weighting would let sugar decide everything and ignore the
 * chemistry. Each field is therefore weighted by 1 / (its range).
 *
 * That range is taken over BOTH families' vertices, not each family's own. The
 * first version scaled per-family and it was wrong in a way that took two
 * misplaced recipes to notice:
 *
 *   - Residuals from different families were being COMPARED, to decide which
 *     triangle a recipe belongs to. Per-family scaling made them different
 *     units, so the comparison was meaningless. One surveyed cobbler came out at
 *     rubbed 0.361 vs poured 0.359 — a coin flip between two numbers that were
 *     never on the same scale.
 *   - A field with no spread inside one family (egg is zero at every rubbed
 *     vertex) fell back to an arbitrary floor, so a cobbler containing egg
 *     scored a residual of 8.51. The direction was right — the egg-free vertices
 *     genuinely cannot represent it — but the magnitude was an artefact of the
 *     floor rather than a measurement.
 *
 * Global scaling fixes both. A zero-spread field now costs what it should: an
 * egg at 42 parts against a full-space range of 83 is half a range off, which is
 * a real distance and a legible one.
 */

/** Fields that discriminate between dishes. Salt is excluded — it is noise here. */
const FIT_FIELDS = ['oats', 'butter', 'sugar', 'buttermilk', 'egg', 'leavening'];

/**
 * Reference ranges, over the vertices of EVERY family. Computed rather than
 * written down, so adding a family or revising a vertex cannot leave them stale.
 */
let SCALES = null;

export function referenceScales(families) {
  const scale = {};
  for (const f of FIT_FIELDS) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const family of families) {
      for (const k of family.keys) {
        const v = vectorOf(family.vertices[k].ingredients)[f];
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    // A floor only guards against a field that is constant across the ENTIRE
    // space, which would otherwise divide by zero. No real field hits it.
    scale[f] = Math.max(hi - lo, 1e-6);
  }
  return scale;
}

/** Set once at startup by families.js, so project() needs no import cycle. */
export function setReferenceScales(scales) {
  SCALES = scales;
}

/**
 * TWO numbers, not one, because the root-mean-square hides the case that matters.
 *
 * RMS averages over six fields, so a recipe that is badly wrong on ONE decisive
 * field but fine on the other five reports a comfortable residual. The rolled
 * sonker is exactly that recipe: 14.5 parts fat against a rubbed-family floor of
 * 45 — the single property that makes it rollable, and the documented reason it
 * is out of reach — came out looking on-plane once the other five fields fitted.
 *
 * So the worst SINGLE-field deviation is reported alongside, and both have to
 * pass. Distance in the average and distance in the worst direction are
 * different questions and the second one is what "can this triangle make this
 * recipe" actually asks.
 */
export const MAX_PLOTTABLE_RESIDUAL = 0.5;
export const MAX_PLOTTABLE_FIELD = 0.42;

/** Comfortably on-plane: the triangle really does describe this recipe. */
export const GOOD_RESIDUAL = 0.18;
export const GOOD_FIELD = 0.3;

/** Both tests, in one place, so the UI and the build script cannot disagree. */
export function placement({ residual, worst }) {
  const d = worst?.delta ?? 0;
  return {
    plottable: residual <= MAX_PLOTTABLE_RESIDUAL && d <= MAX_PLOTTABLE_FIELD,
    onPlane: residual <= GOOD_RESIDUAL && d <= GOOD_FIELD,
  };
}

function vectorOf(ing) {
  return {
    oats: ing.oats ?? 0,
    butter: ing.butter ?? 0,
    sugar: ing.sugar ?? 0,
    buttermilk: ing.buttermilk ?? 0,
    egg: ing.egg ?? 0,
    leavening: (ing.bakingPowder ?? 0) + 3.5 * (ing.bakingSoda ?? 0),
  };
}

/** The vertex matrix for a family, in scaled units. */
export function fitBasis(family, scale = SCALES) {
  if (!scale) throw new Error('reference scales not set — call setReferenceScales() first');
  return { cols: family.keys.map((k) => vectorOf(family.vertices[k].ingredients)), scale, keys: family.keys };
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/**
 * Project an ingredient vector onto the family's simplex.
 *
 * Exact rather than searched. The three barycentric coordinates have two degrees
 * of freedom, so the unconstrained fit is a 2x2 normal-equation solve; if that
 * lands outside the simplex the answer is on the boundary, and with only three
 * edges the boundary can be enumerated. No optimiser, no iteration limit,
 * nothing that can quietly fail to converge.
 */
export function projectOntoFamily(ingredients, family, scales = SCALES) {
  const { cols, scale } = fitBasis(family, scales);
  const x = vectorOf(ingredients);

  const w = (v) => FIT_FIELDS.map((f) => v[f] / scale[f]);
  const P = cols.map(w);
  const t = w(x);

  const deviations = (bary) =>
    FIT_FIELDS.map((f, i) => ({
      field: f,
      delta: bary[0] * P[0][i] + bary[1] * P[1][i] + bary[2] * P[2][i] - t[i],
    }));

  const residualOf = (bary) =>
    Math.sqrt(deviations(bary).reduce((s, d) => s + d.delta ** 2, 0) / FIT_FIELDS.length);

  // Unconstrained fit in the plane, parametrised from the first vertex.
  const d1 = P[1].map((v, i) => v - P[0][i]);
  const d2 = P[2].map((v, i) => v - P[0][i]);
  const b = t.map((v, i) => v - P[0][i]);

  const a11 = dot(d1, d1);
  const a12 = dot(d1, d2);
  const a22 = dot(d2, d2);
  const det = a11 * a22 - a12 * a12;

  let best = null;
  if (Math.abs(det) > 1e-12) {
    const b1 = dot(d1, b);
    const b2 = dot(d2, b);
    const u = (a22 * b1 - a12 * b2) / det;
    const v = (a11 * b2 - a12 * b1) / det;
    const cand = [1 - u - v, u, v];
    if (cand.every((c) => c >= -1e-9)) {
      best = cand.map((c) => Math.max(0, c));
    }
  }

  if (!best) {
    // Outside the simplex, so the answer is on the boundary. Three edges and
    // three corners, all closed-form.
    const candidates = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (const [i, j] of [[0, 1], [1, 2], [0, 2]]) {
      const dEdge = P[j].map((v, k) => v - P[i][k]);
      const bEdge = t.map((v, k) => v - P[i][k]);
      const denom = dot(dEdge, dEdge);
      if (denom < 1e-12) continue;
      const s = Math.min(1, Math.max(0, dot(dEdge, bEdge) / denom));
      const bary = [0, 0, 0];
      bary[i] = 1 - s;
      bary[j] = s;
      candidates.push(bary);
    }
    best = candidates.reduce((lo, c) => (residualOf(c) < residualOf(lo) ? c : lo));
  }

  const coords = {};
  family.keys.forEach((k, i) => { coords[k] = best[i]; });

  // The worst single field, and its SIGN — "this recipe has far less fat than
  // any blend here can produce" is a different fact from "far more", and the
  // sign is what makes the number diagnostic rather than merely large.
  //
  // delta = fitted - actual, so a POSITIVE delta means the recipe sits BELOW
  // what the triangle can offer. Stated from the recipe's point of view, since
  // that is the direction a reader cares about.
  const worst = deviations(best)
    .map((d) => ({ field: d.field, delta: Math.abs(d.delta), direction: d.delta > 0 ? 'below' : 'above' }))
    .reduce((a, b) => (b.delta > a.delta ? b : a));

  const residual = residualOf(best);
  return { coords, residual, worst, ...placement({ residual, worst }) };
}

/**
 * Project against BOTH families and keep the better fit.
 *
 * A surveyed recipe does not announce which triangle it belongs to, and the
 * corpus label is not always the answer — sonker records split across rolled and
 * poured forms, and the corpus files them all under one heading. Letting the fit
 * decide, and reporting both residuals, is what makes it possible to notice that
 * a recipe filed as a cobbler is really a batter.
 */
export function bestFamilyFit(ingredients, families) {
  const fits = families.map((family) => ({
    family: family.key,
    ...projectOntoFamily(ingredients, family),
  }));
  fits.sort((a, b) => a.residual - b.residual);
  return { best: fits[0], all: fits };
}
