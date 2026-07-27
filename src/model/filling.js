import { fruitLoad } from './fruit.js';

/**
 * The filling, dosed from King Arthur's per-fruit thickener chart rather than
 * from a guessed water-release fraction.
 *
 * Two corrections from the earlier version of this file:
 *
 * 1. THE STARCH CHOICE. Tapioca is still the default, but not for the reason
 *    originally given. The claim was that berry acidity hydrolyses cornstarch's
 *    amylose over a long bake so the filling thickens then thins again. That
 *    does not survive checking. Acid hydrolysis cleaves both amylose and
 *    amylopectin, so singling out amylose is wrong; the studies showing real
 *    viscosity collapse use ~1 N acid, three orders of magnitude stronger than a
 *    pH 3.3 filling; and native tapioca is not notably acid-stable anyway — the
 *    industrial fix for acid stability is chemical crosslinking, which is why
 *    the patent for acid-stable starch is itself tapioca-based. Blackberries
 *    also turn out to run pH 3.85-4.5, mild enough for the question to be moot.
 *
 *    Tapioca stays because of two things that ARE supported: it sets clear
 *    rather than cloudy, and it is the stronger thickener per gram, dosed
 *    20-40% lower than cornstarch for the same set.
 *
 * 2. THE OPEN-FACE ADJUSTMENT. King Arthur's chart is for a double-crust pie.
 *    An open topping loses water by evaporation throughout the bake, so it needs
 *    less — call it 60-75% of the pie dosage. Which end of that range depends on
 *    how much of the fruit surface is actually open to dry oven air, which is
 *    what the morphology model computes.
 */

/** KA's chart runs cornstarch 4.5-6.5% of fruit against tapioca 3-5%. */
const CORNSTARCH_EQUIV = 1.3;

export function filling(berry, dish, morph) {
  const load = fruitLoad(berry, dish);

  // Pie dosage, then scaled down for an open face. More exposure means more
  // evaporation during the bake, so less starch is needed to reach the same set.
  const openFaceFactor = 0.75 - 0.15 * morph.exposureNorm;
  const tapiocaG = load.starchDemandG * openFaceFactor;

  const [pLo, pHi] = berry.pH;

  return {
    berryMassG: dish.berryMassG,
    sugarG: dish.berryMassG * berry.sugarRate,
    tapiocaG,
    cornstarchAltG: tapiocaG * CORNSTARCH_EQUIV,
    lemonJuiceG: dish.berryMassG * berry.lemonRate,
    saltG: dish.berryMassG * 0.002,

    pieDosageG: load.starchDemandG,
    openFaceFactor,
    loadNorm: load.loadNorm,
    loadPerCm2: load.perCm2,
    estimatedJuiceG: load.estimatedJuiceG,
    pH: `${pLo}-${pHi}`,

    starchNote:
      'Tapioca rather than cornstarch, for two reasons that hold up: it sets clear instead of cloudy, and it thickens harder per gram. The usual argument — that acid destroys cornstarch over a long bake — does not survive checking at these pH levels.',
  };
}
