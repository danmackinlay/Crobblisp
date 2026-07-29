import { blend, clamp01 } from './blend.js';
import { filling } from './filling.js';
import { bakeSchedule, servingNotes } from './bake.js';
import { BERRIES, DISHES, fruitLoad } from './fruit.js';
import { GRAMS_PER_TSP } from './vertices.js';
import { getFamily, DEFAULT_FAMILY } from './families.js';
import {
  DEFAULT_DIET,
  dietScoreModifiers,
  dietLabels,
  dietNotes,
  splitLiquid,
} from './diet.js';
/**
 * The sugar BLEND is held constant within each family; only the AMOUNT varies.
 *
 * It is tempting to shift the vegan path browner to make up for the missing
 * milk solids, and an earlier version of this model did exactly that. It is the
 * wrong lever: brown sugar's molasses carries both moisture and invert sugars,
 * and mixture glass-transition temperature tracks its lowest-Tg components. So
 * a browner blend measurably softens the topping — it buys colour by spending
 * the crunch it was supposed to protect. Milk powder restores the browning
 * without touching Tg. See diet.js.
 *
 * The two families use DIFFERENT blends, and that is sourced rather than
 * stylistic: the rubbed corpus is full of brown sugar and demerara, while every
 * poured source in the survey specifies plain granulated. See families.js.
 */

const TSP = GRAMS_PER_TSP;

function nameFor(coords, family, morph) {
  const ranked = Object.entries(coords).sort((a, b) => b[1] - a[1]);
  const [top, mid, low] = ranked;

  if (top[1] > 0.8) {
    return { name: family.vertices[top[0]].label, kind: 'vertex' };
  }

  const pair = [top[0], mid[0]].sort().join('+');
  if (low[1] < 0.12) {
    const names = {
      // Rubbed
      'crisp+crumble': 'Crimble',
      'cobbler+crisp': 'Crispler',
      'cobbler+crumble': 'Crobble',
      // Poured
      'batter+sonker': 'Sonkler',
      'batter+cake': 'Batter pudding',
      'cake+sonker': 'Sonker pudding',
    };
    return { name: names[pair] ?? family.label, kind: 'edge' };
  }

  return {
    name: family.key === 'poured' ? 'Poured cobbler' : 'Crobblisp',
    kind: 'interior',
    qualifier: morph.label.toLowerCase(),
  };
}

/**
 * Build the complete recipe for a barycentric position.
 *
 * coords  — the family's three keys, any non-negative triple (normalised)
 * family  — 'rubbed' (crumble/crisp/cobbler) or 'poured' (batter/sonker/cake)
 */
export function buildRecipe(
  coords,
  berryKey = 'mixed',
  dishKey = 'square20',
  diet = DEFAULT_DIET,
  familyKey = DEFAULT_FAMILY.key,
) {
  const family = typeof familyKey === 'string' ? getFamily(familyKey) : familyKey;
  const berry = BERRIES[berryKey] ?? BERRIES.mixed;
  const dish = DISHES[dishKey] ?? DISHES.square20;

  const b = blend(coords, diet, family);
  const morph = family.morphology(b);

  // Liquid load the topping must cope with, measured through the fruit's charted
  // thickener demand rather than a guessed water-release fraction.
  const waterLoadNorm = fruitLoad(berry, dish).loadNorm;

  // Both score models are given the same superset and each takes what it needs.
  const q = family.score({
    ingredients: b.ingredients,
    hydration: b.hydration,
    leaveningPower: b.leaveningPower,
    morph,
    physical: b.physical,
    waterLoadNorm,
    dietMods: dietScoreModifiers(diet, b.hydration),
  });

  // Scale the per-100-dry-structure basis to actual grams for this dish.
  const massTarget = family.mass(dish, b.physical, morph);
  const basisTotal = Object.values(b.ingredients).reduce((s, v) => s + v, 0);
  const k = massTarget / basisTotal;

  const g = (field) => (b.ingredients[field] ?? 0) * k;
  const sugarTotal = g('sugar');

  const topping = {
    totalG: massTarget,
    flourG: g('flour'),
    oatsG: g('oats'),
    butterG: g('butter'),
    sugarBrownG: sugarTotal * family.sugarBlend.lightBrown,
    sugarWhiteG: sugarTotal * family.sugarBlend.white,
    sugarTotalG: sugarTotal,
    saltG: g('salt'),
    buttermilkG: g('buttermilk'),
    eggG: g('egg'),
    bakingPowderG: g('bakingPowder'),
    bakingSodaG: g('bakingSoda'),
    xanthanG: (b.additions.xanthan ?? 0) * k,
    soyMilkPowderG: (b.additions.soyMilkPowder ?? 0) * k,
    groundFlaxG: (b.additions.groundFlax ?? 0) * k,
  };

  // Two different masses, and the distinction matters. RAW mass rises toward the
  // wet corners because liquid is heavy; DRY mass (flour + oats + sugar) tells
  // you how much material is actually there. Reporting only one of them misleads
  // in one direction or the other.
  topping.dryMassG = topping.flourG + topping.oatsG + topping.sugarTotalG;

  topping.saltTsp = topping.saltG / TSP.salt;
  topping.bakingPowderTsp = topping.bakingPowderG / TSP.bakingPowder;
  topping.bakingSodaTsp = topping.bakingSodaG / TSP.bakingSoda;
  // A large egg is ~50 g out of the shell.
  topping.eggCount = topping.eggG / 50;

  const fill = filling(berry, dish, morph);
  const bake = bakeSchedule({
    physical: b.physical,
    hydration: b.hydration,
    waterLoadNorm,
    exposureNorm: morph.exposureNorm,
    // In the poured family, pre-baking is a property of the SOURCE RECIPE
    // (blended like oven temperature), not something inferred from hydration.
    // The sonker corner bakes its fruit 30 minutes first; the other two do not.
    prebakeOverride: family.key === 'poured' ? morph.prebake : null,
  });

  // Sour the milk only where there is bicarbonate needing an acid. The rubbed
  // cobbler corner has soda and genuinely needs it; no poured vertex uses soda
  // at all, so souring the milk there would be a ritual with no chemistry behind
  // it — and every poured source specifies plain milk.
  const needsAcid = b.ingredients.bakingSoda > 0.01;
  topping.liquidSplit = splitLiquid(topping.buttermilkG, diet, needsAcid);

  return {
    coords: b.coords,
    family: { key: family.key, label: family.label, short: family.short, blurb: family.blurb },
    diet,
    labels: dietLabels(diet, family),
    substitutions: b.substitutions,
    dietNotes: dietNotes(diet, topping.buttermilkG, needsAcid),
    naming: nameFor(b.coords, family, morph),
    axes: {
      hydration: b.hydration,
      fatBorneWater: b.fatBorneWater,
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
    scoreDomain: family.scoreDomain,
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
export function scoreAt(coords, berry, dish, diet = DEFAULT_DIET, familyKey = DEFAULT_FAMILY.key) {
  const family = typeof familyKey === 'string' ? getFamily(familyKey) : familyKey;
  const b = blend(coords, diet, family);
  const morph = family.morphology(b);
  const waterLoadNorm = fruitLoad(berry, dish).loadNorm;
  return family.score({
    ingredients: b.ingredients,
    hydration: b.hydration,
    leaveningPower: b.leaveningPower,
    morph,
    physical: b.physical,
    waterLoadNorm,
    dietMods: dietScoreModifiers(diet, b.hydration),
  }).overall;
}

export { clamp01 };
