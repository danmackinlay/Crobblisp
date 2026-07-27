import { blend, clamp01 } from './blend.js';
import { morphology } from './morphology.js';
import { score } from './score.js';
import { filling } from './filling.js';
import { bakeSchedule, servingNotes } from './bake.js';
import { BERRIES, DISHES, fruitLoad } from './fruit.js';
import { SUGAR_BLEND } from './vertices.js';
import {
  DEFAULT_DIET,
  dietScoreModifiers,
  dietLabels,
  dietNotes,
  splitLiquid,
} from './diet.js';
/**
 * The sugar blend is held CONSTANT across every point and every diet.
 *
 * It is tempting to shift the vegan path browner to make up for the missing
 * milk solids, and an earlier version of this model did exactly that. It is the
 * wrong lever: brown sugar's molasses carries both moisture and invert sugars,
 * and mixture glass-transition temperature tracks its lowest-Tg components. So
 * a browner blend measurably softens the topping — it buys colour by spending
 * the crunch it was supposed to protect. Milk powder restores the browning
 * without touching Tg. See diet.js.
 */

/** Grams per level teaspoon (USDA). Powder and soda differ — 4.0 vs 4.6. */
const TSP = { salt: 5.7, bakingPowder: 4.0, bakingSoda: 4.6 };

/**
 * Total topping mass, derived rather than fixed.
 *
 * What is held constant across the triangle is the DISH and the COVERAGE of it,
 * not the mass of topping. A dropped biscuit topping is genuinely taller than a
 * rubbed crumb one and roughly doubles in the oven, so matching mass would put
 * far too much on at the cobbler corner. The chain is:
 *
 *   baked volume = area x coverage x target thickness
 *   raw volume   = baked volume / oven expansion
 *   raw mass     = raw volume x raw density
 *
 * Coverage comes from the morphology model, so the technique feeds back into
 * the quantity. The fruit-to-topping ratio by mass therefore drops toward the
 * cobbler corner. That is physics, not an error, and it is surfaced in the UI.
 */
function toppingMass(dish, physical, morph) {
  const bakedVolumeCm3 = dish.areaCm2 * morph.coverage * (physical.bakedThicknessMm / 10);
  const rawVolumeCm3 = bakedVolumeCm3 / physical.ovenExpansion;
  return rawVolumeCm3 * physical.rawDensity;
}

function nameFor(coords, morph) {
  const ranked = Object.entries(coords).sort((a, b) => b[1] - a[1]);
  const [top, mid, low] = ranked;

  if (top[1] > 0.8) {
    return { name: { crumble: 'Crumble', crisp: 'Crisp', cobbler: 'Cobbler' }[top[0]], kind: 'vertex' };
  }

  const pair = [top[0], mid[0]].sort().join('+');
  if (low[1] < 0.12) {
    const names = {
      'crisp+crumble': 'Crimble',
      'cobbler+crisp': 'Crispler',
      'cobbler+crumble': 'Crobble',
    };
    return { name: names[pair], kind: 'edge' };
  }

  return { name: 'Crobblisp', kind: 'interior', qualifier: morph.label.toLowerCase() };
}

/**
 * Build the complete recipe for a barycentric position.
 *
 * coords  — { crumble, crisp, cobbler }, any non-negative triple (normalised)
 * berryKey / dishKey — see fruit.js
 */
export function buildRecipe(
  coords,
  berryKey = 'mixed',
  dishKey = 'square20',
  diet = DEFAULT_DIET,
) {
  const berry = BERRIES[berryKey] ?? BERRIES.mixed;
  const dish = DISHES[dishKey] ?? DISHES.square20;

  const b = blend(coords, diet);
  const morph = morphology(b.hydration);

  // Liquid load the topping must cope with, measured through the fruit's charted
  // thickener demand rather than a guessed water-release fraction.
  const waterLoadNorm = fruitLoad(berry, dish).loadNorm;

  const q = score({
    ingredients: b.ingredients,
    hydration: b.hydration,
    leaveningPower: b.leaveningPower,
    morph,
    waterLoadNorm,
    dietMods: dietScoreModifiers(diet, b.hydration),
  });

  // Scale the per-100-dry-structure basis to actual grams for this dish.
  const massTarget = toppingMass(dish, b.physical, morph);
  const basisTotal = Object.values(b.ingredients).reduce((s, v) => s + v, 0);
  const k = massTarget / basisTotal;

  const g = (field) => b.ingredients[field] * k;
  const sugarTotal = g('sugar');

  const topping = {
    totalG: massTarget,
    flourG: g('flour'),
    oatsG: g('oats'),
    butterG: g('butter'),
    sugarBrownG: sugarTotal * SUGAR_BLEND.lightBrown,
    sugarWhiteG: sugarTotal * SUGAR_BLEND.white,
    sugarTotalG: sugarTotal,
    saltG: g('salt'),
    buttermilkG: g('buttermilk'),
    bakingPowderG: g('bakingPowder'),
    bakingSodaG: g('bakingSoda'),
    xanthanG: (b.additions.xanthan ?? 0) * k,
    soyMilkPowderG: (b.additions.soyMilkPowder ?? 0) * k,
  };

  // Two different masses, and the distinction matters. RAW mass rises toward the
  // cobbler corner because buttermilk is heavy; DRY mass (flour + oats + sugar)
  // falls, because a leavened topping expands to cover the dish with less
  // material. Reporting only one of them misleads in one direction or the other.
  topping.dryMassG = topping.flourG + topping.oatsG + topping.sugarTotalG;

  topping.saltTsp = topping.saltG / TSP.salt;
  topping.bakingPowderTsp = topping.bakingPowderG / TSP.bakingPowder;
  topping.bakingSodaTsp = topping.bakingSodaG / TSP.bakingSoda;

  const fill = filling(berry, dish, morph);
  const bake = bakeSchedule({
    physical: b.physical,
    hydration: b.hydration,
    waterLoadNorm,
    exposureNorm: morph.exposureNorm,
  });

  topping.liquidSplit = splitLiquid(topping.buttermilkG, diet);

  return {
    coords: b.coords,
    diet,
    labels: dietLabels(diet),
    substitutions: b.substitutions,
    dietNotes: dietNotes(diet),
    naming: nameFor(b.coords, morph),
    axes: {
      hydration: b.hydration,
      oatFraction: b.oatFraction,
      leaveningPower: b.leaveningPower,
    },
    basis: b.ingredients,
    physical: b.physical,
    constraintNotes: b.constraintNotes,
    morphology: morph,
    topping,
    filling: fill,
    bake,
    serving: servingNotes(berry, bake),
    score: q,
    context: {
      berry,
      dish,
      waterLoadNorm,
      toppingToFruitRatio: massTarget / dish.berryMassG,
      dryToFruitRatio: topping.dryMassG / dish.berryMassG,
    },
  };
}

/**
 * Score only — the hot path for rendering the heatmap, which evaluates this
 * tens of thousands of times. Skips gram scaling and prose.
 */
export function scoreAt(coords, berry, dish, diet = DEFAULT_DIET) {
  const b = blend(coords, diet);
  const morph = morphology(b.hydration);
  const waterLoadNorm = fruitLoad(berry, dish).loadNorm;
  return score({
    ingredients: b.ingredients,
    hydration: b.hydration,
    leaveningPower: b.leaveningPower,
    morph,
    waterLoadNorm,
    dietMods: dietScoreModifiers(diet, b.hydration),
  }).overall;
}
