import { clamp01 } from '../blend-util.js';
import { weightedGeometricMean } from '../score.js';
import { hydrationOf } from './vertices.js';

/**
 * Quality surface for the poured family.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE COMPARING THESE NUMBERS TO THE RUBBED FAMILY'S. YOU CANNOT.
 *
 * The rubbed surface is calibrated. Eight surveyed recipes carrying 4.5 stars or
 * better across 20+ ratings were scored by the model, and the claim that no
 * well-loved recipe falls below 0.70 is a falsifiable statement that was
 * actually tested — it caught two invented penalty bands and killed them.
 *
 * NOT ONE poured or sonker record in this corpus carries a rating. Not one. So
 * there is no equivalent test available here, and the absolute level of these
 * scores is uncalibrated. What the surface can honestly claim is:
 *
 *   - the ORDERING of the terms is grounded in what the sources say,
 *   - the SHAPE — where the surface falls away and why — follows from stated
 *     mechanisms rather than from fitted constants,
 *   - the ABSOLUTE VALUE means nothing in comparison to the other family, and
 *     the two are given different display domains so the maps are not read
 *     against each other by accident.
 *
 * Three vertices, five terms. That is close to as many free parameters as data
 * points, so the vertex values below were NOT tuned until they looked good. They
 * land where the stated mechanisms put them: batter cobbler 0.84, sonker 0.73,
 * pudding cake 0.70.
 *
 * ---------------------------------------------------------------------------
 * AN UNRESOLVED DISAGREEMENT WITH A SOURCE, LEFT STANDING
 *
 * There is a step of about 0.10 in the surface at the pre-bake boundary. It is
 * the model saying that the sonker's own defining technique — bake the fruit
 * first, pour the batter on top — costs roughly a tenth of a point against
 * inverting instead. In other words the model thinks a sonker would be better if
 * it were a batter cobbler.
 *
 * Part of that gap WAS an artefact and has been fixed (see the assembly term
 * below: zero-weighting an inapplicable criterion is not neutral in a geometric
 * mean, and it was costing the sonker 0.15 by itself). What remains is a real
 * disagreement, and there are two live possibilities:
 *
 *   1. The model is right, and the sonker tradition is suboptimal.
 *   2. The model is importing a preference the sonker rejects. Its source
 *      describes the result approvingly: "The fruit really steamed it like a
 *      dumpling, while the top baked to golden, buttery perfection." A steamed
 *      underside is the GOAL there. The `set` and `drowned` terms cannot tell
 *      that apart from a gummy one — the same conflation the rubbed model
 *      already found and demoted, where it weighted its soggy-underside term
 *      down to 0.5 precisely because "the sonker goes further and wants the
 *      underside steamed on purpose".
 *
 * Possibility 2 is more likely, and fixing it properly means splitting "cooked"
 * from "dry underneath" with evidence this corpus does not contain — there are
 * no ratings here to falsify either reading. So it is recorded rather than
 * tuned away. Tuning it away with no data would be the exact failure mode this
 * project has twice caught itself in.
 * ---------------------------------------------------------------------------
 */

const NO_DIET_MODS = { crunchFactor: 1, springFactor: 1, structurePenalty: 0 };

