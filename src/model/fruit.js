/**
 * Berry data.
 *
 * An earlier version of this file had a per-fruit "release factor" — the
 * fraction of a berry's water freed during a bake. That parameter has been
 * removed, because it is not a documented food-science concept and, worse, it is
 * not well posed: it conflates two independent processes.
 *
 *   1. Cell rupture — how much water the fruit liberates. A fruit property.
 *   2. Evaporative loss — how much water leaves the dish. A property of the
 *      DISH GEOMETRY and the topping above it, not of the fruit at all.
 *
 * In an open crumble those run in opposite directions and the second may
 * dominate, so a single per-fruit coefficient silently absorbs the dish geometry
 * and misleads. The model now keeps them separate: this file carries the fruit
 * term, and the topping's dry-heat exposure carries the evaporation term.
 *
 * For the fruit term the model uses King Arthur Baking's per-fruit thickener
 * chart, converted to a percentage of fruit weight. That is the best available
 * empirical measure of free-liquid load, and it has the advantage of already
 * folding in native pectin — a high-pectin fruit needs less added starch, so its
 * charted dosage is lower without needing a separate pectin term.
 *
 * Note this reorders things against naive intuition: raspberry demands MORE
 * thickener than strawberry despite holding less water, because its drupelets
 * collapse immediately while strawberry flesh holds together longer. That is a
 * feature of using measured dosages rather than water content.
 *
 *   waterPct        — g water per 100 g fruit (USDA FoodData Central)
 *   pH              — FDA approximate-pH tables; per fruit, not a constant
 *   pieThickenerPct — quick tapioca as % of fruit weight, for a DOUBLE-CRUST
 *                     pie (King Arthur). Scaled down for open toppings.
 *   sugarRate       — g sugar per g fruit, set by tartness
 *   lemonRate       — g lemon juice per g fruit; the low-acid berries taste flat
 *                     without it, the high-acid ones need none
 */
export const BERRIES = {
  mixed: {
    key: 'mixed',
    label: 'Mixed berries',
    waterPct: 87,
    pH: [3.2, 4.0],
    pieThickenerPct: 5.5,
    sugarRate: 0.085,
    lemonRate: 0.006,
    note: 'Averaged across the four below. Behaves closest to blackberry with a softer set.',
  },
  strawberry: {
    key: 'strawberry',
    label: 'Strawberry',
    waterPct: 90.95,
    pH: [3.0, 3.9],
    pieThickenerPct: 5.2,
    sugarRate: 0.06,
    lemonRate: 0.01,
    note: 'The wettest berry (91% water) and the lowest in pectin (~0.26%), but the flesh holds together longer than raspberry so it frees its liquid more slowly.',
  },
  raspberry: {
    key: 'raspberry',
    label: 'Raspberry',
    waterPct: 85.75,
    pH: [3.22, 3.95],
    pieThickenerPct: 7.0,
    sugarRate: 0.1,
    lemonRate: 0.002,
    note: 'Needs the most thickener of any berry despite holding the least water — the drupelets collapse the moment they are heated. Decent pectin (~0.4%) and high acid.',
  },
  blackberry: {
    key: 'blackberry',
    label: 'Blackberry',
    waterPct: 88.15,
    pH: [3.85, 4.5],
    pieThickenerPct: 7.0,
    sugarRate: 0.09,
    lemonRate: 0.004,
    note: 'The highest-pectin berry here (0.7-1.2%) and, contrary to reputation, the LEAST acidic — pH 3.85-4.5, mild enough that starch breakdown is a non-issue.',
  },
  blueberry: {
    key: 'blueberry',
    label: 'Blueberry',
    waterPct: 84.21,
    pH: [3.11, 3.33],
    pieThickenerPct: 3.0,
    sugarRate: 0.07,
    lemonRate: 0.012,
    note: 'Needs less than half the thickener of raspberry. A thick elastic skin and firm flesh mean many berries come through the bake unruptured. The most forgiving berry here, and the most acidic. Its pectin is ~0.4% of fresh weight — low-to-moderate, alongside raspberry; King Arthur calls it "high pectin" and that is not supported by analytical sources.',
  },
};

export const BERRY_KEYS = Object.keys(BERRIES);

/**
 * Dishes. Area drives topping quantity; berry mass gives roughly a 25-30 mm bed.
 */
export const DISHES = {
  square20: {
    key: 'square20',
    label: '20 cm square (8 in)',
    areaCm2: 400,
    berryMassG: 700,
    serves: 6,
  },
  rect23x33: {
    key: 'rect23x33',
    label: '23 × 33 cm (9 × 13 in)',
    areaCm2: 759,
    berryMassG: 1330,
    serves: 12,
  },
  round24: {
    key: 'round24',
    label: '24 cm round (2 qt)',
    areaCm2: 452,
    berryMassG: 800,
    serves: 6,
  },
};

export const DISH_KEYS = Object.keys(DISHES);

/**
 * Reference liquid load, in grams of starch-equivalent demand per cm² of dish.
 * 700 g of mixed berries in a 20 cm square sits at 0.096; the divisor sets that
 * near the middle of the 0-1 range the score model expects.
 */
const REFERENCE_LOAD = 0.14;

/**
 * Free-liquid load the topping has to cope with, expressed through the measured
 * thickener demand rather than through a guessed release fraction.
 */
export function fruitLoad(berry, dish) {
  const starchDemandG = dish.berryMassG * (berry.pieThickenerPct / 100);
  const perCm2 = starchDemandG / dish.areaCm2;
  return {
    starchDemandG,
    perCm2,
    loadNorm: Math.min(1, perCm2 / REFERENCE_LOAD),
    // Kept for display only, and explicitly an estimate: cold maceration frees
    // roughly 15-30% of a berry's mass as juice. This figure is inference from
    // kitchen practice, not literature, and nothing in the model depends on it.
    estimatedJuiceG: dish.berryMassG * 0.22,
  };
}
