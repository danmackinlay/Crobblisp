/**
 * The three vertex recipes, in a shared ingredient basis.
 *
 * BASIS: flour + oats = 100. Oats substitute for flour as the dry structural
 * component, so normalising on their sum (rather than flour alone) keeps the
 * crisp vertex's numbers on the same scale as the other two.
 *
 * PROVENANCE. The quantities below are the medians of surveyed, well-reviewed
 * recipes, not invented ratios — an earlier version of this file was eyeballed
 * and ran systematically low on fat and sugar at all three corners. Where the
 * surveyed spread is tight the median is used directly; where it is wide, the
 * chosen figure and the reason for departing from the median are stated on the
 * vertex itself. Sample sizes: 13 British crumbles, 16 American crisps, 16 sweet
 * cobbler toppings plus three textbook formulas from Gisslen.
 *
 * Four choices were made for HARMONY between the vertices rather than for the
 * quality of any single corner in isolation:
 *
 *  1. Cold butter at all three vertices. This was chosen for technique
 *     continuity — rubbed crumble, cut-in pastry and cut-in biscuit are the same
 *     hand motion — and the survey turned out to support it far more strongly
 *     than the argument deserved: 14 of 20 British crumbles are cold rubbed-in
 *     (the sole melted example is American), and among sweet cobbler toppings
 *     that contain butter at all it is 15 out of 15. Not one sweet biscuit
 *     cobbler topping in the survey uses melted butter. Melted butter turns out
 *     to be the marker of a different food — the poured-batter cobbler — or of
 *     ATK's savoury drop-biscuit shortcut, which trades flakiness for speed.
 *  2. Buttermilk is the only liquid, never cream. Cream is ~36% fat, so it
 *     would move hydration and fat together; buttermilk (~1% fat) keeps those
 *     two axes orthogonal, and brings the acid that lets soda work.
 *  3. No egg anywhere. Keeps the system to two structure formers (gluten, oats)
 *     plus sugar-glass. Egg is a third protein network that only matters in the
 *     wet half of the triangle — asymmetric and harder to predict.
 *  4. One identical sugar blend everywhere (60/40 light brown / white); only
 *     the AMOUNT varies. Otherwise a molasses ramp confounds both the acid
 *     budget and the hygroscopic softening.
 *
 * CONSEQUENCE OF THE BASIS: every ingredient is monotone along every edge, and
 * no ingredient appears at only one vertex. Because affine interpolation over a
 * simplex puts each field's extremes at the corners by construction, nothing
 * can spike in the interior — any weirdness in the middle is emergent from
 * interactions, never from an ingredient behaving unexpectedly.
 */

/** Ingredient fields, all per 100 units of dry structure (flour + oats). */
export const INGREDIENT_FIELDS = [
  'flour',
  'oats',
  'butter',
  'sugar',
  'salt',
  'buttermilk',
  'bakingPowder',
  'bakingSoda',
];

/**
 * Physical properties used to size the topping to the dish. These are the
 * numbers that make "hold the dish constant" mean something real: a dropped
 * biscuit topping is genuinely taller and denser than a rubbed crumb one, and
 * it expands in the oven where crumble does not.
 *
 *  bakedThicknessMm — target finished height of the topping
 *  rawDensity       — g/cm³ of the raw mixture as it sits in the dish
 *  ovenExpansion    — baked volume / raw volume
 */