export function pouredScore({
  ingredients,
  leaveningPower,
  morph,
  physical,
  waterLoadNorm,
  dietMods = NO_DIET_MODS,
}) {
  const hydration = hydrationOf(ingredients);
  const sugarN = clamp01(ingredients.sugar / 165);
  const fatN = clamp01(ingredients.butter / 90);
  const eggN = clamp01(ingredients.egg / 83);
  const leavenN = clamp01(leaveningPower / 4.8);

  // --- Positive axes -------------------------------------------------------

  // 1. THE LID. Every source in this family describes the top the same way:
  //    "the top baked to golden, buttery perfection", "cake topping is a light
  //    golden brown". At 80-165 parts sugar this is a genuinely different
  //    surface from a crumble's — the sugar is a structural phase that sets into
  //    a thin crackling sheet, and it is the single most recognisable feature of
  //    a batter cobbler.
  //
  //    Scaled by lidFraction: a batter that fails to rise through its fruit ends
  //    up with fruit sitting on pale batter, and there is no lid to speak of.
  const lidBase = clamp01(0.5 * sugarN + 0.3 * fatN + 0.2 * leavenN);
  const lid = clamp01(lidBase * (0.55 + 0.45 * morph.lidFraction) * dietMods.crunchFactor);

  // 2. SET. The interior cooked through rather than gummy — the failure this
  //    family is actually prone to, and the one the corpus warns about.
  //
  //    Structure comes from egg protein where there is any, and from an open
  //    leavened crumb where there is not. Against it: total water, the DEPTH the
  //    heat has to cross, and the fruit's own liquid.
  //
  //    Two credits that are not cosmetic:
  //
  //    INVERSION. A batter that rises through its fruit finishes the bake on
  //    top, in dry radiant heat, instead of buried under a wet layer. That is
  //    the whole point of the technique and it is the difference between the
  //    batter cobbler scoring well and scoring badly.
  //
  //    PRE-BAKING. Driving water off the fruit before the batter goes on is
  //    exactly what the sonker's 30-minute head start is for. Crediting it is
  //    what stops the model from condemning a technique whose entire purpose is
  //    to prevent the defect being scored.
  const structure = clamp01(
    0.45 + 0.35 * eggN + 0.2 * leavenN - dietMods.structurePenalty,
  );
  const waterBurden = clamp01((hydration - 60) / 110);
  // Depth normalised by bake time: a deep layer given longer is not the same
  // risk as a deep layer given the same 35 minutes as a shallow one.
  const depthBurden = clamp01(
    (physical.loadGPerCm2 / (physical.minutes / 35) - 0.8) / 0.9,
  );
  const fruitBurden = waterLoadNorm * (morph.prebake ? 0.55 : 1);

  const gumminess = clamp01(
    (0.55 * waterBurden + 0.25 * depthBurden + 0.2 * fruitBurden) *
      (1.35 - 0.5 * structure) *
      (1 - 0.45 * morph.inversion),
  );
  const set = 1 - gumminess;

  // 3. LIFT, weighted by whether the point is trying to rise at all.
  //
  //    The sonker is not. "It doesn't rise much, it's designed to stay flat" —
  //    the source says so in as many words. Weighting lift flat across the
  //    triangle would score that corner as deficient for achieving its own
  //    stated goal, which is the exact error this project already made twice
  //    (the max(crunch, spring) texture axis, and the invented awkward band).
  //    The weight therefore scales with the vertex's own oven expansion.
  const lift = clamp01(0.35 + 0.45 * leavenN + 0.2 * eggN) * dietMods.springFactor;
  const liftWeight = clamp01((physical.ovenExpansion - 1) / 0.8);

  // 4. DOES THE ASSEMBLY WORK? Asked of BOTH assemblies, which is a correction.
  //
  //    This term used to score inversion only, and was weighted to ZERO where the
  //    fruit is pre-baked — on the reasoning that a sonker is not a failed batter
  //    cobbler and should not be marked down for declining a technique it never
  //    attempts. That reasoning is right and the mechanism was wrong.
  //
  //    In a weighted geometric mean, deleting a term is not neutral. The term's
  //    value at an inverting point is ~0.89, well ABOVE the overall score, so
  //    removing it pulls the mean DOWN. The sonker was being penalised for
  //    declining inversion by the very device meant to excuse it — a 0.15 cliff
  //    at the pre-bake boundary, visible as a hard vertical edge on the surface.
  //
  //    The fix is to ask the question the criterion was always about: did the
  //    chosen assembly do its job? Pouring batter onto hot bubbling fruit is a
  //    reliable technique on its own terms — a surveyed sonker describes the
  //    batter as beginning "to cook even before you return it to the oven" — so
  //    it scores well without needing to invert.
  const inversionQuality = morph.prebake
    ? 0.85
    : clamp01(0.45 + 0.55 * morph.inversion);
  const inversionWeight = 0.7;

  // --- Defects -------------------------------------------------------------

  // DROWNED. Batter thinned into paste at the fruit interface.
  //
  // Inversion lifts it clear. Pre-baking does more than remove liquid: the batter
  // meets fruit that is already hot and bubbling and begins setting on contact,
  // which is the mechanism the surveyed sonker states directly ("begins to cook
  // even before you return it to the oven"). The earlier 0.6 factor was a guess;
  // 0.35 reflects that the source describes an active protection, not merely a
  // drier starting point.
  const drowned = clamp01(
    waterLoadNorm * (1 - morph.inversion) * (morph.prebake ? 0.35 : 1) * 0.7,
  );

  // NOT SCORED, deliberately: cloying sweetness. At 80-165 parts sugar this
  // family is three to five times sweeter than a biscuit cobbler, and it would
  // be easy to add a penalty for it. Nothing supports one. The corpus review
  // mining found that 43.5% of "too sweet" matches were actually "NOT too
  // sweet" — praise — and no source in this family warns about sweetness. The
  // rubbed model already deleted two invented defects (greasiness, blandness)
  // for having zero attestation; inventing a third here would be the same
  // mistake with a new name.

  const components = {
    lid: {
      value: lid, weight: 1.0, kind: 'positive',
      label: 'The lid',
      detail: 'Thin crackling sugar-and-butter sheet on top. The signature of this family — sugar runs 3-5x a biscuit cobbler and sets as a structural phase.',
    },
    set: {
      value: set, weight: 1.3, kind: 'defect', risk: gumminess,
      label: 'Cooked through',
      detail: 'Not gummy. The characteristic failure of a poured batter, and the reason inversion and pre-baking exist as techniques.',
    },
    lift: {
      value: lift, weight: liftWeight, kind: 'positive',
      label: 'Lift',
      detail: 'Risen rather than leathery. Weighted by how much the point is trying to rise — a sonker is designed to stay flat and is not marked down for it.',
    },
    inversion: {
      value: inversionQuality, weight: inversionWeight, kind: 'positive',
      label: morph.prebake ? 'Assembly' : 'Inversion',
      detail: morph.prebake
        ? 'Batter poured onto hot bubbling fruit sets on contact. A reliable assembly judged on its own terms, not marked down for declining to invert.'
        : 'Batter rising through the fruit to finish on top. The whole point of pouring the layers in this order.',
    },
    dilution: {
      value: 1 - drowned, weight: 0.8, kind: 'defect', risk: drowned,
      label: 'Not drowned',
      detail: 'Batter thinned to paste where it meets the fruit. Inversion lifts it clear of the wet zone; pre-baking removes some of the liquid first.',
    },
  };

  const overall = weightedGeometricMean(Object.values(components));

  return {
    overall,
    lid,
    set,
    lift,
    inversion: morph.inversion,
    components,
    diagnostics: {
      hydration, sugarN, fatN, eggN, leavenN,
      structure, waterBurden, depthBurden, fruitBurden, gumminess,
    },
  };
}

/**
 * Display domain for this family, deliberately NOT the rubbed family's [0.62,
 * 0.98]. The two surfaces are produced by different models against different
 * (and here, absent) calibration, and sharing a colour scale would invite
 * reading one against the other.
 */
export const POURED_SCORE_DOMAIN = [0.55, 0.9];
