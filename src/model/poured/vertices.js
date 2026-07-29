/**
 * The POURED family: batter cobbler, sonker, pudding cake.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SECOND TRIANGLE RATHER THAN MORE OF THE FIRST ONE
 *
 * The rubbed triangle (crumble / crisp / cobbler) cannot reach these dishes, and
 * the reason is in the survey rather than in a design preference.
 *
 *  1. THERE IS A GAP IN THE DATA. Surveyed cobbler liquid splits into a DOUGH
 *     cluster at 41-72 parts per 100 flour and a BATTER cluster at 94-176, with
 *     nothing in between. That gap is not sampling noise: a mixture at 80-90 is
 *     too slack to drop as a mound and too stiff to pour level, so it cannot be
 *     assembled by either technique. Interpolating a continuous simplex across
 *     it would generate recipes at hydrations where no cook can execute either
 *     method. See vertices.js on the cobbler vertex, which stops deliberately
 *     just above the dough cluster for exactly this reason.
 *
 *  2. FAT STATE IS DISCRETE. Every vertex in the rubbed family uses COLD fat cut
 *     or rubbed in — 15 of 15 sweet biscuit cobbler toppings that contain butter
 *     at all. Every dish here uses MELTED or softened fat. There is no halfway
 *     house between rubbing cold butter into flour and pouring melted butter
 *     into a pan; a model that interpolated between them would be inventing a
 *     technique nobody uses.
 *
 *  3. THE ASSEMBLY INVERTS. A rubbed topping goes ON the fruit and stays there.
 *     Two of the three dishes here put the BATTER DOWN FIRST and the fruit on
 *     top, and rely on the batter rising through during the bake. "Where is the
 *     topping relative to the fruit" is a different question from "how wet is
 *     the topping", and the rubbed family's morphology model — which is entirely
 *     about how much of a topping stands clear of the fruit — has no way to
 *     express it.
 *
 * So: same fruit, same dishes, same diet switches, a different technique family.
 * ---------------------------------------------------------------------------
 *
 * BASIS. Flour = 100, as in the rubbed family (no poured recipe in the survey
 * contains oats, so flour + oats = 100 reduces to flour = 100 and the two
 * families' percentages are directly comparable).
 *
 * EGG is a field here and is fixed at zero in the rubbed family. The rubbed
 * vertices exclude it deliberately — a third protein network that only matters
 * at the wet end — but a pudding cake is defined by it.
 *
 * SAMPLE SIZES ARE SMALL AND THAT IS STATED RATHER THAN SMOOTHED. The rubbed
 * vertices rest on 13-18 sources each. These rest on two, one and one. Each
 * vertex below names its n. Treat the poured surface as a sketch of a real
 * region, not as the same grade of evidence as the rubbed one.
 */

/** Ingredient fields for this family. Egg is the addition. */
export const POURED_FIELDS = [
  'flour',
  'oats',
  'butter',
  'sugar',
  'salt',
  'buttermilk',
  'egg',
  'bakingPowder',
  'bakingSoda',
];

/**
 * Sweetened condensed milk, decomposed.
 *
 * ATK's blueberry cobbler puts a 14 oz can into the batter, and the raw survey
 * record counts the whole 397 g as LIQUID while counting none of it as sugar —
 * which is why that row reads 304 parts liquid and 29 parts sugar, both wildly
 * out of line with every other batter. The record's own flag says as much
 * ("sugar is understated here: the condensed milk carries roughly 218 g more").
 * Splitting it fixes both numbers at once and brings ATK into agreement with the
 * folk Magic Cobbler to within a few percent.
 */
export const CONDENSED_MILK = { sugar: 0.54, water: 0.27, fat: 0.08 };

/**
 * Physical properties. Note these differ in KIND from the rubbed family's.
 *
 * The rubbed family derives topping mass from target thickness x raw density /
 * oven expansion, and calibrates that chain to hit a measured load per cm². It
 * has to, because coverage varies from 95% (scattered crumb) to 41% (separated
 * mounds) and mass therefore cannot be read off the dish area alone.
 *
 * A poured batter covers 100% of the dish by definition. So load per cm² is
 * measured DIRECTLY from the sources here rather than reconstructed, which is
 * one fewer inferential step than the rubbed side manages.
 *
 *   loadGPerCm2  — raw batter mass per cm² of dish (measured)
 *   ovenExpansion— baked volume / raw volume, for the finished-height estimate
 *   prebakeFruit — 1 if the source bakes the fruit before the batter goes on
 */
