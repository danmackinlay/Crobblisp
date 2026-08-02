# Crobble

A ternary interpolation between a **crisp**, a **crumble** and a **cobbler**.

Pick a point on the triangle. The model derives a complete recipe from it —
ingredient quantities, shaping technique, bake schedule, filling thickener — and
scores the predicted result.

Honestly though take it with a grain of salt, heh, and if it differs we should record that and update it.

```bash
npm test          # 42 model tests, no dependencies
python3 -m http.server 8765   # then open http://localhost:8765
```
<img width="817" height="915" alt="Screenshot 2026-07-27 at 5 30 02 PM" src="https://github.com/user-attachments/assets/af76b87f-643a-405d-86b0-332d5bc973e2" />


---

## Why a triangle

The three toppings are not arbitrary points. Two axes give the triangle its
coordinates:

- **Hydration** — added liquid per 100 parts dry structure. Crumble 0, crisp 0,
  cobbler 80.
- **Oat fraction** — oats as a share of dry structure. Crumble 0, crisp 41%,
  cobbler 0.

Plot those and crumble sits at the origin, crisp on one axis, cobbler on the
other, and the map from barycentric position to (hydration, oats) is a bijection.

**But do not read that as "these doughs differ in only two things."** An earlier
version of this file said they "differ along essentially two physical axes",
which is wrong. The bijection is a fact about *coordinates*, not about the
recipes. Fat, sugar, leavening and salt are all moving too, along lines fixed by
the corner values — and those are independent choices, not consequences of
hydration and oats. Walk the crumble-to-cobbler edge and three things move at
once:

| | crumble | midpoint | cobbler |
|---|---|---|---|
| hydration | 0 | 40 | 80 |
| butter | 66.7 | **55.9** | 45 |
| sugar | 57 | **43.5** | 30 |

Nothing forces a 40%-hydration topping to carry butter 55.9 and sugar 43.5. The
surveyed range at comparable hydration is butter 33.5–68.2 and sugar 11.4–60;
this model draws one line through a wide box. Sugar has the largest relative
spread of any variable here (2.5×) and does the heaviest lifting in the score,
yet it is entirely determined by that line.

So: **this is a two-dimensional slice through roughly six-dimensional recipe
space.** The slice is a legitimate design, and the corner values are sourced, but
the passengers are real. The interface now shows them — the strip under the
recipe title reports fat, sugar, lift and salt alongside the two coordinates, so
what is being carried along is visible rather than implied.

A further consequence worth knowing: on a *triangle* the two axes cannot be
varied independently. The reachable region is bounded by `h/80 + oats/41 ≤ 1`,
so high hydration together with high oats is unreachable by construction. A
fourth vertex would open it — see below.



## What is held constant

The **dish** and its **coverage**

Surveyed practice makes this the right invariant, and settles an argument that
looked irreconcilable. America's Test Kitchen states a filling-to-topping ratio
of "about 5 to 1"; BBC Good Food's apple crumble works out at roughly 2:1. But
their **topping loads per unit area are within 6% of each other** — 0.952 vs
1.008 g/cm².

Across British crumbles, fruit-to-topping spans 0.67:1 to 7.5:1, an 11× range.
Load per cm² clusters at 0.95–1.32. So the model scales topping by area:

```
baked volume = area × coverage × target thickness
raw volume   = baked volume / oven expansion
raw mass     = raw volume × raw density
```

## The morphology ladder

The part that keeps the middle of the triangle edible. Hydration decides not
just the composition but the **shape** the topping has to take:

| Hydration | Material | Technique | Coverage |
|---|---|---|---|
| 0–12% | loose crumb | rub to breadcrumbs, scatter | 95% |
| 12–22% | clumped nuggets | squeeze into hazelnut clumps | 93% |
| 22–35% | rollable sheet — *see caveat* | roll to 6 mm, cut a lattice | 78% |
| 35–50% | slack paste | drop in ~30 g mounds, chill first | 58% |
| 50%+ | biscuit dough | drop in ~45 g mounds, well separated | 41% |

**Caveat on that third row.** This project long claimed rollable pastry lives at
22–35% hydration, citing the lattice-topped **sonker** of Surry County, NC as the
existence proof. Checking the sonker killed the claim: the Rockford General Store
crust runs about **51** parts liquid per 100 flour — squarely inside the cobbler
dough cluster, not below it. What makes it rollable is very low **fat** (14.5
against a cobbler median of 45); combined liquid-plus-fat is 65 against a cobbler
median around 123.

