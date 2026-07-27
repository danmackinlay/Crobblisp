# Crobble

A ternary interpolation between **crisp**, **crumble** and **cobbler**, with the
food chemistry made explicit and the quality surface left uncorrected.

Pick a point on the triangle. The model derives a complete recipe from it —
ingredient quantities, shaping technique, bake schedule, filling thickener — and
scores the predicted result. It does not steer you away from bad points. It
computes them honestly and shades the terrain so you can see where they are.

```bash
npm test          # 42 model tests, no dependencies
python3 -m http.server 8765   # then open http://localhost:8765
```

No build step, no dependencies. Plain ES modules.

---

## Why a triangle is the right shape

The three toppings are not three arbitrary points. In baker's percentages they
differ along essentially **two** physical axes:

- **Hydration** — added liquid per 100 parts dry structure. Crumble 0, crisp 0,
  cobbler 80.
- **Oat fraction** — oats as a share of dry structure. Crumble 0, crisp 41%,
  cobbler 0.

Plot those and crumble sits at the origin, crisp on one axis, cobbler on the
other. Barycentric coordinates map onto that plane **affinely and bijectively**,
so every point in the triangle is a real, nameable (hydration, oats) pair rather
than a smoothie of three recipes.

A side effect: the triangle is half of a square, and the missing fourth corner —
high hydration *and* high oats — is baked oatmeal. A real dish, and an obvious
extension if you ever want to unfold the simplex.

## What is held constant

The **dish** and its **coverage**, not the mass of topping.

Surveyed practice makes this the right invariant, and settles an argument that
looked irreconcilable. America's Test Kitchen states a filling-to-topping ratio
of "about 5 to 1"; BBC Good Food's apple crumble works out at roughly 2:1. But
their **topping loads per unit area are within 6% of each other** — 0.952 vs
1.008 g/cm². The disagreement was never about topping quantity at all. It is
about how deep the fruit layer is.

Across British crumbles, fruit-to-topping spans 0.67:1 to 7.5:1, an 11× range.
Load per cm² clusters at 0.95–1.32. So the model scales topping by area:

```
baked volume = area × coverage × target thickness
raw volume   = baked volume / oven expansion
raw mass     = raw volume × raw density
```

Coverage comes from the morphology model, so technique feeds back into quantity.

## The morphology ladder

The part that keeps the middle of the triangle edible. Hydration decides not
just the composition but the **shape** the topping has to take:

| Hydration | Material | Technique | Coverage |
|---|---|---|---|
| 0–12% | loose crumb | rub to breadcrumbs, scatter | 95% |
| 12–22% | clumped nuggets | squeeze into hazelnut clumps | 93% |
| 22–35% | **rollable — pastry** | roll to 6 mm, cut a lattice | 78% |
| 35–50% | slack paste | drop in ~30 g mounds, chill first | 58% |
| 50%+ | biscuit dough | drop in ~45 g mounds, well separated | 41% |

The 22–35% band looks dead on paper and isn't: that is pie pastry, and the
lattice-topped **sonker** of Surry County, NC is the existence proof. The
surveyed Rockford General Store crust runs about 51 parts liquid per 100 flour
against a cobbler median of 77.

Cobbler coverage of 41% is measured, not guessed: King Arthur's cherry cobbler
specifies 9 mounds of 50 g in a 9-inch square (~42%), and ATK's peach cobbler
drops 6 mounds from 338 g in an 8-inch square (~40%), with an explicit
instruction that the mounds must not touch.

## The quality surface

The score measures **how well a point executes what it is trying to be**, not
how crisp it is. Scoring crispness directly would just tilt the whole triangle
toward one corner, which is both boring and wrong — a good cobbler is not a
failed crisp.

Positive axes: **surface crisp**, **structure beneath**, **stratification**.
Defects: **cooked through**, **holds its height**, **dry underside**,
**cohesion**. Combined as a weighted geometric mean, so a single near-zero
component tanks the point — an uncooked gummy underside must not be rescuable by
an excellent crust.

Two design points worth knowing:

- **Stratification's weight scales with hydration.** A two-texture topping is the
  cobbler's stated target, not the crumble's. Weighting it flat would score a
  crumble as deficient for being the single-texture thing it is meant to be.
- **The trough is real and it is emergent.** Around 55% cobbler the topping is
  too slack to hold a cut edge and too stiff to drop cleanly; it slumps flat,
  loses its dry exposed surface, and fails to cook through. That falls out of the
  defect terms rather than being asserted.

## Provenance

Every quantity in `src/model/vertices.js` is the median of surveyed,
well-reviewed recipes. Sample sizes: **13 British crumbles, 16 American crisps,
16 sweet cobbler toppings**, plus three textbook formulas from Gisslen's
*Professional Baking*.

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
```

## Caveats

- Toughness is attested but not modelled: every source blames handling, which a
  composition model cannot see. It lives in the method text.
- Whether texture heterogeneity within a topping is a goal is genuinely
  contested — Dorie Greenspan pursues it, ATK engineers it away. The model
  rewards it moderately, matching two of three sources.
- The "moist underside" defect is weighted low on purpose. Two sources want it,
  and the sonker wants it emphatically.
