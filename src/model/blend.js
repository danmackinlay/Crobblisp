import {
  VERTEX_KEYS,
  SODA_PER_G_BUTTERMILK,
  SODA_EMPIRICAL_CEILING,
  SODA_TO_POWDER_EQUIV,
} from './vertices.js';
import { applyDiet, DEFAULT_DIET } from './diet.js';
import { DEFAULT_FAMILY } from './families.js';

export { clamp01, clamp } from './blend-util.js';

/**
 * Normalise a barycentric triple so the components are non-negative and sum to 1.
 *
 * Takes the key set explicitly so the same function serves both families. It
 * defaults to the rubbed keys, because most callers have one family in hand and
 * threading the key list through every call site would be noise.
 */
export function normaliseCoords(coords, keys = VERTEX_KEYS) {
  const c = {};
  let total = 0;
  for (const k of keys) {
    const v = Math.max(0, coords[k] ?? 0);
    c[k] = v;
    total += v;
  }
  if (total <= 0) {
    const even = {};
    for (const k of keys) even[k] = 1 / keys.length;
    return even;
  }
  for (const k of keys) c[k] /= total;
  return c;
}

/** Affine blend of any per-vertex numeric field set. */
function blendFields(coords, vertices, keys, pick, fields) {
  const out = {};
  for (const f of fields) {
    let v = 0;
    for (const k of keys) v += coords[k] * pick(vertices[k])[f];
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
 * the conversion fires. On the POURED family no vertex uses soda at all, so
 * neither branch can fire — correctly, rather than by being skipped.
 */
function applyConstraints(ing, acidCapacity, liquidName, hydration) {
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
  //    the leavening just leaves dry alkaline pockets. Fat-borne water counts
  //    here: it is real water, it just arrived inside the block.
  if (hydration < 8 && (out.bakingPowder > 0.05 || out.bakingSoda > 0.02)) {
    out.bakingPowder = 0;
    out.bakingSoda = 0;
    notes.push('Leavening removed — too little water to activate it or trap gas.');
  }

  return { ingredients: out, notes };
}

/**
 * Blend the vertices of a family at a barycentric position and apply the
 * constraint pass. Returns per-100-dry-structure quantities plus the physical
 * axes the rest of the model reads.
 */
export function blend(rawCoords, diet = DEFAULT_DIET, family = DEFAULT_FAMILY) {
  const coords = normaliseCoords(rawCoords, family.keys);

  const blended = blendFields(coords, family.vertices, family.keys, (v) => v.ingredients, family.fields);
  const physical = blendFields(coords, family.vertices, family.keys, (v) => v.physical, family.physicalFields);

  // Substitutions run before the constraint pass, because the vegan swap
  // changes the acid ceiling that pass enforces.
  const swapped = applyDiet(blended, diet, family);

  // HYDRATION counts every source of water — poured liquid, the water inside a
  // vegan block, and (in the poured family) egg. The INGREDIENT field counts
  // only what you pour in. Conflating the two once produced a soy-milk line on a
  // bone-dry crisp.
  const hydration = family.hydration(swapped.ingredients, swapped.fatBorneWater);

  const { ingredients, notes } = applyConstraints(
    swapped.ingredients,
    swapped.acidCapacity,
    diet.vegan ? 'soured soy milk' : family.liquidLabel,
    hydration,
  );

  const oatFraction = ingredients.oats / 100;

  // Combined lift, in soda-equivalents, for the morphology and score models.
  const leaveningPower =
    ingredients.bakingPowder + SODA_TO_POWDER_EQUIV * ingredients.bakingSoda;

  return {
    coords,
    family,
    diet,
    ingredients,
    additions: swapped.additions,
    substitutions: swapped.subs,
    physical,
    hydration,
    fatBorneWater: swapped.fatBorneWater,
    oatFraction,
    leaveningPower,
    constraintNotes: notes,
  };
}
