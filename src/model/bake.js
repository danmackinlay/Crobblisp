import { clamp01 } from './blend-util.js';

/**
 * Bake schedule, blended from the three vertices' surveyed medians.
 *
 * TWO CORRECTIONS from the earlier version of this file.
 *
 * 1. IT WAS A SINGLE FLAT SCHEDULE — 180 °C for ~50 min everywhere. That is a
 *    good crisp and a bad crumble. The two dry corners genuinely differ:
 *
 *      British crumble   200 °C median (also the mode), 37.5 min
 *      American crisp    177 °C — 9 of 16 sources sit at exactly 350 °F — 48 min
 *      Biscuit cobbler   190 °C, median of a flat 350-425 °F plateau, ~42 min
 *
 *    Temperature and time trade off against each other across the corpus, with
 *    total thermal load roughly conserved, so blending both affinely between the
 *    vertices preserves that relationship instead of fighting it.
 *
 * 2. IT PRESCRIBED A TWO-STAGE BAKE for anything leavened, hot then dropped.
 *    That has almost no support: across ~30 surveyed recipes exactly ONE changes
 *    the oven temperature mid-bake, and it descends (400 °F for 15 min, then 350)
 *    — so the direction was right and the prevalence was invented. Everything
 *    else that looks multi-stage is a constant-temperature pre-bake of the fruit.
 *    A descending finish is now offered as an option, attributed to its single
 *    precedent, rather than imposed.
 */
export function bakeSchedule({ physical, hydration, waterLoadNorm, exposureNorm }) {
  // Celsius to the nearest 5; Fahrenheit to the nearest 25, because that is how
  // an American oven dial is actually marked.
  const celsius = Math.round(physical.ovenC / 5) * 5;
  const fahrenheit = Math.round((physical.ovenC * 9) / 5 / 25 + 32 / 25) * 25;

  // Time flexes modestly with how much liquid the fruit will throw.
  const totalMinutes = Math.round(physical.minutes + 8 * (waterLoadNorm - 0.5) * 2) || 40;

  // Pre-baking the fruit is a minority technique but a well-motivated one, and
  // it earns its place exactly where this model predicts trouble: a wet dough
  // with poor dry-heat access. King Arthur states the reasoning — their cherry
  // cobbler pre-bakes the fruit 30-35 minutes to avoid "runny filling and gummy
  // biscuits" — and a sonker recipe gives the mechanism from the other side, the
  // batter "poured over the hot, bubbling fruit... begins to cook even before you
  // return it to the oven". Note it is NOT ATK's stated rationale; ATK gives the
  // instruction with no reason attached.
  const prebakeValue = clamp01((hydration - 30) / 30) * (1 - clamp01(exposureNorm));
  const prebake = prebakeValue > 0.12;

  return {
    twoStage: false,
    celsius,
    fahrenheit,
    stages: [{ celsius, fahrenheit, minutes: totalMinutes }],
    totalMinutes,
    restMinutes: Math.round(physical.restMinutes),
    prebake,
    prebakeMinutes: prebake ? 10 : 0,
    rationale:
      'A single steady oven. Only one recipe in roughly thirty surveyed changes temperature mid-bake, so the two-stage schedule an earlier version prescribed has been dropped.',
    descendingOption:
      'If the top is colouring faster than the interior sets, drop the oven 25 °C for the remainder — the one surveyed precedent for a temperature change goes in that direction.',
  };
}

/**
 * Doneness cues and the rest.
 *
 * The earlier version told you to look for the filling bubbling in the CENTRE,
 * "not only at the edges". That is backwards. Bubbling at the edges is the
 * convention across the corpus — five sources phrase it that way — and asking
 * for centre-bubbling is essentially a single-source practice (Dorie's, and she
 * phrases it as juices coming up through the topping rather than around it).
 */
export function servingNotes(berry, bake) {
  const cues = [
    'The filling should be bubbling around the edges — that is the conventional cue, and the one nearly every source uses.',
    'The topping should be deep golden, past the colour you would guess.',
  ];
  if (bake.prebake) {
    cues.push(
      'If the topping browns before the interior sets, tent it loosely with foil rather than pulling it early.',
    );
  }
  return {
    doneness: cues,
    rest: `Rest ${bake.restMinutes} minutes before serving. King Arthur is the only source to give a reason and it is a textural one: served hot the topping "may be quite soft", while left to cool "it'll firm up nicely". The ${berry.label.toLowerCase()} filling also sets on cooling rather than in the oven.`,
    overworking:
      'Do not overwork the mixture. Toughness is the one attested defect this model cannot predict from composition — every source that mentions it blames handling, not the recipe.',
  };
}