So rollability depends on liquid *and* fat together, and this ladder is keyed on
hydration alone. The dry-end labels are therefore approximate: a genuinely
low-fat dough becomes rollable at a hydration where the model still calls it a
drop. Left as a documented limitation rather than rebuilt, because fixing it
properly means a two-variable morphology surface and there is not enough data to
calibrate one.

Cobbler coverage of 41% is measured: King Arthur's cherry cobbler
specifies 9 mounds of 50 g in a 9-inch square (~42%), and ATK's peach cobbler
drops 6 mounds from 338 g in an 8-inch square (~40%), with an explicit
instruction that the mounds must not touch.

## The quality surface

The score measures **how well a point executes what it is trying to be**

Positive axes: **surface crisp**, **structure beneath**, **stratification**.
Defects: **cooked through**, **holds its height**, **dry underside**,
**cohesion**. Combined as a weighted geometric mean, so a single near-zero
component tanks the point — an uncooked gummy underside is not be rescuable by
an excellent crust.

Two design points worth noting:

- **Stratification's weight scales with hydration.** A two-texture topping is the
  cobbler's stated target, not the crumble's. Weighting it flat would score a
  crumble as deficient for being the single-texture thing it is meant to be.
- **The dip is emergent, and shallower than this project long claimed.** An
  "awkward band" at 35-50% hydration was invented in the first design
  conversation and carried untested for a long time. It is false: the surveyed
  cobbler dough cluster is 41-72%, and a 4.8-star, 146-rating recipe sits at 48%.
  Scoring real recipes caught it. A dip survives around the crumble-cobbler
  midpoint, but it now comes from **cooked-through** — a doughy topping with poor
  dry-heat access — rather than from a slump penalty with nothing behind it.

## Does it agree with reality?

`node scripts/validate-corners.mjs` scores real published recipes with the model,
using their own measured composition, and checks the one property that matters:
**no recipe rated 4.5 stars or better should score badly.**

Ratings are too positivity-biased to correlate against — Food.com's median is
5.0, the curated sites cluster at 4.7-4.9 — so this is a one-sided test, not a
fit. It has already earned its keep: it caught the invented awkward band by
scoring a 4.8-star cobbler at 0.58.

| Corner | Vertex score | Best real recipe there |
|---|---|---|
| Crumble | 0.867 | Kitchen Sanctuary 0.898 (4.38 stars, n=8) |
| Crisp | 0.942 | ATK Pear 0.938 · King Arthur 0.934 (4.8 stars, n=214) |
| Cobbler | 0.979 | Dorie 0.918 · ATK Peach 0.845 |

**Known gap:** the crumble corner has no anchor above 4.5 stars, because ratings
for Delia, Jamie Oliver and BBC Good Food were never recovered. The two largest
crumble samples that were — ATK at 4.0/415 and GoodTo at 3.0/6,276 — are the
lowest ratings in the survey. Whether British crumbles genuinely rate lower or
that is a site effect, this data cannot say.

## Provenance

**Full source log: [SOURCES.md](SOURCES.md)** — every recipe surveyed, what was
said about it, what was converted versus found, what could not be retrieved, and
a corrections log of everything this model got wrong and how.

Every quantity in `src/model/vertices.js` is the median of surveyed,
well-reviewed recipes, and the corpus behind them is machine-readable:
**59 records** in `data/sources.json`, holding verbatim ingredient lines, with
`data/sources.csv` regenerated from them by `scripts/build-dataset.mjs`.

Included in the medians: 13 British crumbles, 15 American crisps, 14 sweet
biscuit cobblers. Recorded but deliberately excluded from any vertex: batter
cobblers, sonkers, five oat-free "crisps", and everything flagged as an SEO farm
or a content mill.

Where the surveyed spread is tight, the median is used directly. Where it is
wide, the chosen figure and the reason for departing from the median are stated
on the vertex itself. The crisp sugar figure is the clearest case: the median is
86 but the range is 36–141, and no single source sits near all five medians at
once, so 75 is a deliberate choice with the reasoning recorded in the file.

Bake schedules, topping loads and rest times are likewise per-corner medians —
which is why a crumble bakes at 200 °C for 38 minutes and a crisp at 175 °C for
48. A single flat schedule is a good crisp and a bad crumble.

## Things this model got wrong, and how

