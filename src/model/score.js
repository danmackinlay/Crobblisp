import { clamp01 } from './blend-util.js';

/**
 * The quality surface.
 *
 * The model does NOT correct bad points. It scores them and shows the terrain.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED, AND WHY
 *
 * This file previously scored `textureContrast = max(crunch, spring)`, on the
 * reasoning that a topping must be decisively EITHER crunchy OR tender-and-
 * sprung, and that being neither is what makes the middle of the triangle weak.
 *
 * Surveying what recipe authors actually say about texture killed that idea.
 *
 *  - "Crisp" is not a crumble-and-crisp property. It is the single most frequent
 *    target for sweet BISCUIT COBBLER toppings too — 8 mentions across 3 sources.
 *    A crunch term is not measuring something irrelevant at the cobbler corner.
 *
 *  - Authors repeatedly name both textures at once, as the definition of
 *    success rather than as a trade-off: "crisp on top, but soft and moist
 *    underneath"; "soft on the inside and crispy on the outside"; "light and
 *    pillowy with a deliciously crunchy crust". Six such phrases in the corpus.
 *
 * So the real target is not a point on a crunchy-to-springy continuum. It is
 * SPATIAL STRATIFICATION: crisp where the topping meets dry oven air, tender
 * where it does not. One object, two textures, at two depths. A scalar that
 * forces a choice between them scores the consensus target as mediocre.
 *
 * The trough in the middle of the triangle may well survive this — but if it
 * does, it now has to fall out of a topping failing to DEVELOP the
 * stratification, not out of an assumed exclusivity that no source supports.
 * ---------------------------------------------------------------------------
 *
 * Combined as a WEIGHTED GEOMETRIC MEAN so one near-zero component tanks the
 * point. An uncooked, gummy underside must not be rescuable by a good crust.
 */

const EPS = 0.02;

export function weightedGeometricMean(terms) {
  let wsum = 0;
  let acc = 0;
  for (const { value, weight } of terms) {
    const v = Math.max(EPS, Math.min(1, value));
    acc += weight * Math.log(v);
    wsum += weight;
  }
  return Math.exp(acc / wsum);
}

const NO_DIET_MODS = { crunchFactor: 1, springFactor: 1, structurePenalty: 0 };

