import { clamp01 } from './blend-util.js';

/**
 * Dietary substitutions.
 *
 * These are chemistry, not relabelling. Each swap changes something the rest of
 * the model reads — the acid budget, the water the fat carries in, the binder
 * requirement — and the quality surface moves accordingly. Two results fall out
 * that are worth knowing before you cook:
 *
 *  - GLUTEN-FREE is nearly free at the crumble and crisp corners and costs real
 *    quality at the cobbler corner. In a dry topping, flour is inert filler that
 *    absorbs fat and sets into a sandy matrix; you are actively avoiding gluten
 *    development anyway. In a drop biscuit, gluten is a primary structure former
 *    and xanthan only recovers most of it.
 *
 *  - VEGAN makes the soda guard fire for the first time. Soured soy milk carries
 *    roughly 55% of buttermilk's acid capacity, so part of the bicarbonate has
 *    no acid to react with and is converted to baking powder. Total lift is
 *    preserved; the conversion is what preserves it.
 */

export const DEFAULT_DIET = { vegan: false, glutenFree: false };

/** Dairy butter is ~81% fat / ~16% water. A firm vegan block runs leaner and wetter. */
const BUTTER_FAT = 0.81;
const BUTTER_WATER = 0.16;
const VEGAN_BLOCK_FAT = 0.78;
const VEGAN_BLOCK_WATER = 0.2;

/**
 * Acid capacity of the vegan liquid, relative to buttermilk.
 *
 * Buttermilk: 240 g neutralises 1.79 g soda (see SODA_PER_G_BUTTERMILK).
 * Soured soy milk: 15 g lemon juice at ~4.9% citric acid = 0.735 g citric acid.
 * Citric is triprotic and all three protons count at the pH 8.3 endpoint:
 *   0.735 / 192.12 = 0.00383 mol x 3 = 0.0115 eq -> 0.96 g soda
 *   0.96 / 1.79 = 0.54
 *
 * IMPORTANT, and the opposite of the usual folk explanation: essentially ALL of
 * that capacity comes from the LEMON JUICE, not the milk. Soy protein is
 * amphoteric and contributes negligible buffering, so swapping soy for almond or
 * oat changes the soda budget by approximately nothing. The visible curdling is
 * a symptom of the acid, not a source of it.
 *
 * Soy is still the right choice here — just for different reasons. See the
 * substitution note below.
 */
export const VEGAN_ACID_CAPACITY = 0.54;
const SOY_FRACTION = 0.94;
const LEMON_FRACTION = 0.06;

export function dietKey(diet) {
  return `${diet.vegan ? 'v' : '-'}${diet.glutenFree ? 'g' : '-'}`;
}

/**
 * Applied to the blended basis before the constraint pass, because the vegan
 * swap changes the acid ceiling the constraint pass enforces.
 */
