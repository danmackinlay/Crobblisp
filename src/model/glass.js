/**
 * Glass transition, from the Gordon-Taylor equation rather than a linear rule.
 *
 * WHY THIS REPLACED A CONSTANT
 *
 * The crispness model rested on "Tg falls roughly 10 °C per 1% added water",
 * carried from a single secondary source that was never traced to a primary.
 * Running the Gordon-Taylor fit numerically shows the rule is not a constant at
 * all — it is the tangent at bone-dry, and even there it is 8.9, not 10:
 *
 *     water %   Tg (°C)   ΔTg for that 1%
 *        0       62.0        —
 *        1       53.1      -8.9
 *        2       44.8      -8.3
 *        5       22.9      -6.8
 *       10       -5.6      -5.1
 *
 * Averaged 0→5% the true slope is -7.8 °C/%; 0→10% it is -6.8. Using the linear
 * rule at realistic topping moisture overstates the depression by about 40%.
 *
 * PARAMETERS, and their standing:
 *   Tg sucrose (anhydrous) = 62 °C — CONFIRMED against two independent sources,
 *     including an experimental fit of Tgs = 65.2 °C, k = 4.68 for pure sucrose.
 *   Tg water = -135 °C, k = 4.7 — the standard sucrose/water parameter set.
 *
 * Note sucrose alone spans 56.6-70 °C across the literature depending on method
 * and residual sample water, so a single quoted Tg carries ±5-7 °C inherently.
 * Do not read the outputs here to better than a few degrees.
 */

/** The standard sucrose/water parameter set. */
export const SUCROSE = { tgAnhydrousC: 62, tgWaterC: -135, k: 4.7 };

/**
 * Gordon-Taylor. Returns Tg in °C for a sugar/water mixture.
 *
 * This form is a weighted average, so computing in °C and in K gives identical
 * answers — verified numerically. There is no unit trap here.
 *
 * @param {number} waterFraction  mass fraction of water, 0..1
 */
export function glassTransitionC(waterFraction, params = SUCROSE) {
  const ww = Math.max(0, Math.min(1, waterFraction));
  const ws = 1 - ww;
  const { tgAnhydrousC, tgWaterC, k } = params;
  return (ws * tgAnhydrousC + k * ww * tgWaterC) / (ws + k * ww);
}

/** Water fraction at which Tg crosses a given temperature. Inverse of the above. */
export function waterAtGlassTransition(targetC, params = SUCROSE) {
  const { tgAnhydrousC, tgWaterC, k } = params;
  const num = tgAnhydrousC - targetC;
  const den = num + k * (targetC - tgWaterC);
  return den === 0 ? null : num / den;
}

/**
 * Useful anchors, all derived from the above rather than asserted:
 *   Tg crosses 25 °C at 4.7% water — a topping wetter than this is rubbery at
 *   room temperature, not brittle.
 *   Tg crosses  0 °C at 8.9% water.
 */
export const ANCHORS = {
  roomTemperatureC: 25,
  waterAtRoomTemperature: waterAtGlassTransition(25),
  waterAtFreezing: waterAtGlassTransition(0),
};

/**
 * Crispness driver: how far the sugar phase sits BELOW its glass transition at
 * serving temperature. Positive means glassy and brittle; negative means
 * rubbery, which is what a stale or damp topping is.
 *
 * Normalised over a 20 °C span: a phase sitting 20 °C below its transition is
 * solidly glassy, and there is nothing to gain from being colder still. An
 * earlier version used 45 °C — the margin a BONE-DRY phase has — which scored a
 * real baked crumble at 2% moisture as only 0.44 brittle despite it sitting a
 * comfortable 20 °C below Tg. That was a normalisation error, not a physical
 * finding, and it dragged the dry corners down.
 *
 * The useful consequence of the real curve is how NARROW the transition is:
 * 2% water is fully brittle, 4.7% is exactly at room temperature, and past 5% it
 * is rubbery. Two and a half points of moisture separate crisp from limp — which
 * is why crispness is fragile and why a topping that touches wet fruit is lost.
 */
export function brittleness(waterFraction, servingC = 25, params = SUCROSE) {
  const margin = glassTransitionC(waterFraction, params) - servingC;
  return Math.max(0, Math.min(1, margin / 20));
}

/**
 * Critical water activity for loss of crispness is ~0.5 (organoleptic
 * unacceptability generally 0.35-0.50). Sensory crispness declines only slightly
 * from aw 0 to 0.50 — about 7% water — then falls very rapidly. The mechanism is
 * exactly the plasticisation above: Tg driven below ambient.
 */
export const CRITICAL_WATER_ACTIVITY = 0.5;

/**
 * Browning has a DUAL threshold, and this is stronger than the argument the
 * model was making. Crust colour formation requires BOTH:
 *
 *   surface temperature > 120 °C   AND   water activity < 0.6
 *
 * Either condition alone blocks it. A topping in contact with wet fruit fails
 * both simultaneously — the interface is pinned near 100 °C by evaporation, and
 * it is saturated. So the claim that such a topping cannot brown is not merely
 * supported, it is over-determined.
 */
export const BROWNING_THRESHOLD = { minSurfaceC: 120, maxWaterActivity: 0.6 };
