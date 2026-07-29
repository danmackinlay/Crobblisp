/**
 * Bake records: what actually came out of the oven.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * This model's single largest weakness is named in three separate places. The
 * crumble corner has NO recipe rated 4.5 stars or better anywhere in the corpus.
 * Not one poured or sonker source carries a rating at all, which is why that
 * whole family is uncalibrated and gets its own colour scale. And SOURCES §9.4
 * records that filling set is a two-sided target the model scores neither side
 * of, because nothing measured it.
 *
 * Every one of those is a missing-outcome problem, and no amount of further
 * recipe surveying fixes it — published recipes report what their author did,
 * not how it turned out for someone else. The only thing that closes the gap is
 * somebody baking a point and saying what happened.
 *
 * So a record pairs a PREDICTION with an OUTCOME, and is designed to be able to
 * embarrass the model. That is the point of it.
 * ---------------------------------------------------------------------------
 *
 * WHAT IS STORED, AND WHY EACH PART IS NECESSARY
 *
 *  point     — where on which triangle. Not sufficient on its own: barycentric
 *              coordinates only identify a recipe RELATIVE to the vertices, and
 *              the vertices have already been revised once (they were eyeballed,
 *              and ran systematically low on fat and sugar at all three corners).
 *              A record keyed only on coordinates would silently change meaning.
 *  resolved  — the actual quantities baked, frozen at submission. This is what
 *              makes the record survive a vertex revision.
 *  predicted — the model's score AND its per-component breakdown, so a rating
 *              can be checked against the specific term that claimed it. Carries
 *              a fingerprint of the vertices, so nobody can attribute an old
 *              rating to a newer model by accident.
 *  outcome   — the new information. A rating, structured observations keyed to
 *              the model's own claims, and free text.
 *  deviations— the honesty field. A record of a bake that changed the recipe is
 *              still useful, but only if the change is known.
 *
 * WHAT IS DELIBERATELY NOT STORED: any identifying information. No name, no
 * email, no location. If a record is contributed as a pull request then GitHub
 * attributes it to whoever opens it, which is their choice to make at that point
 * and not something this file should pre-empt.
 */

export const BAKE_SCHEMA = 'crobble-bake/1';

/**
 * Structured observations, keyed to the score components they bear on.
 *
 * Free text is worth having, but it cannot be counted. The review-mining pass on
 * the Food.com corpus is the cautionary tale: 43.5% of "too sweet" matches were
 * actually "NOT too sweet" — praise read as complaint — and 24.7% of "dry" hits
 * were the phrase "dry ingredients". Asking directly avoids inventing a parser
 * whose failure modes are already documented.
 *
 *   component — the score term this observation tests
 *   polarity  — 'good' if observing it means the term was RIGHT to score high
 */
const SHARED_OBSERVATIONS = [
  { key: 'filling-runny', label: 'Filling was runny', component: null, polarity: 'bad' },
  { key: 'filling-too-set', label: 'Filling was stiff or gluey', component: null, polarity: 'bad' },
  { key: 'filling-just-set', label: 'Filling set just right', component: null, polarity: 'good' },
];

const RUBBED_OBSERVATIONS = [
  { key: 'top-crisp', label: 'Top was crisp and well browned', component: 'surfaceCrisp', polarity: 'good' },
  { key: 'top-pale', label: 'Top stayed pale or soft', component: 'surfaceCrisp', polarity: 'bad' },
  { key: 'clumps-held', label: 'Held its craggy clumps', component: 'depth', polarity: 'good' },
  { key: 'powdery', label: 'Powdery or floury in places', component: 'cohesion', polarity: 'bad' },
  { key: 'gummy-underneath', label: 'Raw or gummy where it met the fruit', component: 'cooked', polarity: 'bad' },
  { key: 'soggy-underside', label: 'Underside was wet (but cooked)', component: 'underside', polarity: 'bad' },
  { key: 'spread-flat', label: 'Spread flat instead of holding height', component: 'height', polarity: 'bad' },
  { key: 'both-textures', label: 'Crisp on top AND tender underneath', component: 'stratification', polarity: 'good' },
];

