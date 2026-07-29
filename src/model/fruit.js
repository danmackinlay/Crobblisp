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
 *   charted         — FALSE where the thickener figure is placed by analogy with
 *                     the charted berries rather than read off the chart. Apple
 *                     and peach are both flagged, and the flag is not decoration:
 *                     the whole argument for using thickener demand as the
 *                     free-liquid measure is that it is MEASURED, so a figure
 *                     that is not measured does not get to borrow that claim.
 *   sugarRate       — g sugar per g fruit, set by tartness
 *   lemonRate       — g lemon juice per g fruit; the low-acid berries taste flat
 *                     without it, the high-acid ones need none
 *   prep            — the step the stone and pome fruits need and berries do not
 *
 * A NOTE ON WHAT WAS MISSING. This file offered berries only, while the corpus
 * it is calibrated against is mostly APPLE crisps and PEACH cobblers — the two
 * best-rated recipes in the whole survey are an apple crisp and a peach cobbler.
 * Every plotted anchor was therefore a recipe you could not actually select.
 */
export const BERRIES = {
  mixed: {
    key: 'mixed',
    label: 'Mixed berries',
    charted: true,
    waterPct: 87,
    pH: [3.2, 4.0],
    pieThickenerPct: 5.5,
    sugarRate: 0.085,
    lemonRate: 0.006,
    note: 'Averaged across the four below. Behaves closest to blackberry with a softer set.',
  },
  strawberry: {
    key: 'strawberry',
    charted: true,
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
    charted: true,
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
    charted: true,
    label: 'Blackberry',
    waterPct: 88.15,
    pH: [3.85, 4.5],
    pieThickenerPct: 7.0,
    sugarRate: 0.09,
    lemonRate: 0.004,
    note: 'The highest-pectin berry here (0.7-1.2%) and, contrary to reputation, the LEAST acidic — pH 3.85-4.5, mild enough that starch breakdown is a non-issue.',
  },
  apple: {
    key: 'apple',
    label: 'Apple',
    waterPct: 85.56,
    pH: [3.3, 4.0],
    // NOT from the King Arthur chart — see `charted`. Placed at the blueberry
    // end because apples behave the same way for the same reasons: firm flesh
    // that survives the bake largely intact, and the highest pectin of anything
    // here (0.5-1.6% fresh weight). A great many British crumbles thicken their
    // apples with nothing at all, which is the strongest available evidence that
    // the demand is low.
    pieThickenerPct: 3.0,
    charted: false,
    // Cooking apples are sharply tart — Bramleys run near pH 3.0 — and the
    // surveyed apple recipes sweeten the fruit more than any berry recipe does.
    sugarRate: 0.09,
    lemonRate: 0.008,
    prep: 'Peel, core and slice about 8 mm thick — thinner and they collapse, thicker and the centres stay raw.',
    note: 'The fruit most of this corpus is actually about: 16 of the 18 surveyed crisps are apple. Holds its shape better than any berry and needs the least thickening, but releases its liquid late, so an apple crumble that looked dry at 30 minutes can still flood at 45.',
  },

  peach: {
    key: 'peach',
    label: 'Peach',
    waterPct: 88.87,
    pH: [3.3, 4.05],
    // Also not charted. Placed between strawberry and raspberry: peaches are
    // wetter than either and low in pectin, but the flesh holds together through
    // the bake in a way raspberry drupelets do not.
    pieThickenerPct: 5.5,
    charted: false,
    sugarRate: 0.07,
    lemonRate: 0.008,
    prep: 'Blanch 30 seconds and slip the skins, then stone and slice. Skins left on go leathery and roll off in sheets.',
    note: 'The cobbler fruit — the two highest-rated cobblers in the survey are both peach, including the 4.91-star recipe that scores highest of anything the model has been tested against. Very wet and low in pectin, so it wants real thickening despite tasting less juicy than a berry.',
  },

  blueberry: {
    key: 'blueberry',
    charted: true,
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
 * The honest name for what this now is. `BERRIES` stays as an alias because it
 * is threaded through the model, the tests and the record schema, and renaming a
 * key that appears in stored bake records would silently orphan them.
 */
export const FRUITS = BERRIES;
export const FRUIT_KEYS = BERRY_KEYS;

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
