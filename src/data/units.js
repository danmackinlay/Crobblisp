/**
 * Unit parsing and gram conversion, with per-source overrides.
 *
 * WHY THIS EXISTS AS CODE RATHER THAN A SPREADSHEET COLUMN.
 *
 * The survey behind this project was normalised by hand, and the provenance log
 * records two systematic problems that a hand pass cannot avoid:
 *
 *  1. **Sources disagree about what a cup weighs.** America's Test Kitchen calls
 *     a cup of flour 142 g; King Arthur calls it 120 g. That is an 18% spread on
 *     the denominator of every normalised figure, and it silently manufactured a
 *     fake pattern — ATK recipes looked structurally lower in oats than everyone
 *     else's, when much of the gap was their heavy flour cup.
 *
 *  2. **The same researcher used two different factors for the same ingredient**
 *     across two passes — 12.5 g/tbsp for demerara in one, 15 g/tbsp in another,
 *     never reconciled.
 *
 * So every conversion here records the factor it used and where that factor came
 * from. A figure you cannot reproduce is a figure you cannot defend.
 */

/** Default factors, in grams. Used when a source publishes none of its own. */
export const DEFAULT_FACTORS = {
  flour: { cup: 125 },
  'self-raising flour': { cup: 125 },
  'gluten-free flour': { cup: 125 },
  cornmeal: { cup: 140 },
  oats: { cup: 90 },
  'quick oats': { cup: 90 },
  sugar: { cup: 200, tbsp: 12.5, tsp: 4.17 },
  'brown sugar': { cup: 213, tbsp: 13.3125 },
  demerara: { cup: 200, tbsp: 12.5 },
  butter: { cup: 227.2, tbsp: 14.2, stick: 113.6 },
  shortening: { cup: 205, tbsp: 12.8 },
  buttermilk: { cup: 240 },
  milk: { cup: 240 },
  yogurt: { cup: 245 },
  'creme fraiche': { cup: 240 },
  cream: { cup: 238 },
  'half-and-half': { cup: 241 },
  'baking powder': { tsp: 4.0, tbsp: 12.0 },
  'baking soda': { tsp: 4.6, tbsp: 13.8 },
  salt: { tsp: 5.7, tbsp: 17.1 },
  'kosher salt': { tsp: 3.8 }, // midpoint of Diamond 2.8 / Morton 4.8 — see below
  xanthan: { tsp: 3.0 },
  nuts: { cup: 100 },
  'ground almonds': { cup: 95 },
  'sliced almonds': { tbsp: 6 },
  egg: { each: 50 },
  berries: { cup: 140 },
  blueberries: { cup: 148 },
  apples: { cup: 110 },
  peaches: { cup: 155 },
  rhubarb: { cup: 122 },
  cranberries: { cup: 120 },
};

/**
 * Ingredients whose default factor carries a known, irreducible ambiguity.
 * Anything converted with one of these is flagged, always.
 */
export const AMBIGUOUS = {
  'kosher salt':
    'Diamond Crystal ~2.8 g/tsp vs Morton ~4.8 g/tsp — a 1.7x spread. Midpoint used; the true value could be either end.',
  demerara:
    'A raw cane sugar, less dense than granulated; treated as granulated here, which slightly overstates its weight.',
  shortening: 'No published factor was available; 205 g/cup is an estimate.',
  nuts: 'Varies with nut and chop size; 100 g/cup is a rough middle.',
};

/**
 * Per-source published conventions. When a source states its own gram weight,
 * the source's figure wins and the discrepancy is recorded rather than smoothed.
 */
export const SOURCE_FACTORS = {
  atk: { flour: { cup: 142 }, 'brown sugar': { cup: 198 }, oats: { cup: 86 } },
  cooksillustrated: { flour: { cup: 141 }, 'brown sugar': { cup: 198 } },
  cookscountry: { flour: { cup: 141 }, oats: { cup: 85.3 } },
  kingarthur: { flour: { cup: 120 }, oats: { cup: 90 }, 'brown sugar': { cup: 213 }, sugar: { cup: 198 } },
  seriouseats: { flour: { cup: 148.8 } },
  dorie: { flour: { cup: 136 } },
  smittenkitchen: { flour: { cup: 122.8 } },
  sallys: { flour: { cup: 125 }, oats: { cup: 85 }, 'brown sugar': { cup: 200 } },
  inspiredtaste: { flour: { cup: 133.3 }, oats: { cup: 86.7 } },
  beyondkimchee: { flour: { cup: 120 } },
};

const UNICODE_FRACTIONS = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const UNIT_ALIASES = {
  cups: 'cup', c: 'cup',
  tablespoons: 'tbsp', tablespoon: 'tbsp', tbs: 'tbsp', t: 'tbsp', 'T': 'tbsp',
  teaspoons: 'tsp', teaspoon: 'tsp',
  sticks: 'stick',
  ounces: 'oz', ounce: 'oz',
  pounds: 'lb', pound: 'lb', lbs: 'lb',
  grams: 'g', gram: 'g',
  millilitres: 'ml', milliliters: 'ml',
  pints: 'pint',
};