export const POURED_VERTICES = {
  batter: {
    key: 'batter',
    label: 'Batter cobbler',
    short: 'Batter',
    blurb:
      'Melted butter in the dish, batter poured over unstirred, fruit scattered on top. The layers change places in the oven.',
    // n = 2. America's Test Kitchen's Easy Blueberry Cobbler (T1) and the folk
    // "Magic Cobbler" (T3). They agree closely once the condensed milk in the
    // ATK version is decomposed: fat 85 vs 90, sugar 155 vs 160, liquid 134 vs
    // 144. A tier-1 test kitchen and an uncredited folk formula landing within
    // 6% of each other on all three is the strongest corroboration available in
    // this corpus, and it is worth more than either source alone.
    ingredients: {
      flour: 100,
      butter: 88,
      // The defining number of this family, and the one that most separates it
      // from the rubbed side: 158 against a biscuit-cobbler median of 30. This
      // is not a sweeter version of the same dish. At this level sugar is a
      // structural phase — it is most of what sets the crisp lid on top.
      sugar: 158,
      oats: 0,
      // Both sources use self-rising flour, which carries roughly 1.5 tsp baking
      // powder and 0.5 tsp salt per cup. Unpacked here so the leavening and salt
      // are visible rather than hidden inside an ingredient name.
      salt: 2.4,
      buttermilk: 139,
      egg: 0,
      bakingPowder: 4.8,
      bakingSoda: 0,
    },
    physical: {
      loadGPerCm2: 1.12, // ATK, 13x9
      ovenExpansion: 1.8,
      ovenC: 177, // both sources
      minutes: 35,
      restMinutes: 10,
      prebakeFruit: 0,
    },
  },

  sonker: {
    key: 'sonker',
    label: 'Sonker',
    short: 'Sonker',
    blurb:
      'Deep-dish Appalachian. Fruit baked first, thin batter poured over, served with a milk dip. Stays flat on purpose.',
    // n = 1 for the batter itself: Spiral Bound Foodie's Vintage Appalachian
    // Sonker (T1). The dish geometry and the milk dip draw on the two ROLLED
    // sonkers in the corpus (Rockford General Store, Pastry Chef Online), which
    // are the same dish by a different technique.
    //
    // WHY SONKER IS HERE RATHER THAN IN THE RUBBED TRIANGLE, given that two of
    // its three surveyed forms are rolled pastry: the rolled ones are out of
    // reach on the OTHER side too. Rockford's runs 14.5 parts fat per 100 flour
    // against a rubbed-family floor of 45, so no point in that triangle can
    // produce it either. Sonker is genuinely bimodal, and this family captures
    // the poured half. The rolled half is a documented gap in both — see
    // SOURCES.md.
    ingredients: {
      flour: 100,
      butter: 90,
      // Half the batter cobbler's sugar. This corner is the savoury-leaning end
      // of a very sweet family, which is what the dip is for — the sweetness is
      // served alongside rather than baked in.
      sugar: 80,
      oats: 0,
      salt: 2.3,
      buttermilk: 96,
      egg: 0,
      bakingPowder: 4.8,
      bakingSoda: 0,
    },
    physical: {
      // The heaviest load in the whole survey, rubbed family included. A sonker
      // is a deep dish, and this is what makes it one.
      loadGPerCm2: 1.38,
      // "It doesn't rise much, it's designed to stay flat" — the source says so
      // outright, and it is the reason this corner reads as a pancake lid rather
      // than a cake.
      ovenExpansion: 1.25,
      ovenC: 177,
      minutes: 38,
      restMinutes: 10,
      // The fruit is baked 30 minutes BEFORE the batter goes on. This is a
      // recipe property, blended like oven temperature, not something the model
      // infers from composition.
      prebakeFruit: 1,
    },
  },

  cake: {
    key: 'cake',
    label: 'Pudding cake',
    short: 'Pudding cake',
    blurb:
      'Egg batter in the dish, fruit laid on top. Rises up and over as it bakes, closing around the fruit.',
    // n = 1. King Arthur Baking's Fresh Fruit Cobbler (T1). The corpus record
    // calls it "a self-inverting cake, not a cobbler in the drop-biscuit sense",
    // and notes it is "the closest thing in the corpus to a fruit-dispersion
    // mechanism" — the batter is meant to rise up and over the fruit by
    // buoyancy rather than by being mixed through.
    ingredients: {
      flour: 100,
      // The lean corner. 23 against 88-90 at the other two, which is what makes
      // this a cake rather than a butter-fried lid: structure comes from egg
      // protein instead of from fat and sugar.
      butter: 23,
      sugar: 165,
      oats: 0,
      salt: 2.4,
      // Only 23 parts poured liquid, but two large eggs bring roughly 62 more
      // parts of water with them. Effective hydration is ~85, not 23 — see
      // hydrationOf() below, which is why that function exists.
      buttermilk: 23,
      egg: 83,
      bakingPowder: 3.3,
      bakingSoda: 0,
    },
    physical: {
      loadGPerCm2: 0.91,
      ovenExpansion: 1.6,
      ovenC: 190,
      minutes: 30,
      restMinutes: 10,
      prebakeFruit: 0,
    },
  },
};

/**
 * Order is [LEFT, TOP, RIGHT] as the chart draws the triangle, matching the
 * rubbed family's convention. Left to right runs up the sugar-and-liquid axis:
 * sonker at 80 parts sugar, batter cobbler at 158. The pudding cake goes on top
 * because it is the odd one out on both — lean in fat, and the only corner whose
 * water arrives as egg.
 */
export const POURED_KEYS = ['sonker', 'cake', 'batter'];

/** Whole egg is ~75% water (USDA). Egg is both a liquid and a structure former. */
export const EGG_WATER = 0.75;

/**
 * Total water per 100 flour.
 *
 * The rubbed family can treat its liquid field AS hydration because buttermilk
 * is the only thing carrying water. Here egg carries a large share of it — at
 * the pudding-cake corner, most of it — so reading the liquid field alone would
 * call that corner three times drier than it is and put it in the wrong regime.
 */
export function hydrationOf(ing) {
  return ing.buttermilk + ing.egg * EGG_WATER;
}

/**
 * Flax egg, for the vegan path. One large egg (50 g) is conventionally replaced
 * by 1 tbsp ground flaxseed (7 g) plus 3 tbsp water (45 g); normalised to the
 * egg mass it replaces, that is 13.5% seed and 86.5% water.
 *
 * It binds and it holds water. It does NOT coagulate — there is no protein
 * network setting at 65-70 °C — so the pudding-cake corner loses real structure
 * on the vegan path and the score is told about it rather than left to imply
 * everything is fine.
 */
export const FLAX_EGG = { seed: 0.135, water: 0.865 };
