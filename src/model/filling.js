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
 *    Tapioca stays for ONE supported reason: it sets clear rather than cloudy.
 *
 *    The second reason previously given here — that it is the stronger thickener
 *    per gram — does NOT survive the peer-reviewed literature, and the STABILITY
 *    direction was backwards. Head to head at 5% dry basis, native cassava peaks
 *    at 69 RVU against waxy maize at 85. The strong-thickener reputation attaches
 *    to WAXY cassava (116-131 RVU), a different material. Worse: native cassava
 *    has limited resistance to shear, heat and acid, and breaks down MORE than
 *    maize under sustained processing. Corn holds a paste better. That is
 *    precisely why modified cassava starches exist.
 *
 *    The dosing below still comes from King Arthur's chart, which specifies
 *    QUICK-COOKING tapioca — a pregelatinised product, not the native starch the
 *    RVA studies measure. That is the most likely explanation for the conflict,
 *    and it is why the ingredient line says quick tapioca specifically.
 *
 *    One finding worth acting on if this filling ever misbehaves: adding
 *    low-methoxyl pectin at ~10% of the starch raises peak, hot-paste and
 *    cold-paste viscosity AND reduces relative breakdown, tested at pH 3.0-3.2
 *    under baking — i.e. pectin partially repairs tapioca's stability weakness.
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
      'Quick-cooking tapioca, for one reason that holds up: it sets clear rather than cloudy. Two arguments often made for it do not survive checking — acid does not meaningfully destroy cornstarch at berry pH, and native tapioca is actually the LESS shear- and heat-stable of the two. Cornstarch works; it just sets cloudy.',
  };
}
