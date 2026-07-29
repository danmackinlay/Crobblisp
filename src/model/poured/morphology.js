import { clamp01 } from '../blend-util.js';

/**
 * Poured morphology: where the batter ends up relative to the fruit.
 *
 * The rubbed family's morphology model asks one question — how much of the
 * topping stands clear of the fruit and meets dry oven air — and answers it with
 * coverage and porosity. Neither concept applies here. A poured batter covers
 * 100% of the dish and has no porosity until the leavening acts on it.
 *
 * The question that replaces it is INVERSION: does the batter rise through the
 * fruit, and end the bake above it?
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ACTUALLY KNOWN ABOUT THE INVERSION, WHICH IS LESS THAN THE INTERNET
 * SUGGESTS
 *
 * The effect is real and well attested in the recipes themselves. Butter goes in
 * the pan, batter is poured over it unstirred, fruit is scattered on top
 * unstirred, and the layers change places during the bake. Three of the four
 * poured sources in this corpus describe it, and King Arthur states the intent
 * outright: the batter is meant to "rise up and over the fruit as it bakes".
 *
 * The MECHANISM, however, is not sourced. The corpus record for the Magic
 * Cobbler carries the flag in full capitals: "THE INVERSION IS REAL BUT ITS
 * EXPLANATION IS NOT SOURCED... Every online account of the physics traces to
 * content farms agreeing with each other and citing nothing."
 *
 * So what follows is a MODEL, not a measurement. It says the batter needs to be
 * fluid enough to flow past the fruit, and to be generating enough gas to become
 * less dense than it, and that both are necessary. That is ordinary buoyancy and
 * it is consistent with every source, but no source measures it and nothing here
 * should be read as established. The predicted quantity is used to choose an
 * assembly and to weight one score term; it is deliberately not load-bearing
 * anywhere else.
 *
 * A note on the name, from the corpus: one etymology for "sonker" is a dialect
 * form of "sinker", because the fruit sinks through the batter — which would put
 * a two-century-old trace on the observation, if not on the explanation. The
 * competing Scots etymology (a grassy knoll) is at least as well supported, so
 * this is offered as a nice coincidence rather than as evidence.
 * ---------------------------------------------------------------------------
 */

/**
 * Fluidity: how readily the raw batter flows around a piece of fruit.
 *
 * Liquid dominates. Melted fat thins the batter but is heavier than water per
 * unit of thinning, so it is discounted. Raw egg is roughly as mobile as milk
 * before it sets, so it counts nearly in full — and it is most of what makes the
 * pudding-cake corner pourable at all, given it has only 23 parts of milk.
 *
 * The offset and span are fitted to put the three corners on a sensible spread
 * (batter 1.0, sonker 0.80, cake 0.45) rather than derived. With three data
 * points that is curve-fitting, and it is only defensible because the ordering
 * — the sugariest, wettest batter is the most mobile — is not in doubt.
 */
export function fluidity(ing) {
  return clamp01((ing.buttermilk + 0.7 * ing.butter + 0.9 * ing.egg - 55) / 130);
}

/**
 * How strongly this batter will rise through fruit laid on top of it.
 *
 * Multiplicative because both conditions are necessary: a stiff batter cannot
 * flow past the fruit however much gas it makes, and a fluid batter with no
 * leavening has no reason to go anywhere. The 0.35 floor on the gas term is
 * thermal expansion and steam, which happen with no chemical leavening at all.
 */
export function inversionCapacity(ing, leaveningPower) {
  const gas = clamp01(leaveningPower / 4.8);
  return clamp01(fluidity(ing) * (0.35 + 0.65 * gas));
}

const FORMS = [
  {
    max: 0.3,
    key: 'flat-lid',
    label: 'Flat lid',
    behaviour: 'stays broadly where you pour it, setting into a single sheet over the fruit',
  },
  {
    max: 0.72,
    key: 'partial-rise',
    label: 'Partial rise',
    behaviour: 'climbs part-way around the fruit, closing over some of it and leaving the rest proud',
  },
  {
    max: Infinity,
    key: 'full-inversion',
    label: 'Full inversion',
    behaviour: 'rises through the fruit entirely and ends the bake above it, studded with whatever broke the surface',
  },
];

/**
 * The assembly. This is the one place the model tells you to do something
 * physically different at different points in the triangle.
 *
 * PREBAKE IS A RECIPE PROPERTY, NOT AN INFERENCE. The sonker corner bakes its
 * fruit for 30 minutes before the batter goes on; the other two do not. That is
 * blended as a number like oven temperature and thresholded here, rather than
 * being predicted from composition — the model has no basis for deriving it and
 * pretending otherwise would be inventing a rule from one data point.
 *
 * Where the fruit is pre-baked, pouring the batter UNDER it is not an option:
 * the fruit is already in the dish and hot. So a pre-baked point pours over the
 * top regardless of what its inversion capacity would have allowed.
 */
export function pourMorphology({ ingredients, leaveningPower, prebakeFruit }) {
  const flow = fluidity(ingredients);
  const capacity = inversionCapacity(ingredients, leaveningPower);
  const prebake = prebakeFruit > 0.5;

  // Realised inversion, as opposed to capacity. Pouring over pre-baked fruit
  // forecloses it whatever the batter could have done.
  const inversion = prebake ? 0 : capacity;

  // The FORM is chosen from what actually happens, not from what the batter
  // could have done. The sonker has ample capacity to invert and deliberately
  // does not use it; labelling it "full inversion" because of that unused
  // capacity described the opposite of what comes out of the oven.
  const form = FORMS.find((f) => inversion < f.max) ?? FORMS[FORMS.length - 1];

  const assembly = prebake
    ? {
        key: 'poured-over',
        label: 'Poured over pre-baked fruit',
        // The pre-bake itself is emitted by the bake schedule, which owns the
        // timing. Repeating it here made the sonker say "bake the fruit alone"
        // twice in consecutive steps.
        steps: [
          'Pour the batter evenly over the hot fruit — it starts cooking on contact — and return it to the oven.',
        ],
      }
    : {
        key: 'self-inverting',
        label: 'Self-inverting — butter, batter, fruit, in that order',
        steps: [
          'Melt the butter directly in the dish in the heating oven, then take it out.',
          'Pour the batter into the melted butter. DO NOT STIR — the layers have to stay separate for this to work.',
          'Scatter the fruit over the batter. Again do not stir. It will look wrong; it is not.',
        ],
      };

  /**
   * Fraction of the finished top surface that is batter rather than exposed
   * fruit — the surface available to brown into a lid.
   *
   * Pouring over the top gives a complete sheet. Inverting gives a top that is
   * mostly batter but studded with fruit that broke through, and a weak
   * inversion gives a top that is mostly fruit sitting on pale batter, which is
   * the characteristic failure of this technique.
   */
  const lidFraction = prebake ? 0.95 : 0.35 + 0.6 * inversion;

  return {
    regime: form.key,
    label: form.label,
    behaviour: form.behaviour,
    fluidity: flow,
    inversionCapacity: capacity,
    inversion,
    prebake,
    assembly,
    lidFraction,
    // Named to match the rubbed family's morphology so the shared bake and
    // recipe code can read either without special-casing. Here it means the
    // fraction of the batter's own surface meeting dry air, which for a poured
    // layer is essentially the lid.
    exposureNorm: clamp01(lidFraction),
    // A poured layer always covers the dish; kept so shared code that reads
    // coverage gets a truthful answer rather than undefined.
    coverage: 1,
  };
}