const POURED_OBSERVATIONS = [
  { key: 'lid-crisp', label: 'Thin crisp sugary lid on top', component: 'lid', polarity: 'good' },
  { key: 'lid-pale', label: 'Top stayed pale or soft', component: 'lid', polarity: 'bad' },
  { key: 'inverted', label: 'Batter rose up through the fruit', component: 'inversion', polarity: 'good' },
  { key: 'stayed-under', label: 'Batter stayed under the fruit', component: 'inversion', polarity: 'bad' },
  { key: 'gummy-centre', label: 'Gummy or raw in the middle', component: 'set', polarity: 'bad' },
  { key: 'set-through', label: 'Cooked through and tender', component: 'set', polarity: 'good' },
  { key: 'batter-drowned', label: 'Batter went pasty against the fruit', component: 'dilution', polarity: 'bad' },
  { key: 'steamed-underside', label: 'Underside steamed and soft (and I liked it)', component: 'set', polarity: 'good' },
];

export function observationsFor(familyKey) {
  const own = familyKey === 'poured' ? POURED_OBSERVATIONS : RUBBED_OBSERVATIONS;
  return [...own, ...SHARED_OBSERVATIONS];
}

/**
 * `steamed-underside` is not a mistake in the list above.
 *
 * The sonker's source describes the underside steamed "like a dumpling" as the
 * GOAL, and the model currently cannot tell that apart from a gummy failure —
 * documented as an unresolved argument in poured/score.js. Offering it as a
 * separate, positively-worded option is the cheapest way to find out which of
 * the two readings is right, and it is the observation most likely to overturn
 * something in this model.
 */
export const CONTESTED_OBSERVATIONS = ['steamed-underside', 'soggy-underside'];

const OVEN_TYPES = ['unknown', 'conventional', 'fan', 'gas'];

/** FNV-1a, 32-bit. Short, deterministic, and not pretending to be a checksum. */
function fingerprint(obj) {
  const s = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * A fingerprint of the vertex values a prediction was made against.
 *
 * Computed rather than hand-versioned, because a hand-maintained version number
 * goes stale exactly when it matters — somebody edits a vertex and forgets to
 * bump it, and every prior rating silently reattributes to the new model. This
 * cannot go stale: change a vertex, the fingerprint changes.
 */
export function vertexFingerprint(family) {
  return fingerprint(
    family.keys.map((k) => [k, family.vertices[k].ingredients, family.vertices[k].physical]),
  );
}

const round = (v, dp = 3) => (typeof v === 'number' ? Number(v.toFixed(dp)) : v);

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/**
 * Build a complete record from a rendered recipe plus what the baker reported.
 *
 * `recipe` is the object buildRecipe() returns, so the resolved quantities and
 * the prediction are taken from the same evaluation the person actually cooked
 * from — not recomputed later against whatever the model has become.
 */
export function buildBakeRecord(recipe, outcome, { now = new Date(), family } = {}) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10);
  const t = recipe.topping;

  const components = {};
  for (const [key, c] of Object.entries(recipe.score.components)) {
    if (c.weight > 0.01) components[key] = round(c.value);
  }

  const point = {
    family: recipe.family.key,
    coords: Object.fromEntries(
      Object.entries(recipe.coords).map(([k, v]) => [k, round(v, 4)]),
    ),
    berry: recipe.context.berry.key,
    dish: recipe.context.dish.key,
    diet: { vegan: !!recipe.diet.vegan, glutenFree: !!recipe.diet.glutenFree },
  };

  const record = {
    schema: BAKE_SCHEMA,
    id: `${day}-${point.family}-${slugify(recipe.naming.name)}-${fingerprint([point, iso]).slice(0, 4)}`,
    submittedAt: iso,
    bakedOn: outcome.bakedOn || day,

    point,

    // Frozen so the record survives a vertex revision. Coordinates alone would
    // not: they identify a recipe only relative to vertices that have already
    // been revised once.
    resolved: {
      basisPer100: Object.fromEntries(
        Object.entries(recipe.basis).map(([k, v]) => [k, round(v, 2)]),
      ),
      grams: {
        total: round(t.totalG, 1),
        flour: round(t.flourG, 1),
        oats: round(t.oatsG, 1),
        butter: round(t.butterG, 1),
        sugar: round(t.sugarTotalG, 1),
        liquid: round(t.buttermilkG, 1),
        egg: round(t.eggG, 1),
        salt: round(t.saltG, 2),
      },
      hydration: round(recipe.axes.hydration, 1),
      loadGPerCm2: round(t.totalG / recipe.context.dish.areaCm2, 3),
      morphology: recipe.morphology.regime,
      assembly: recipe.morphology.assembly?.key ?? null,
      ovenC: recipe.bake.celsius,
      bakeMinutes: recipe.bake.totalMinutes,
      prebakeMinutes: recipe.bake.prebakeMinutes,
      restMinutes: recipe.bake.restMinutes,
    },

    predicted: {
      overall: round(recipe.score.overall),
      components,
      scoreDomain: recipe.scoreDomain,
      // Which vertices produced this prediction. See vertexFingerprint().
      vertices: family ? vertexFingerprint(family) : null,
      // Stated on every poured record, because the surface has no rating data
      // behind it and a contributed score must not be read as confirming a
      // calibration that was never performed.
      calibrated: recipe.family.key !== 'poured',
    },

    outcome: {
      rating: Number(outcome.rating),
      wouldBakeAgain: outcome.wouldBakeAgain ?? null,
      observations: [...new Set(outcome.observations ?? [])].sort(),
      ovenType: OVEN_TYPES.includes(outcome.ovenType) ? outcome.ovenType : 'unknown',
      // The honesty field. A deviated bake is still useful data; an UNDECLARED
      // deviated bake is worse than no data, because it looks clean.
      followedRecipe: outcome.followedRecipe ?? null,
      deviations: (outcome.deviations || '').trim() || null,
      review: (outcome.review || '').trim() || null,
    },
  };

  return record;
}

