import { clamp01 } from './blend.js';

/**
 * Morphology: how the topping is physically shaped, derived from hydration.
 *
 * WHAT THIS IS ACTUALLY MODELLING, corrected.
 *
 * An earlier version of this file explained soggy undersides as trapped steam
 * pressure — a continuous topping "seals" the fruit and gasses its own base into
 * paste. That story is repeated widely in recipe writing but it is not supported
 * by any food-science source, and the mechanism is wrong.
 *
 * The real constraint is thermal, and — unlike the steam story — it is
 * established in the bread-baking literature rather than assembled here. An
 * earlier revision of this file flagged the argument as unverified synthesis;
 * that was too cautious. Purlis & Salvadori's moving-boundary work describes a
 * three-zone structure directly: a crust that quickly exceeds 100 °C, "a mobile
 * evaporation front, always kept near 100 °C", and a crumb that approaches
 * 100 °C asymptotically. Measured profiles show the interior plateauing there.
 *
 * The threshold for browning is stronger than the argument this model was
 * making, and it is DUAL: crust colour needs surface temperature above 120 °C
 * AND water activity below 0.6. Either condition alone blocks it. A topping
 * against wet fruit fails both at once — pinned near 100 °C by evaporation, and
 * saturated. So it cannot brown at any oven temperature or any amount of
 * venting, and that conclusion is over-determined rather than marginal.
 *
 * One honest gap: no study was found measuring a baked good in direct contact
 * with a high-moisture filling. The transfer from bread crumb/crust to a fruit
 * interface is physically sound but not directly evidenced.
 *
 * That reframes what a good morphology is doing. It is not relieving pressure;
 * it is maximising the fraction of topping mass exposed to dry radiant oven heat
 * and minimising the fraction sitting in the pinned-at-100 °C zone. Loose crumb
 * wins on surface area, separated mounds win by letting most of each mound stand
 * clear of the fruit, and both let vapour bypass the topping rather than pass
 * through it. The arithmetic below is unchanged — coverage and porosity are a
 * good proxy for exposed surface either way — but it is measuring heat access,
 * not pressure relief.
 *
 * TWO CLAIMS ABOUT HYDRATION BANDS THAT TURNED OUT TO BE WRONG.
 *
 * 1. "The genuinely awkward band is 35-50%." Falsified — see slump() below. The
 *    surveyed cobbler dough cluster is 41-72%, so that band is not a dead zone,
 *    it is the mainstream. A 4.8-star, 146-rating cobbler sits at 48%.
 *
 * 2. "Rollable pastry lives at 22-35% hydration." Also wrong, and for an
 *    instructive reason. The rolled-pastry sonker this model cites as its
 *    existence proof actually runs about 51 parts liquid per 100 flour —
 *    squarely in the dough cluster, not below it. What makes it rollable is very
 *    low FAT (14.5 against a cobbler median of 45), not low water. Combined
 *    liquid-plus-fat is 65 against a cobbler median around 123.
 *
 *    So rollability is a function of liquid AND fat together, and this ladder is
 *    keyed on hydration alone. The regime labels below are therefore approximate
 *    at the dry end: a genuinely low-fat dough becomes rollable at a hydration
 *    where this model still calls it a drop. Recorded as a known limitation
 *    rather than rebuilt, because fixing it properly means making morphology a
 *    two-variable surface and there is not enough data to calibrate that.
 *
 * On lattices: the gaps buy exposed surface. Note that pie vents are primarily
 * top-crust and boil-over control and do little for a bottom directly, so the
 * usual explanation for cutting them is not the operative one here.
 */

const REGIMES = [
  {
    maxHydration: 12,
    key: 'loose-crumb',
    label: 'Loose crumb',
    heatPath: 'open crumb structure — most of its surface meets dry oven air',
    method:
      'Scatter loosely over the fruit, right to the edges. Do not press it down.',
  },
  {
    maxHydration: 22,
    key: 'clumped-crumb',
    label: 'Clumped crumb',
    heatPath: 'open crumb structure — most of its surface meets dry oven air',
    method:
      'Squeeze handfuls into hazelnut-sized nuggets and break them over the fruit. The clumps are the point — they brown separately.',
  },
  {
    maxHydration: 35,
    key: 'rollable-sheet',
    label: 'Rollable sheet — lattice or shards',
    heatPath: 'cut gaps — the sonker move; without them almost none of it stands clear',
    method:
      'Roll to about 6 mm and either cut a lattice or tear into rough shards, laying them with clear gaps. The gaps are structural — this dough has no porosity of its own.',
  },
  {
    maxHydration: 50,
    key: 'slack-drop',
    label: 'Slack drop',
    heatPath: 'separated mounds, each standing clear of the fruit',
    method:
      'Chill the dough 15 minutes, then drop in ~30 g mounds with generous space between them. It will spread.',
  },
  {
    maxHydration: Infinity,
    key: 'biscuit-drop',
    label: 'Biscuit drop',
    heatPath: 'separated mounds, each standing clear of the fruit',
    method:
      'Drop in ~45 g mounds leaving clear channels between them. They must not touch, and it must not be spread into a sheet.',
  },
];