Kept here because the corrections are more informative than the current state,
and because each was invisible until checked against sources.

| Claim | Reality |
|---|---|
| Vertex ratios, eyeballed from memory | Systematically low on fat and sugar at all three corners. Crumble butter was 50 against a median of 66.7 — the most stable figure in the entire survey. |
| Buttermilk neutralises 2.8 g soda per cup | **Wrong by 55%.** That needs ~1.25% titratable acidity; real buttermilk is 0.75–0.85%. Stoichiometry gives 1.79 g. |
| Sugar "recrystallises into a brittle glass" | Self-contradictory — a glass is amorphous by definition. It *vitrifies*; recrystallisation is the failure mode that makes a topping grainy. |
| Brown sugar compensates for vegan browning | Backwards. Molasses carries moisture and invert sugars, which depress the glass transition and *soften* the topping. Milk powder restores browning without that cost. |
| Soy milk is chemically better than almond for soda | The acid comes from the lemon juice. Soy is right for protein, body and browning — not for leavening. |
| Gluten-free crumble needs 0.25% xanthan | It needs **none**. Crumble is meant to be non-cohesive rubble; xanthan's function is holding water, and held water is what kills the crunch. |
| Oats resist sogginess | **No support anywhere.** Across 16 crisp sources, oats are credited with chew, flavour and bulk. Crunch: zero. Moisture resistance: zero. Crunch retention is credited to butter handling. |
| A soggy underside is trapped steam | The mechanism is thermal. While water boils at the interface, evaporative cooling pins it near 100 °C — below what browning or dehydrating a dough needs. Sogginess there is thermodynamically mandated, not a venting accident. |
| Cut vents fix soggy bottoms | Pie vents are top-crust and boil-over control. What the gaps actually buy is exposed surface. |
| Toppings must be *either* crunchy *or* springy | Authors name both at once as the definition of success — "crisp on top, but soft and moist underneath". The target is spatial stratification, not a point on a continuum. |
| Cornstarch fails in acidic fillings | Not at these pH levels. Blackberries run pH 3.85–4.5. Tapioca stays the default for setting clear and thickening harder per gram. |
| Berry "release factor" | Not a documented concept, and not well posed — it conflates cell rupture (a fruit property) with evaporation (a dish property). Replaced with King Arthur's measured per-fruit thickener demand. |
| Doneness = filling bubbling in the centre | Edge-bubbling is the convention across the corpus. Centre-bubbling is essentially one source. |
| Two-stage bake for anything leavened | One recipe in ~30 changes oven temperature, and it descends. Offered as an option now, not imposed. |
| Greasy / bland / burnt as defect terms | Zero attestation across ~50 recipes, despite butter ranging 33 to 136 per 100 flour. Removed rather than left as dormant inventions. |

Two guards remain because they are *satisfied by construction* rather than
untested: the acid budget never binds on the dairy path because soda and
buttermilk both originate at the cobbler vertex, so affine interpolation holds
their ratio constant. It does bind on the vegan path.

## Layout

```
src/model/     pure, testable, no DOM
  vertices.js    the three recipes + provenance
  fruit.js       berry data, thickener demand
  blend.js       barycentric blend + chemistry constraints
  diet.js        vegan / gluten-free substitutions
  morphology.js  hydration → shaping technique
  score.js       the quality surface
  filling.js     thickener, sugar, acid
  bake.js        schedule, doneness, rest
  recipe.js      orchestration and gram scaling
src/ui/        canvas ternary chart + recipe view
test/          42 tests
assets/        favicon + social card, generated from the chart
```

### The icon is the chart

`assets/` is not hand-drawn art. `scripts/make-images.mjs` serves the repo,
loads `src/ui/triangle.js` in a headless Chromium and renders the same
`TriangleChart` the page renders, then crops it:

- the **favicon** is the rubbed quality surface alone — the offscreen heat field
  with no gridlines, labels or selection ring, none of which survive 16 px;
- the **social card** is both triangles at their real proportions, markers and
  all, beside the wordmark.

So a change to a vertex value or to the score changes the icon. Re-run it when
that happens:

```bash
npm i -D playwright-core && npx playwright install chromium
node scripts/make-images.mjs
```

The browser is a build-time tool; the site itself still has no dependencies.
GitHub's repository social preview cannot be set from the API — upload
`assets/social-preview.png` under **Settings → General → Social preview**.