/** Parse a quantity that may be a mixed number, a unicode fraction, or a range. */
export function parseQuantity(text) {
  const s = String(text).trim();

  // Ranges: "2½ to 3", "2-3", "1 to 1¼". Midpoint, flagged.
  const range = s.match(/^(.+?)\s*(?:to|–|—|-)\s*(.+)$/i);
  if (range && !/^\d+\/\d+$/.test(s)) {
    const lo = parseQuantity(range[1]);
    const hi = parseQuantity(range[2]);
    if (lo && hi && lo.value != null && hi.value != null) {
      return {
        value: (lo.value + hi.value) / 2,
        inferred: true,
        note: `midpoint of ${lo.value}–${hi.value}`,
      };
    }
  }

  // Bare decimal first. "0.5" would otherwise match the leading-whole-number
  // branch as "0" — the digit is followed by ".", which is neither a digit nor a
  // slash — set matched, and return zero. Caught by test, not by inspection.
  if (/^\d*\.\d+$/.test(s)) return { value: Number(s), inferred: false };

  let total = 0;
  let matched = false;

  // Leading whole number
  const whole = s.match(/^(\d+)(?![\d/.])/);
  if (whole) {
    total += Number(whole[1]);
    matched = true;
  }

  // Unicode fraction anywhere
  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(glyph)) {
      total += val;
      matched = true;
    }
  }

  // ASCII fraction "3/4"
  const ascii = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (ascii) {
    total += Number(ascii[1]) / Number(ascii[2]);
    matched = true;
  }

  // Bare decimal
  if (!matched) {
    const dec = s.match(/^(\d*\.?\d+)$/);
    if (dec) {
      total = Number(dec[1]);
      matched = true;
    }
  }

  if (!matched) return { value: null, inferred: false, note: 'unparsed' };
  return { value: total, inferred: false };
}

export function normaliseUnit(unit) {
  if (!unit) return null;
  const u = String(unit).trim().replace(/\.$/, '');
  return UNIT_ALIASES[u] ?? UNIT_ALIASES[u.toLowerCase()] ?? u.toLowerCase();
}

/**
 * Convert an amount to grams.
 * Returns the grams AND the factor used AND where that factor came from, so the
 * whole conversion is reproducible from the record alone.
 */
export function toGrams({ quantity, unit, ingredient, sourceId }) {
  const q = typeof quantity === 'number' ? { value: quantity, inferred: false } : parseQuantity(quantity);
  if (q.value == null) {
    return { grams: null, factor: null, factorFrom: null, inferred: true, note: 'unparsed quantity' };
  }

  const u = normaliseUnit(unit);
  const flags = [];
  if (q.inferred) flags.push(q.note);

  // Mass units need no factor at all.
  if (u === 'g') return { grams: q.value, factor: 1, factorFrom: 'stated', inferred: q.inferred, notes: flags };
  if (u === 'oz') return { grams: q.value * 28.3495, factor: 28.3495, factorFrom: 'exact', inferred: q.inferred, notes: flags };
  if (u === 'lb') return { grams: q.value * 453.592, factor: 453.592, factorFrom: 'exact', inferred: q.inferred, notes: flags };
  if (u === 'ml') return { grams: q.value, factor: 1, factorFrom: 'assumed density 1.0', inferred: true, notes: [...flags, 'ml treated as g'] };

  const key = ingredient;
  const sourceTable = sourceId ? SOURCE_FACTORS[sourceId] : null;
  const fromSource = sourceTable?.[key]?.[u];
  const fromDefault = DEFAULT_FACTORS[key]?.[u];
  const factor = fromSource ?? fromDefault;

  if (factor == null) {
    return { grams: null, factor: null, factorFrom: null, inferred: true, notes: [...flags, `no factor for ${key}/${u}`] };
  }

  if (AMBIGUOUS[key]) flags.push(AMBIGUOUS[key]);

  return {
    grams: q.value * factor,
    factor,
    factorFrom: fromSource != null ? `source:${sourceId}` : 'default',
    inferred: q.inferred || Boolean(AMBIGUOUS[key]),
    notes: flags,
  };
}

/** How far a source's own convention departs from the project default. */
export function conventionDelta(sourceId, ingredient, unit) {
  const u = normaliseUnit(unit);
  const src = SOURCE_FACTORS[sourceId]?.[ingredient]?.[u];
  const def = DEFAULT_FACTORS[ingredient]?.[u];
  if (src == null || def == null) return null;
  return { source: src, default: def, pctDelta: ((src - def) / def) * 100 };
}