/**
 * Coverage, intrinsic porosity and slump sensitivity as piecewise-linear
 * functions of hydration. Kept continuous so the quality surface has no
 * artificial banding — the named technique steps, the physics doesn't.
 */
const ANCHORS = {
  hydration: [0, 12, 22, 26, 35, 40, 50, 68, 80, 100],
  // Coverage at the wet end is now measured rather than guessed. Two recipes in
  // the survey are precise enough to compute it: King Arthur's cherry cobbler
  // specifies 9 mounds of 50 g in a 9-inch square (~42% of the surface), and
  // ATK's peach cobbler drops 6 mounds from 338 g of dough in an 8-inch square
  // (~40%), with an explicit instruction that the mounds must not touch. An
  // earlier version of this file had the cobbler corner at 71% coverage, which
  // is nearly a sheet — the opposite of what the technique is for.
  coverage: [0.95, 0.95, 0.93, 0.78, 0.7, 0.58, 0.48, 0.43, 0.41, 0.4],
  porosity: [0.55, 0.55, 0.45, 0.1, 0.07, 0.09, 0.12, 0.15, 0.16, 0.18],
  slumpSensitivity: [0, 0, 0.15, 0.4, 0.45, 1.0, 1.0, 1.0, 1.0, 1.0],
};

function piecewise(h, ys) {
  const xs = ANCHORS.hydration;
  if (h <= xs[0]) return ys[0];
  if (h >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (h <= xs[i]) {
      const t = (h - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/**
 * Slump: the tendency to flow after shaping.
 *
 * FALSIFIED AND RECALIBRATED. This curve originally peaked at 0.55 around h=42,
 * encoding an "awkward band" at 35-50% hydration — a topping too slack to hold a
 * cut edge and too stiff to drop cleanly. That idea was invented in this
 * project's first design conversation, before any research, and carried
 * untested for a long time. It is wrong.
 *
 * The surveyed cobbler DOUGH cluster is 41-72% hydration. The invented penalty
 * band sat directly on top of it. Scoring real published recipes exposed this:
 * Sally's Baking Addiction's peach cobbler sits at h=48 — near the old peak —
 * and carries 4.8 stars from 146 ratings. The model was condemning a region that
 * contains a demonstrably well-loved recipe.
 *
 * What the corpus actually says about spread is that it is a TECHNIQUE variable
 * authors manage, not a defect that ruins the dish. The Butter Book chills its
 * shaped mounds 30-60 minutes; Sally pats hers into flat patties on purpose;
 * Savory Nothings warns against flattening because it "will destroy the air
 * bubbles"; Getty Stewart says to flatten slightly to avoid mounds that
 * underbake. Four authors, four different deliberate handling choices, none
 * treating spread as a failure.
 *
 * So slump is demoted on the same grounds as toughness, which this model already
 * excludes: real, mentioned, and handled by technique rather than predicted by
 * composition. Amplitude drops 0.55 -> 0.18. It still bends the surface where a
 * dough is genuinely slack, but it no longer manufactures a trough.
 */
function slump(h) {
  if (h < 18) return 0;
  return 0.18 * Math.exp(-((h - 42) ** 2) / (2 * 12 ** 2));
}

export function morphology(hydration) {
  const regime = REGIMES.find((r) => hydration < r.maxHydration) ?? REGIMES[REGIMES.length - 1];

  const coverage = piecewise(hydration, ANCHORS.coverage);
  const porosity = piecewise(hydration, ANCHORS.porosity);
  const slumpSensitivity = piecewise(hydration, ANCHORS.slumpSensitivity);

  const rawSlump = slump(hydration);
  const effectiveSlump = rawSlump * slumpSensitivity;

  // Exposure index: the fraction of the topping that meets dry radiant oven air
  // rather than sitting in the 100 °C-pinned zone against the fruit, counting
  // both the gaps between pieces and the porosity within them.
  const exposureIndex = 1 - coverage * (1 - porosity);
  const effectiveExposure = exposureIndex * (1 - effectiveSlump);

  return {
    regime: regime.key,
    label: regime.label,
    heatPath: regime.heatPath,
    method: regime.method,
    coverage,
    porosity,
    rawSlump,
    effectiveSlump,
    exposureIndex,
    effectiveExposure,
    exposureNorm: clamp01(effectiveExposure / 0.66),
  };
}

export { REGIMES };
