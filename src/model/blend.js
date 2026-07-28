import {
  VERTICES,
  VERTEX_KEYS,
  INGREDIENT_FIELDS,
  SODA_PER_G_BUTTERMILK,
  SODA_EMPIRICAL_CEILING,
  SODA_TO_POWDER_EQUIV,
} from './vertices.js';
import { applyDiet, DEFAULT_DIET } from './diet.js';

export { clamp01, clamp } from './blend-util.js';
import { clamp01 } from './blend-util.js';

/** Normalise a barycentric triple so the components are non-negative and sum to 1. */
export function normaliseCoords(coords) {
  const c = {
    crumble: Math.max(0, coords.crumble ?? 0),
    crisp: Math.max(0, coords.crisp ?? 0),
    cobbler: Math.max(0, coords.cobbler ?? 0),
  };
  const total = c.crumble + c.crisp + c.cobbler;
  if (total <= 0) return { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 };
  return {
    crumble: c.crumble / total,
    crisp: c.crisp / total,
    cobbler: c.cobbler / total,
  };
}

/** Affine blend of any per-vertex numeric field set. */
function blendFields(coords, pick, fields) {
  const out = {};
  for (const f of fields) {
    let v = 0;
    for (const k of VERTEX_KEYS) v += coords[k] * pick(VERTICES[k])[f];
    out[f] = v;
  }
  return out;
}

/**
 * Chemistry constraints applied after the blend.
 *
 * These do NOT improve the recipe or steer it toward a better score — they only
 * enforce reactions that must hold for the mixture to be chemically coherent.
 * Quality is measured separately and left uncorrected.
 *
 * The acid budget has two thresholds rather than one, because a modest soda
 * excess is a deliberate browning lever (Maillard accelerates under alkaline
 * conditions) and only becomes a defect further up. Between stoichiometry and
 * the browning allowance the model reports what it is doing; past the allowance
 * it converts the surplus to baking powder at its lift equivalent, so total
 * leavening survives even though the soda cannot.
 *
 * On the dairy path the blend sits inside the browning band. On the VEGAN path
 * soured soy milk carries only ~55% of the acid, the allowance is exceeded, and
 * the conversion fires.
 */
function applyConstraints(ing, acidCapacity, liquidName) {
  const notes = [];
  const out = { ...ing };

  // 1. Acid budget, in two tiers — see SODA_EMPIRICAL_CEILING.
  const stoichiometric = out.buttermilk * SODA_PER_G_BUTTERMILK * acidCapacity;
  const ceiling = out.buttermilk * SODA_EMPIRICAL_CEILING * acidCapacity;

  if (out.bakingSoda > ceiling + 1e-9) {
    const surplus = out.bakingSoda - ceiling;
    out.bakingSoda = ceiling;
    out.bakingPowder += surplus * SODA_TO_POWDER_EQUIV;
    notes.push(
      `Soda cut back to what the ${liquidName} can neutralise plus a browning margin — beyond that it decomposes to sodium carbonate and tastes soapy. Its lift is replaced with baking powder, so the total is unchanged.`,
    );
  } else if (out.bakingSoda > stoichiometric + 1e-9) {
    const excess = out.bakingSoda / stoichiometric;
    notes.push(
      `Soda runs ${excess.toFixed(2)}x the stoichiometric match for the ${liquidName}, which is normal: five independent sources converge on this level, including the traditional half-teaspoon-per-cup rule. The small alkaline surplus plausibly aids browning.`,
    );
  }

  // 2. Leavening needs water. Below roughly 8% hydration there is neither
  //    enough water to trigger the reaction nor enough structure to trap gas —
  //    the leavening just leaves dry alkaline pockets.
  const hydration = out.buttermilk;
  if (hydration < 8 && (out.bakingPowder > 0.05 || out.bakingSoda > 0.02)) {
    out.bakingPowder = 0;
    out.bakingSoda = 0;
    notes.push('Leavening removed — too little water to activate it or trap gas.');
  }

  return { ingredients: out, notes };
}

/**
 * Blend the three vertices at a barycentric position and apply the constraint
 * pass. Returns per-100-dry-structure quantities plus the two physical axes the
 * rest of the model reads.
 */
export function blend(rawCoords, diet = DEFAULT_DIET) {
  const coords = normaliseCoords(rawCoords);

  const blended = blendFields(coords, (v) => v.ingredients, INGREDIENT_FIELDS);
  const physical = blendFields(coords, (v) => v.physical, [
    'bakedThicknessMm',
    'rawDensity',
    'ovenExpansion',
    'ovenC',
    'minutes',
    'restMinutes',
  ]);

  // Substitutions run before the constraint pass, because the vegan swap
  // changes the acid ceiling that pass enforces.
  const swapped = applyDiet(blended, diet);
  const { ingredients, notes } = applyConstraints(
    swapped.ingredients,
    swapped.acidCapacity,
    diet.vegan ? 'soured soy milk' : 'buttermilk',
  );

  // The two physical axes the triangle maps onto. Barycentric position is an
  // affine bijection with this pair — which is what makes the interpolation
  // principled rather than a smoothie of three recipes.
  const hydration = ingredients.buttermilk; // liquid per 100 dry structure
  const oatFraction = ingredients.oats / 100;

  // Combined lift, in soda-equivalents, for the morphology and score models.
  const leaveningPower =
    ingredients.bakingPowder + SODA_TO_POWDER_EQUIV * ingredients.bakingSoda;

  return {
    coords,
    diet,
    ingredients,
    additions: swapped.additions,
    substitutions: swapped.subs,
    physical,
    hydration,
    oatFraction,
    leaveningPower,
    constraintNotes: notes,
  };
}