## The second triangle — poured batters

Crumble, crisp and cobbler are one *technique family*: cold fat rubbed or cut
into flour, and the result placed on the fruit. **Batter cobblers, sonkers and
pudding cakes are not reachable from it**, and the survey — not a design
preference — is what says so:

1. **There is a hole in the data.** Surveyed cobbler liquid splits into a dough
   cluster at 41–72 parts per 100 flour and a batter cluster at 94–176, with
   nothing in between. That gap is not sampling noise. A mixture at 80–90 is too
   slack to drop as a mound and too stiff to pour level, so it cannot be
   assembled by either method. A single continuous simplex spanning both would
   emit recipes no cook can execute.
2. **Fat state is discrete.** Fifteen of fifteen sweet biscuit cobbler toppings
   that contain butter use it cold. Every poured dish melts it. There is no
   halfway house between rubbing cold butter into flour and pouring melted butter
   into a pan.
3. **The assembly inverts.** Two of the three poured dishes put the *batter down
   first* and the fruit on top, and rely on the batter rising through during the
   bake. The rubbed family's morphology model is entirely about how much topping
   stands clear of the fruit; it has no way to express "underneath it".

So the **Technique** switch loads a second, self-contained triangle:

| | fat | sugar | liquid | egg | load g/cm² | assembly |
|---|---|---|---|---|---|---|
| **Batter cobbler** | 88 | 158 | 139 | 0 | 1.12 | butter, batter, fruit — inverts |
| **Sonker** | 90 | 80 | 96 | 0 | **1.38** | fruit baked first, batter poured over |
| **Pudding cake** | 23 | 165 | 23 | 83 | 0.91 | batter, fruit on top — rises part-way |

Its own vertices, ingredient fields (egg is added), morphology model, quality
model and colour scale. What it shares is everything downstream of the topping:
the fruit, the dishes, the filling, the diet switches, the bake schedule.

### Inversion

The poured family's central quantity is not exposure but **inversion** — does the
batter rise through the fruit and finish on top? It is modelled as buoyancy:
fluid enough to flow past the fruit *and* generating enough gas to drop below its
density, both necessary. The batter cobbler scores 1.00 and genuinely inverts;
the pudding cake manages a partial rise; the sonker has ample capacity and
**deliberately declines to use it**, because its fruit is pre-baked and the
batter goes on top.

The effect is real and described by three of four sources. **The mechanism is
not sourced** — every online account traces to content farms citing nothing — so
the buoyancy story is labelled a model, is used only to pick an assembly and
weight one score term, and is load-bearing nowhere else.

### These scores are not comparable to the rubbed ones

The rubbed surface is calibrated: eight surveyed recipes at ≥4.5★ were scored
against it and none falls below 0.70. **Not one poured or sonker record in the
corpus carries a rating at all**, so no equivalent test exists. The two families
therefore get separate colour domains. The ordering of the terms and the shape of
the surface are grounded; the absolute level is not, and the vertices land at
0.84 / 0.68 / 0.70 without being massaged upward.

### What is still out of reach: the rolled sonker

Sonker is genuinely bimodal — poured batter *and* rolled pastry. The poured half
is now covered. The rolled half is out of reach **on both sides**: Rockford
General Store's runs 14.5 parts fat per 100 flour against a rubbed-family floor
of 45. It is rollable because of very low fat, not low water, and no point in
either triangle can produce it. Recorded as a gap rather than faked.

## The surveyed recipes, plotted

Every recipe in the corpus is projected onto the triangles and drawn as a marker
(`node scripts/build-anchors.mjs` → `data/anchors.json`). Hover one for its
source and rating; click to go to that point.

The projection is a constrained least-squares fit, and it reports a **residual**
alongside the position — because the triangle is a 2-D slice of a much larger
space and real recipes are not on it. A recipe with a small residual really is
the blend the model says it is; one with a large residual has been forced onto a
plane it does not lie near, and its position would be a shadow rather than a
location. Those are **not drawn at all**, and the count is shown next to the
toggle.

Two things fall out that were not visible before:

- **The surveyed recipes avoid the middle of the triangle.** They cluster at the
  crisp corner and along the crumble↔cobbler edge, and the interior — where the
  model's surface dips — is nearly empty. That is independent corroboration of
  the surface's shape from data that had no part in building it.