/** Everything that must hold before a record is worth contributing. */
export function validateBakeRecord(rec) {
  const errors = [];
  if (rec?.schema !== BAKE_SCHEMA) errors.push(`schema must be "${BAKE_SCHEMA}"`);
  const r = rec?.outcome?.rating;
  if (!Number.isFinite(r) || r < 1 || r > 5) errors.push('rating must be 1-5');
  if (!rec?.point?.family) errors.push('missing family');
  if (!rec?.resolved?.grams?.total) errors.push('missing resolved quantities');
  if (rec?.outcome?.followedRecipe === false && !rec?.outcome?.deviations) {
    errors.push('say what you changed, or the record cannot be interpreted');
  }
  const valid = new Set(observationsFor(rec?.point?.family).map((o) => o.key));
  for (const o of rec?.outcome?.observations ?? []) {
    if (!valid.has(o)) errors.push(`unknown observation "${o}"`);
  }
  return { ok: errors.length === 0, errors };
}

/** One file per bake — two contributors never touch the same file, so no conflicts. */
export function recordFilename(rec) {
  return `data/bakes/${rec.id}.json`;
}

export function recordJson(rec) {
  return JSON.stringify(rec, null, 2) + '\n';
}

/**
 * A GitHub "create new file" URL, prefilled.
 *
 * This opens GitHub's own web editor with the record already in it. The person
 * reviews it, commits, and GitHub offers to open a pull request. Nothing is sent
 * anywhere by this app, no credentials are involved, and no request is made on
 * anyone's behalf — the link just opens a page.
 *
 * Returns null past a conservative length limit; browsers and proxies start
 * truncating long URLs and a silently truncated record would be worse than
 * falling back to the file download.
 */
export const REPO = 'bluewin4/Crobblisp';
const URL_LIMIT = 6000;

export function pullRequestUrl(rec, { repo = REPO, branch = 'main' } = {}) {
  const params = new URLSearchParams({
    filename: recordFilename(rec),
    value: recordJson(rec),
    message: `Add bake record: ${rec.point.family} ${rec.outcome.rating}/5`,
    description:
      'Submitted from the Crobble UI. Pairs the model prediction at bake time with what actually came out of the oven.',
  });
  const url = `https://github.com/${repo}/new/${branch}?${params}`;
  return url.length > URL_LIMIT ? null : url;
}
