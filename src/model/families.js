import { VERTICES, VERTEX_KEYS, INGREDIENT_FIELDS, SUGAR_BLEND } from './vertices.js';
import { morphology } from './morphology.js';
import { score, SCORE_DOMAIN } from './score.js';
import { POURED_VERTICES, POURED_KEYS, POURED_FIELDS, hydrationOf } from './poured/vertices.js';
import { pourMorphology } from './poured/morphology.js';
import { pouredScore, POURED_SCORE_DOMAIN } from './poured/score.js';

/**
 * The two technique families.
 *
 * A family is a complete, self-contained triangle: its own three vertices, its
 * own ingredient fields, its own morphology model, its own quality model and its
 * own display domain. What they SHARE is everything downstream of the topping —
 * the fruit, the dishes, the filling, the diet switches and the bake schedule.
 *
 * They are separate rather than joined because the survey says the region
 * between them is empty and the techniques on either side are discrete. See the
 * long note at the top of poured/vertices.js for the three reasons.
 *
 * ORDER OF THE KEYS matters: [left corner, top corner, right corner] as the
 * chart draws them, left-to-right along the increasing-hydration axis.
 */

const RUBBED = {
  key: 'rubbed',
  label: 'Rubbed & scattered',
  short: 'Rubbed',
  blurb:
    'Cold fat rubbed or cut into flour, and the result placed on the fruit. Crumble, crisp and drop-biscuit cobbler.',
  keys: VERTEX_KEYS,
  vertices: VERTICES,
  fields: INGREDIENT_FIELDS,
  physicalFields: [
    'bakedThicknessMm', 'rawDensity', 'ovenExpansion', 'ovenC', 'minutes', 'restMinutes',
  ],
  scoreDomain: SCORE_DOMAIN,
  liquidLabel: 'buttermilk',
  axisLabel: 'hydration →',
  // 60/40 light brown / white. The rubbed corpus is full of brown sugar and
  // demerara, and brown is what the crumble tradition reaches for.
  sugarBlend: SUGAR_BLEND,

  /** Buttermilk is the only water source here, plus whatever a vegan block adds. */
  hydration: (ing, fatBorneWater) => ing.buttermilk + fatBorneWater,

  morphology: ({ hydration }) => morphology(hydration),

  /**
   * Mass from target thickness x density / expansion. The indirection is
   * necessary because coverage varies from 95% to 41% across this triangle, so
   * mass cannot be read off the dish area.
   */
  mass: (dish, physical, morph) => {
    const bakedVolumeCm3 = dish.areaCm2 * morph.coverage * (physical.bakedThicknessMm / 10);
    return (bakedVolumeCm3 / physical.ovenExpansion) * physical.rawDensity;
  },

  score,

  presets: [
    { label: 'Crumble', coords: { crumble: 1, crisp: 0, cobbler: 0 } },
    { label: 'Crisp', coords: { crumble: 0, crisp: 1, cobbler: 0 } },
    { label: 'Cobbler', coords: { crumble: 0, crisp: 0, cobbler: 1 } },
    { label: 'Centre', coords: { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 } },
  ],
  tablePoints: [
    ['Crumble', { crumble: 1, crisp: 0, cobbler: 0 }],
    ['Crisp', { crumble: 0, crisp: 1, cobbler: 0 }],
    ['Cobbler', { crumble: 0, crisp: 0, cobbler: 1 }],
    ['Crumble / crisp midpoint', { crumble: 0.5, crisp: 0.5, cobbler: 0 }],
    ['Crisp / cobbler midpoint', { crumble: 0, crisp: 0.5, cobbler: 0.5 }],
    ['Crumble / cobbler midpoint', { crumble: 0.5, crisp: 0, cobbler: 0.5 }],
    ['Centroid', { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 }],
  ],
};

const POURED = {
  key: 'poured',
  label: 'Poured batter',
  short: 'Poured',
  blurb:
    'Melted fat and a pourable batter, assembled in layers that change places in the oven. Batter cobbler, sonker and pudding cake.',
  keys: POURED_KEYS,
  vertices: POURED_VERTICES,
  fields: POURED_FIELDS,
  physicalFields: ['loadGPerCm2', 'ovenExpansion', 'ovenC', 'minutes', 'restMinutes', 'prebakeFruit'],
  scoreDomain: POURED_SCORE_DOMAIN,
  liquidLabel: 'milk',
  axisLabel: 'sugar & liquid →',
  // Plain granulated, because that is what every poured source specifies —
  // ATK, King Arthur and the folk Magic Cobbler all use white. It is not a
  // stylistic choice carried over: at 80-165 parts sugar, molasses would drag
  // the glass transition down hard on the one surface this family lives or dies
  // by, and none of these recipes take that risk.
  sugarBlend: { lightBrown: 0, white: 1 },

  /** Egg carries most of the water at the pudding-cake corner. */
  hydration: (ing, fatBorneWater) => hydrationOf(ing) + fatBorneWater,

  morphology: ({ ingredients, leaveningPower, physical }) =>
    pourMorphology({ ingredients, leaveningPower, prebakeFruit: physical.prebakeFruit }),

  /** A poured batter covers the dish, so measured load per cm² is used directly. */
  mass: (dish, physical) => dish.areaCm2 * physical.loadGPerCm2,

  score: pouredScore,

  presets: [
    { label: 'Batter cobbler', coords: { batter: 1, sonker: 0, cake: 0 } },
    { label: 'Sonker', coords: { batter: 0, sonker: 1, cake: 0 } },
    { label: 'Pudding cake', coords: { batter: 0, sonker: 0, cake: 1 } },
    { label: 'Centre', coords: { batter: 1 / 3, sonker: 1 / 3, cake: 1 / 3 } },
  ],
  tablePoints: [
    ['Batter cobbler', { batter: 1, sonker: 0, cake: 0 }],
    ['Sonker', { batter: 0, sonker: 1, cake: 0 }],
    ['Pudding cake', { batter: 0, sonker: 0, cake: 1 }],
    ['Batter / sonker midpoint', { batter: 0.5, sonker: 0.5, cake: 0 }],
    ['Batter / cake midpoint', { batter: 0.5, sonker: 0, cake: 0.5 }],
    ['Sonker / cake midpoint', { batter: 0, sonker: 0.5, cake: 0.5 }],
    ['Centroid', { batter: 1 / 3, sonker: 1 / 3, cake: 1 / 3 }],
  ],
};

export const FAMILIES = { rubbed: RUBBED, poured: POURED };
export const FAMILY_KEYS = ['rubbed', 'poured'];
export const DEFAULT_FAMILY = RUBBED;

export function getFamily(key) {
  return FAMILIES[key] ?? DEFAULT_FAMILY;
}

/**
 * Which family a barycentric triple belongs to, inferred from its keys. Lets
 * callers pass coords around without also threading the family through.
 */
export function familyOf(coords) {
  return POURED_KEYS.some((k) => k in coords) ? POURED : RUBBED;
}