export const VERTICES = {
  crumble: {
    key: 'crumble',
    label: 'Crumble',
    blurb: 'Cold butter rubbed into flour and sugar. No liquid, no leavening.',
    ingredients: {
      flour: 100,
      // Median of 13 British sources, and the single most stable figure in the
      // whole survey — 66.7 (i.e. 3:2 flour:butter) held as the median under
      // every subset cut, across a 33-100 range.
      butter: 66.7,
      // Median 57.1. Range 33-80, so this is a genuine middle rather than a
      // consensus; anything in 40-70 is defensible.
      sugar: 57,
      oats: 0,
      // Weakest data in the survey: only 4 of 20 sources quantify salt at all,
      // and 3 of those 4 are American or Ottolenghi. Their median is 1.95, but
      // British sources say "a pinch" or omit it. Set between that and the
      // better-sourced cobbler figure rather than pretending to precision.
      salt: 1.5,
      buttermilk: 0,
      bakingPowder: 0,
      bakingSoda: 0,
    },
    // Calibrated so topping load lands on the surveyed median of 1.008 g of raw
    // topping per cm² of dish (13 British sources, 5 of 7 computable ones
    // clustering 0.95-1.32). Oven 200 °C is the median and the modal value;
    // 37.5 min the median time; 10 min rest (Delia, BBC Good Food).
    physical: {
      bakedThicknessMm: 19.3, rawDensity: 0.55, ovenExpansion: 1.0,
      ovenC: 200, minutes: 38, restMinutes: 10,
    },
  },

  crisp: {
    key: 'crisp',
    label: 'Crisp',
    blurb: 'A crumble with rolled oats standing in for two fifths of the flour.',
    ingredients: {
      // Median oat fraction 40.6%, and the tightest figure in the crisp survey:
      // 12 of 16 sources fall between 33 and 49, none above 59.
      flour: 59,
      oats: 41,
      butter: 70, // median 70.1
      // Median is 86, but the range is 36-141 — a 3.9x spread, the widest of any
      // figure surveyed, and no single source sits near all five medians at
      // once. Sitting at the lower-middle of the real distribution: sweet enough
      // to be an American crisp, short of the cloying end. Raise toward 86 for a
      // more typical one.
      sugar: 75,
      salt: 1.1, // median 1.04 across the 12 sources that specify any
      buttermilk: 0,
      bakingPowder: 0,
      bakingSoda: 0,
    },
    // Load median 0.830 g/cm² across 15 computable American crisps — lighter
    // per unit area than a British crumble. Oven 350 °F is both median and mode
    // (9 of 16 sources sit exactly there); 48 min median; 15 min rest (11 of 16
    // specify one). Notably, nobody bakes a crisp cooler to protect the oats or
    // nuts — that plausible-sounding premise is not what these recipes do.
    physical: {
      bakedThicknessMm: 18.4, rawDensity: 0.5, ovenExpansion: 1.05,
      ovenC: 177, minutes: 48, restMinutes: 15,
    },
  },

  cobbler: {
    key: 'cobbler',
    label: 'Cobbler',
    blurb: 'Buttermilk drop biscuit — cold butter cut in, dropped in mounds.',
    ingredients: {
      flour: 100,
      butter: 45, // median 45.4
      // Dough sugar only. The surveyed distribution is bimodal — a restrained
      // cluster at 20-31 and a dessert-forward one at 40-60 — with an overall
      // median of 30.4. Taking the restrained cluster, because the fruit below
      // is already sweetened.
      sugar: 30,
      oats: 0,
      salt: 1.4, // median 1.4
      // Also bimodal, and this is the important one. Surveyed liquid splits into
      // a DOUGH cluster at 41-72 and a BATTER cluster at 94-176; two sources in
      // the latter literally call theirs "batter". Those are different foods, so
      // the median of 77.2 across both is an artefact of the gap. Sitting just
      // above the dough cluster keeps this vertex a drop biscuit. Pushing past
      // ~95 would turn the cobbler corner into a batter cobbler and change what
      // the whole triangle interpolates between.
      buttermilk: 80,
      bakingPowder: 4.0, // median 3.8-4.0
      // Only 8 of 15 sweet cobbler toppings use soda at all; among those that
      // do, the median is 0.90. At 0.7 against 80 buttermilk the ratio is
      // 0.00875 — 1.17x stoichiometry, inside the browning allowance below.
      bakingSoda: 0.7,
    },
    // Load median 0.846 g/cm² across 17 sweet biscuit cobblers. The thickness
    // is high because coverage is low — tall separated mounds over ~41% of the
    // surface, not a sheet. Oven 375 °F is the median of a flat 350-425 plateau
    // with no consensus value; 42 min; 20 min rest.
    physical: {
      bakedThicknessMm: 35.1, rawDensity: 1.0, ovenExpansion: 1.7,
      ovenC: 190, minutes: 42, restMinutes: 20,
    },
  },
};

export const VERTEX_KEYS = ['crumble', 'crisp', 'cobbler'];

/** Sugar blend held constant across the whole triangle. */
export const SUGAR_BLEND = { lightBrown: 0.6, white: 0.4 };

/**
 * Acid budget for bicarbonate, from stoichiometry rather than folk rounding.
 *
 * Cultured buttermilk is fermented to pH 4.6-4.7 at 0.75-0.85% titratable
 * acidity, so take 0.8%. Titratable acidity is the right quantity here by a
 * useful coincidence: TA is titrated to the phenolphthalein endpoint at pH 8.3,
 * which is close to the pH of a bicarbonate solution, so it captures the
 * phosphate and casein buffering as well as the lactic acid itself.
 *
 *   240 g x 0.008          = 1.92 g lactic acid
 *   / 90.08 g/mol          = 0.0213 mol (monoprotic)
 *   x 84.007 g/mol NaHCO3  = 1.79 g soda
 *
 * So one cup of buttermilk neutralises about 1.79 g of soda — NOT the 2.8 g
 * that the familiar "half a teaspoon per cup" rule implies. That rule rounds up
 * and mildly overdoses; reaching 2.8 g would need ~1.25% TA, outside anything
 * real buttermilk achieves.
 */
export const SODA_PER_G_BUTTERMILK = 1.79 / 240; // ≈ 0.00746

/**
 * ...but a modest excess is deliberate, not a mistake. Maillard browning
 * accelerates under alkaline conditions, so well-tested recipes routinely run
 * above stoichiometry to get colour: ATK's drop biscuits sit at a soda-to-
 * buttermilk ratio of 0.010, which is 1.34x the stoichiometric ceiling.
 *
 * Past this allowance the surplus stops being a browning lever and becomes a
 * defect. The mechanism is not leftover bicarbonate itself — above 50-80 °C soda
 * decomposes to sodium carbonate, washing soda at pH ~11, which is what actually
 * reads as soapy (unreacted bicarbonate reads bitter and metallic instead).
 */
export const SODA_BROWNING_ALLOWANCE = 1.35;

/**
 * Lift equivalence, 1 part soda to 3.5 parts baking powder.
 *   soda with sufficient acid   0.524 g CO2/g
 *   baking powder at 30% NaHCO3 0.157 g CO2/g   -> ratio 3.3
 *   volumetric rule (1/4 tsp soda ≈ 1 tsp powder, 4.6 vs 4.0 g/tsp) -> 3.5
 * 3.3-3.5 is the defensible band; 3.5 keeps the volumetric rule intact.
 */
export const SODA_TO_POWDER_EQUIV = 3.5;

/** USDA: baking soda 4.6 g/tsp, baking powder 4.0 g/tsp. */
export const GRAMS_PER_TSP = { salt: 5.7, bakingPowder: 4.0, bakingSoda: 4.6 };