- **Five recipes do not fit either triangle**, and each names its own reason:

  | recipe | worst field | reading |
  |---|---|---|
  | Rockford rolled sonker | butter 0.50 *below* | the documented low-fat gap — rollable because of fat, not water |
  | Dorie Greenspan cobbler | buttermilk 0.69 *above* | sits in the batter liquid cluster, not the dough one |
  | Nigel Slater crumble | butter 0.50 *above* | richer than any vertex |
  | Cook's Country crisp | butter 0.45 *above* | same |
  | OUAC oat-pecan crisp | sugar 0.49 *above* | the sweet end of a 3.9× spread |

## Made it? Rate it

The model's three stated weaknesses are one weakness: **missing outcomes.** The
crumble corner has no recipe rated ≥4.5★ anywhere in the corpus; no poured or
sonker source carries a rating at all; and filling set is a two-sided target the
model scores neither side of. None of that is fixable by surveying more recipes,
because a published recipe reports what its author did, not how it turned out for
somebody else.

So there is a **"Made it? Rate this point"** panel. It records a rating, a set of
structured observations, and optional free text, and pairs them with the model's
prediction *at bake time* — including the per-component breakdown and a
fingerprint of the vertices, so a rating can never be silently reattributed to a
later model.

Three destinations, and the first two need nothing from anyone:

1. **This browser.** The bake becomes a marker on the surface, so a point you
   liked can be found again.
2. **A file.** Download the JSON.
3. **A pull request.** Opens GitHub's own new-file editor with the record filled
   in; you review and commit it yourself. Nothing is transmitted by the page, and
   no name or email is collected anywhere.

Records land in `data/bakes/`, one file per bake so contributions cannot
conflict. Read them back with:

```bash
node scripts/bakes-report.mjs
```

which reports predicted-vs-actual and, per component, what the model predicted
when somebody reported that component succeeding versus failing. **A component
whose "bad" mean is not clearly below its "good" mean is not measuring what it
claims to** — that is the check the whole loop exists for.

The observations are deliberately structured rather than parsed out of prose. The
review-mining pass on the Food.com corpus is the cautionary tale: 43.5% of "too
sweet" matches were actually *"not* too sweet". One of the options —
"underside steamed and soft (and I liked it)" — exists specifically to settle the
unresolved argument with the sonker source described above.

## A fourth vertex

The obvious candidate is **baked oatmeal**, which would sit at the missing
high-hydration, high-oats corner. It does not fit, and the reason is structural
rather than chemical: baked oatmeal mixes the fruit *through* the matrix. There
is no topping and no interface.

Everything load-bearing in this model assumes a fruit layer with a distinct
topping over it. `coverage`, `exposureIndex`, `undercooked`, `stratification` and
the entire filling-thickener calculation exist to describe that boundary. With
the fruit dispersed, coverage is 100% by definition, the fruit's water enters the
matrix instead of pooling beneath it, and "crisp above, tender below" becomes a
browned skin on a homogeneous oat custard — a different phenomenon wearing the
same words.

Three ways forward, none of them free:

1. **Oat drop-biscuit corner** — hydration 80, oats 41%, no egg. Layered, fits
   the basis exactly, gives a true rectangle where the two axes are genuinely
   independent. Least interesting as a fourth food; arguably just the
   crisp–cobbler edge extended.
2. **Baked oatmeal with a dispersion axis** — as you approach the corner, an
   increasing fraction of the fruit is folded into the topping rather than
   layered beneath. Continuous, physically meaningful, and a real technique; the
   survey found partial cases already, such as King Arthur's fresh fruit cobbler
   where the cake "rises up and over the fruit as it bakes". Costs a genuine
   model branch: interface defects stop applying and matrix defects start.
   **Partly done** — the poured family above took the King Arthur case and built
   the branch, but as a separate triangle rather than a fourth corner, because
   the data says the region between is empty.
3. **Leave it at three.**

## Caveats

- Toughness is attested but not modelled: every source blames handling, which a
  composition model cannot see. It lives in the method text.
- Whether texture heterogeneity within a topping is a goal is genuinely
  contested — Dorie Greenspan pursues it, ATK engineers it away. The model
  rewards it moderately, matching two of three sources.
- The "moist underside" defect is weighted low on purpose. Two sources want it,
  and the sonker wants it emphatically.
- The poured family rests on two, one and one source per vertex, against 13–18
  for each rubbed vertex. It is a sketch of a real region, not the same grade of
  evidence, and nothing in it is rating-validated.