export function applyDiet(ingredients, diet) {
  const out = { ...ingredients };
  const subs = [];
  const additions = {};
  let acidCapacity = 1;

  if (diet.vegan) {
    // Match fat content rather than gross weight — a leaner block needs more of
    // it, and brings more water along with the extra mass.
    const before = out.butter;
    out.butter = before * (BUTTER_FAT / VEGAN_BLOCK_FAT);
    const extraWater = out.butter * VEGAN_BLOCK_WATER - before * BUTTER_WATER;
    out.buttermilk += extraWater;

    acidCapacity = VEGAN_ACID_CAPACITY;

    // Restore the missing Maillard reactants rather than trying to fake the
    // conditions. Milk powder supplies both halves — protein and reducing sugar —
    // at 1-3% of flour weight; 2% is the middle of that range.
    additions.soyMilkPowder = out.flour * 0.02;

    subs.push({
      from: 'Butter',
      to: 'Firm vegan baking block, ≥75% fat, cold',
      why: `Weight raised ${(((BUTTER_FAT / VEGAN_BLOCK_FAT) - 1) * 100).toFixed(0)}% to match fat content. A soft tub spread will not work here — too little fat and far too much water to rub or cut in.`,
    });
    subs.push({
      from: 'Buttermilk',
      to: 'Soy milk soured with lemon juice',
      why: 'The acid comes from the lemon, not the milk — swapping soy for almond would barely change the soda budget. Soy is here for its protein (~3.3%, close to dairy): amino groups for browning, body in the crumb, and lecithin to hold the fat. It carries ~54% of buttermilk\'s acid capacity, which tightens the soda budget below.',
    });
    subs.push({
      from: "Butter's milk solids",
      to: 'Soy milk powder',
      why: 'Browning is Maillard between lactose and the lysine on casein, so losing milk solids costs colour and savoury depth. Milk powder is the efficient fix because it restores BOTH halves of the reaction — protein and reducing sugar. Adding brown sugar alone pushes toward caramelisation instead, and costs crunch.',
    });
  }

  if (diet.glutenFree) {
    // GF blends are thirstier and continue absorbing after mixing, which is why
    // the rest is mandatory rather than optional.
    out.buttermilk *= 1.06;

    // Xanthan, but only where there is actually structure to hold.
    //
    // What rises across the published series (cookies 0.5% -> cakes 1% -> bread
    // 2% of flour) is not hydration as such but STRUCTURAL DEMAND: gas-cell
    // stabilisation and extensibility. Hydration is a decent proxy for it here
    // because this triangle's wet end is also its only leavened end.
    //
    // A dry crumble topping gets NONE, and that is a deliberate correction
    // rather than a rounding-down. Crumble is meant to be non-cohesive rubble:
    // no gas to retain, no crumb to bind. Worse, xanthan's whole function is
    // holding water, and held water is exactly what depresses the glass
    // transition and destroys the brittleness crunch depends on. Xanthan in a
    // crumble topping actively makes it worse.
    const structuralDemand = clamp01((out.buttermilk - 12) / 68);
    const xanthanPct = 1.1 * structuralDemand;
    additions.xanthan = out.flour * (xanthanPct / 100);

    subs.push({
      from: 'Plain flour',
      to: 'Gluten-free 1:1 blend',
      why: 'Weight for weight. In the dry corners flour is inert filler that absorbs fat and sets into a sandy matrix, so this swap costs almost nothing; toward the cobbler corner it is giving up a structure former and the cost is real.',
    });
    if (xanthanPct > 0.02) {
      subs.push({
        from: 'Gluten',
        to: `Xanthan gum, ${xanthanPct.toFixed(2)}% of the flour`,
        why: 'Buys back cohesion and water-binding. It cannot buy back strain hardening — gluten stiffens as it stretches, letting a bubble wall thin without tearing, whereas xanthan shear-thins. That is why the spring never fully returns.',
      });
    } else {
      subs.push({
        from: 'Gluten',
        to: 'Nothing — deliberately',
        why: 'A crumble topping is meant to be loose rubble, so there is no crumb to bind and no gas to trap. Xanthan would only hold water, and held water lowers the glass transition that the crunch depends on.',
      });
    }
  }

  return { ingredients: out, additions, subs, acidCapacity };
}

/** Diet-dependent adjustments to the quality model. */
export function dietScoreModifiers(diet, hydration) {
  const wetness = clamp01(hydration / 80);
  return {
    // No milk solids means less Maillard, so less of the deep-browned crunch
    // that a crumble or crisp is judged on. The brown-sugar shift recovers some.
    crunchFactor: diet.vegan ? 0.95 : 1,
    // Losing gluten costs oven spring, and only where there was spring to lose.
    springFactor: diet.glutenFree ? 1 - 0.15 * wetness : 1,
    // Xanthan holds most of the shape gluten was holding, but not all of it.
    structurePenalty: diet.glutenFree ? 0.06 * wetness : 0,
  };
}

export function dietLabels(diet) {
  return {
    flour: diet.glutenFree ? 'Gluten-free 1:1 flour blend' : 'Plain flour',
    oats: diet.glutenFree ? 'Certified gluten-free rolled oats' : 'Rolled oats',
    butter: diet.vegan
      ? 'Cold vegan baking block (≥75% fat), diced'
      : 'Cold unsalted butter, diced',
    buttermilk: diet.vegan ? 'Soy milk, cold' : 'Buttermilk, cold',
  };
}

/** Split the liquid into its two vegan components for the ingredient list. */
export function splitLiquid(totalG, diet) {
  if (!diet.vegan) return null;
  return {
    soyG: totalG * SOY_FRACTION,
    lemonG: totalG * LEMON_FRACTION,
  };
}

export function dietNotes(diet) {
  const notes = [];
  if (diet.glutenFree) {
    notes.push(
      'Rest the mixture 20-30 minutes before shaping. Gluten-free blends keep absorbing water after mixing; skip the rest and the topping bakes gritty.',
    );
  }
  if (diet.vegan) {
    notes.push(
      'Sour the soy milk first: stir in the lemon juice and leave it 10 minutes until it thickens and flecks, then use it cold.',
    );
    notes.push(
      'Expect a paler top. Give it the last 5 minutes on the upper shelf rather than pulling it early on colour.',
    );
  }
  return notes;
}
