import { toGrams, conventionDelta } from './units.js';

/**
 * Standardised extractor: verbatim recipe lines in, normalised figures out.
 *
 * The raw records are the source of truth. Every derived number in the CSV is
 * regenerated from them, so a disputed figure can be traced to the line it came
 * from and the factor that converted it — which is exactly what the hand-built
 * survey could not do.
 *
 * BASIS: flour + oats = 100, matching the model. Note the corpus itself argues
 * against treating that basis as universal — five canonical "crisps" contain no
 * oats and use nuts as the structural filler instead — so `nuts` is carried
 * through as a first-class column rather than discarded.
 */

const TOPPING_ROLES = {
  flour: 'flour',
  'self-raising flour': 'flour',
  'gluten-free flour': 'flour',
  cornmeal: 'flour',
  'almond flour': 'flour',
  oats: 'oats',
  'quick oats': 'oats',
  butter: 'fat',
  shortening: 'fat',
  sugar: 'sugarWhite',
  demerara: 'sugarBrown',
  'brown sugar': 'sugarBrown',
  salt: 'salt',
  'kosher salt': 'salt',
  buttermilk: 'liquid',
  milk: 'liquid',
  yogurt: 'liquid',
  'creme fraiche': 'liquid',
  cream: 'liquid',
  'half-and-half': 'liquid',
  'baking powder': 'bakingPowder',
  'baking soda': 'bakingSoda',
  egg: 'egg',
  nuts: 'nuts',
  'ground almonds': 'nuts',
  'sliced almonds': 'nuts',
};

const EMPTY_TOTALS = () => ({
  flour: 0, oats: 0, fat: 0, sugarWhite: 0, sugarBrown: 0, salt: 0,
  liquid: 0, bakingPowder: 0, bakingSoda: 0, egg: 0, nuts: 0, other: 0,
});

function sumLines(lines, sourceId) {
  const totals = EMPTY_TOTALS();
  const trace = [];
  const inferred = [];

  for (const line of lines ?? []) {
    if (line.exclude) {
      trace.push({ ...line, grams: null, excluded: true });
      continue;
    }
    const conv = toGrams({
      quantity: line.qty,
      unit: line.unit,
      ingredient: line.ingredient,
      sourceId,
    });
    const role = TOPPING_ROLES[line.ingredient] ?? 'other';
    if (conv.grams != null) totals[role] += conv.grams;

    const delta = conventionDelta(sourceId, line.ingredient, line.unit);
    trace.push({
      verbatim: line.verbatim,
      ingredient: line.ingredient,
      role,
      grams: conv.grams,
      factor: conv.factor,
      factorFrom: conv.factorFrom,
      conventionDelta: delta ? Number(delta.pctDelta.toFixed(1)) : null,
      notes: conv.notes ?? [],
    });
    if (conv.inferred || conv.grams == null) {
      inferred.push(`${line.ingredient}: ${(conv.notes ?? []).join('; ') || 'inferred'}`);
    }
  }

  return { totals, trace, inferred };
}

const round = (v, dp = 2) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(dp)));

export function extract(record) {
  const { totals, trace, inferred } = sumLines(record.topping, record.sourceId);
  const fruit = sumLines(record.fruit, record.sourceId);

  const basis = totals.flour + totals.oats;
  const per100 = (v) => (basis > 0 ? round((v / basis) * 100) : null);

  const sugarTotal = totals.sugarWhite + totals.sugarBrown;
  const toppingG = Object.values(totals).reduce((a, b) => a + b, 0);
  const fruitG = Object.values(fruit.totals).reduce((a, b) => a + b, 0);
  const areaCm2 = record.dish?.areaCm2 ?? null;

  // Soda-to-liquid, the stoichiometric check. Only defined against an ACIDIC
  // liquid: cream and plain milk contribute essentially nothing to neutralising
  // bicarbonate, so a ratio computed against them is meaningless.
  const acidicLiquid = (record.topping ?? [])
    .filter((l) => ['buttermilk', 'yogurt', 'creme fraiche'].includes(l.ingredient))
    .reduce((sum, l) => {
      const g = toGrams({ quantity: l.qty, unit: l.unit, ingredient: l.ingredient, sourceId: record.sourceId });
      return sum + (g.grams ?? 0);
    }, 0);

  return {
    id: record.id,
    corpus: record.corpus,
    source: record.source,
    title: record.title,
    url: record.url,
    tier: record.tier,
    retrieval: record.retrieval,
    ratingStars: record.rating?.stars ?? null,
    ratingCount: record.rating?.count ?? null,

    // Absolute grams
    flourG: round(totals.flour, 1),
    oatsG: round(totals.oats, 1),
    fatG: round(totals.fat, 1),
    sugarG: round(sugarTotal, 1),
    saltG: round(totals.salt, 2),
    liquidG: round(totals.liquid, 1),
    bakingPowderG: round(totals.bakingPowder, 2),
    bakingSodaG: round(totals.bakingSoda, 2),
    nutsG: round(totals.nuts, 1),
    eggG: round(totals.egg, 1),
    toppingG: round(toppingG, 1),
    fruitG: round(fruitG, 1),

    // Normalised to flour + oats = 100
    basisG: round(basis, 1),
    oatFractionPct: basis > 0 ? round((totals.oats / basis) * 100) : null,
    fatPct: per100(totals.fat),
    sugarPct: per100(sugarTotal),
    sugarBrownPct: per100(totals.sugarBrown),
    saltPct: per100(totals.salt),
    liquidPct: per100(totals.liquid),
    bakingPowderPct: per100(totals.bakingPowder),
    bakingSodaPct: per100(totals.bakingSoda),
    nutsPct: per100(totals.nuts),

    // Scale
    dish: record.dish?.label ?? null,
    areaCm2,
    loadGPerCm2: areaCm2 ? round(toppingG / areaCm2, 3) : null,
    fruitToToppingRatio: toppingG > 0 && fruitG > 0 ? round(fruitG / toppingG) : null,

    // Bake
    ovenC: record.bake?.ovenC ?? null,
    bakeMinutes: record.bake?.minutes ?? null,
    restMinutes: record.bake?.restMin ?? null,
    prebakeFruit: record.bake?.prebake ?? null,
    butterState: record.butterState ?? null,

    // Chemistry check
    sodaToAcidLiquid: acidicLiquid > 0 ? round(totals.bakingSoda / acidicLiquid, 5) : null,
    acidLiquidG: round(acidicLiquid, 1),

    // Provenance
    inferredFields: inferred.join(' | ') || '',
    excluded: record.excluded ?? false,
    exclusionReason: record.exclusionReason ?? '',
    flags: (record.flags ?? []).join('; '),
    notes: record.notes ?? '',

    _trace: trace,
  };
}

export function extractAll(records) {
  return records.map(extract);
}

/** Median that ignores nulls, so a missing figure does not become a zero. */
export function median(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function summarise(rows, field, { includeExcluded = false } = {}) {
  const usable = rows.filter((r) => (includeExcluded || !r.excluded) && r[field] != null);
  const values = usable.map((r) => r[field]);
  if (!values.length) return { field, n: 0, median: null, min: null, max: null };
  return {
    field,
    n: values.length,
    median: round(median(values)),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    spread: round(Math.max(...values) / Math.min(...values)),
  };
}