export function score({
  ingredients,
  hydration,
  leaveningPower,
  morph,
  waterLoadNorm,
  dietMods = NO_DIET_MODS,
}) {
  const sugarN = clamp01(ingredients.sugar / 75); // crisp vertex is the max
  const fatN = clamp01(ingredients.butter / 70); // crisp vertex is the max
  const oatsN = clamp01(ingredients.oats / 41); // crisp vertex is the max
  const dryN = clamp01(1 - hydration / 80); // cobbler vertex is the max
  const leavenN = clamp01(leaveningPower / 6.45);
  const hydrationAdequacy = clamp01((hydration - 18) / 40);

  // --- Positive axes -------------------------------------------------------

  // 1. SURFACE CRISP. Wanted at every corner, not just the dry ones. Sugar is
  //    weighted highest because it is structural: it dissolves in the bake and
  //    VITRIFIES on cooling into an amorphous glass, and it is that glass, below
  //    its transition temperature, that fractures brittlely. (An earlier comment
  //    here said "recrystallises into a brittle glass", which is self-
  //    contradictory — a glass is amorphous by definition, and recrystallisation
  //    is the failure mode that makes a topping grainy.)
  //
  //    Scaled by dry-heat exposure, because crispness belongs to the surface
  //    that meets hot dry air, not to the topping as a bulk.
  //
  //    There are TWO routes to a crisp surface and the model needs both, because
  //    weighting bulk dryness heavily amounts to saying a wet dough can never
  //    brown — which is the same error, relocated, that this rewrite exists to
  //    fix. A biscuit crust is not a failed crumble; it crisps by a different
  //    mechanism and the corpus says it crisps reliably.
  //
  //      GLASS route — dry toppings. Sugar dissolves and vitrifies on cooling;
  //      that amorphous glass, below its transition temperature, is what
  //      fractures. Needs sugar, fat and low bulk moisture.
  //
  //      CRUST route — doughs. The exposed surface dehydrates and browns while
  //      the interior stays tender. Needs an open leavened crumb that can dry,
  //      not a dry dough.
  const glassRoute = 0.42 * sugarN + 0.32 * fatN + 0.26 * dryN;
  const crustRoute = 0.45 + 0.35 * leavenN + 0.2 * fatN;
  const surfaceCrisp = clamp01(
    Math.max(glassRoute, crustRoute) *
      (0.55 + 0.45 * morph.exposureNorm) *
      dietMods.crunchFactor,
  );

  // 2. THE SECOND TEXTURE, under the crust. What it should be changes with
  //    hydration, but something should always be there.
  //
  //    Dry end: clump structure. "Crumbly" is the most-cited descriptor in the
  //    whole survey (11 of 16 crisps), and clustering is described as something
  //    bakers actively work toward — "pinch into peanut-size clumps", "press the
  //    crumbles together to create larger clumps" — with the British corpus
  //    calling the same property craggy, nubbly, rubbly, pebbly.
  //
  //    Wet end: a tender, well-risen crumb.
  // Fat is the primary binder in a rubbed topping — the clumps in a crumble come
  // from butter, not water. Water helps (ATK adds "a couple of teaspoons" purely
  // to make the mixture clump) but it is the secondary term.
  const clumpStructure = clamp01(
    0.62 * fatN + 0.2 * clamp01(hydration / 22) + 0.18 * oatsN,
  );
  const tenderCrumb = clamp01(leavenN * hydrationAdequacy * dietMods.springFactor);
  const depthQuality = clamp01(
    clumpStructure * (1 - hydrationAdequacy) + tenderCrumb * hydrationAdequacy,
  );

  // 3. STRATIFICATION. Crust and interior both present, and distinct. The
  //    geometric form means having only one of the two does not score.
  //
  //    Note the WEIGHT below scales with hydration rather than being flat. A
  //    two-texture topping is the cobbler's stated target, not the crumble's,
  //    and weighting it equally everywhere would import one dish's ideal onto
  //    another — scoring a crumble as deficient for being the single-texture
  //    thing it is meant to be. The score measures how well a point executes
  //    what it is trying to be, so the criterion has to fade where it stops
  //    applying.
  const stratification = clamp01(Math.sqrt(Math.max(0, surfaceCrisp * depthQuality)));

  // CHEW is what sources actually credit oats with — Cook's Illustrated adds
  // them for chew, Betty Crocker sells a "perfectly chewy oat topping", Dorie
  // wants "the extra chew you get from rolled oats". It enters through the
  // structure term above rather than as its own component, because a topping
  // with no oats is not thereby defective: an oat-free British crumble is a
  // finished dish, not a crisp missing an ingredient. Scoring chew separately
  // penalised both the crumble and the cobbler corner for being themselves.
  //
  // Note what is NOT here at all: sog resistance. An earlier version gave oats a
  // weight of 0.38 for absorbing juice and staying chewy. Across 16 crisp
  // sources not one credits oats with resisting moisture, and the corpus's only
  // crunch-retention claim credits butter handling instead. That was folklore.

  // --- Defects -------------------------------------------------------------

  // UNCOOKED. The one failure every source agrees on — gummy, doughy, raw.
  // Deliberately NOT the same as a moist underside, which the corpus is split
  // on: King Arthur engineers it away as a defect ("runny filling and gummy
  // biscuits"), Smitten Kitchen states it as an inevitability, and Sally's names
  // "crisp on top, but soft and moist underneath" as the TARGET. Modelling both
  // as one term would penalise two sources for hitting their own stated goal.
  const doughiness = clamp01((hydration - 20) / 30);
  const undercooked = clamp01(
    doughiness * (1 - morph.exposureNorm) * (0.45 + 0.55 * waterLoadNorm) +
      dietMods.structurePenalty,
  );

  // SLUMP. Losing height loses the dry exposed surface the whole stratification
  // depends on.
  const slumped = clamp01(morph.rawSlump * doughiness * 1.3);

  // SOGGY UNDERSIDE. Deliberately weighted LOW rather than deleted.
  //
  // The corpus is genuinely split on whether this is a defect at all: King
  // Arthur engineers it away, Smitten Kitchen reports it as an inevitability
  // ("the undersides will be wet where they touch the fruit"), and Sally's names
  // "crisp on top, but soft and moist underneath" as the target outright. The
  // sonker goes further and wants the underside steamed on purpose.
  //
  // An earlier revision responded to that split by removing the term entirely,
  // which turned out to be an over-correction with a visible symptom: the choice
  // of berry then had NO effect whatsoever at the dry corners, because nothing
  // else in the model reads the liquid load unless the topping is doughy. A
  // crumble over raspberries and one over blueberries scored identically, which
  // is plainly wrong. It is back, at a weight that reflects a contested defect
  // rather than an agreed one.
  const soggy = clamp01(waterLoadNorm * (1 - morph.exposureNorm) * 0.6);

  // POWDERY. Under-cohesion — cited as often as sogginess in the crisp corpus
  // ("a little more powdery", "rather than powdery and crumbly", "starchy
  // taste"). A topping needs enough fat or liquid to clump at all.
  const powdery = clamp01((0.42 - (fatN * 0.7 + clamp01(hydration / 22) * 0.5)) * 2.2);

  // Not scored, and deliberately so. Across ~50 surveyed recipes not one warns
  // about a dry, greasy or burnt topping, despite butter ranging 33 to 136 per
  // 100 flour. The previous `greaseOut` and `blandness` guards had zero
  // attestation and have been removed rather than left as dormant inventions.
  // Toughness IS attested, but every source attributes it to OVERWORKING the
  // dough — a technique variable invisible to a composition model. It belongs in
  // the method text, and that is where it now lives.

  const components = {
    surfaceCrisp: { value: surfaceCrisp, weight: 1.0, kind: 'positive',
      label: 'Surface crisp',
      detail: 'Browned, brittle crust where the topping meets dry oven air. Wanted at every corner — the cobbler corpus names crisp more often than any other target.' },
    depth: { value: depthQuality, weight: 0.9, kind: 'positive',
      label: 'Structure beneath',
      detail: 'Craggy clumps at the dry end, a tender risen crumb at the wet end. The most-cited property in the whole survey.' },
    stratification: { value: stratification, weight: 0.3 + 0.9 * hydrationAdequacy, kind: 'positive',
      label: 'Stratification',
      detail: 'Crisp above and tender below at the same time. Six sources name both at once as the definition of success.' },
    cooked: { value: 1 - undercooked, weight: 1.3, kind: 'defect', risk: undercooked,
      label: 'Cooked through',
      detail: 'Gummy, doughy, raw — the one defect every source agrees on. A merely moist underside is a different thing, and two sources want it.' },
    height: { value: 1 - slumped, weight: 0.9, kind: 'defect', risk: slumped,
      label: 'Holds its height',
      detail: 'A topping that spreads flat loses the dry exposed surface its crust depends on.' },
    underside: { value: 1 - soggy, weight: 0.5, kind: 'defect', risk: soggy,
      label: 'Dry underside',
      detail: 'Weighted low on purpose — the sources disagree about whether a moist underside is a fault. Two of them want it.' },
    cohesion: { value: 1 - powdery, weight: 0.7, kind: 'defect', risk: powdery,
      label: 'Cohesion',
      detail: 'Powdery, floury, starchy. Under-cohesion is cited as often as sogginess.' },
  };

  const overall = weightedGeometricMean(Object.values(components));

  return {
    overall,
    surfaceCrisp,
    tenderCrumb,
    clumpStructure,
    stratification,
    components,
    diagnostics: { sugarN, fatN, oatsN, dryN, leavenN, hydrationAdequacy, doughiness },
  };
}

/** Fixed display domain — switching berry or diet should visibly move the map. */
export const SCORE_DOMAIN = [0.50, 0.98];
