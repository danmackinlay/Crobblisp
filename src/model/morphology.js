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
 * The real constraint is thermal. While liquid water is boiling at the
 * fruit/topping interface, evaporative cooling PINS that boundary at about
 * 100 °C, whatever the oven is set to. Crisping a dough needs it driven above
 * 100 °C so it can dehydrate; browning needs 140 °C+. So no part of a topping in
 * contact with wet fruit can ever crisp or brown — at any oven temperature, with
 * any amount of venting. Sogginess at the interface is thermodynamically
 * mandated, not an accident of trapped steam.
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
 * The band at 22-35% hydration looks dead on paper and isn't: that is pie
 * pastry, and the lattice-topped sonker of Surry County, NC is the existence
 * proof. The surveyed Rockford General Store sonker crust runs about 51 parts
 * liquid per 100 flour against a cobbler median of 77, and gets its rollability
 * from low fat as much as low water. Cutting a lattice works here — though note
 * that pie vents are primarily top-crust and boil-over control, and do little
 * for a bottom directly. What the gaps buy is exposed surface.
 *
 * The genuinely awkward band is 35-50%: too slack to roll and hold a cut edge,
 * too stiff to drop cleanly, and at its maximum tendency to slump flat, which
 * pushes more of its mass into the pinned zone.
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
 * Slump: the tendency to flow after shaping and close its own vents. Peaks
 * where the dough is cohesive but weak — hydrated enough to move, not yet
 * developed or leavened enough to set fast. A proper biscuit dough holds its
 * shape again because gluten and oven spring set the structure early.
 */
function slump(h) {
  if (h < 18) return 0;
  return 0.55 * Math.exp(-((h - 42) ** 2) / (2 * 12 ** 2));
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
