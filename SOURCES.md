# Provenance log

Every number in this model, where it came from, and what was said about it.

This document exists because the first version of the model was **eyeballed** —
ratios written from memory, tests asserting my own assumptions back at me, and
several confident claims that turned out to be folklore. The corrections were
invisible until checked against sources. So the sources are recorded here, in
full, including the ones that contradict each other and the ones I could not get.

---

## How to read this

Every figure is tagged:

| Tag | Meaning |
|---|---|
| **F** | Found — stated by the source in the units given |
| **C** | Converted — arithmetic on a found figure, with the factor recorded |
| **I** | Inferred — estimated, not stated. Treat with suspicion |
| **S** | Secondary — from a mirror, reprint or quotation, not the primary page |
| **✗** | Attempted and not retrieved |

A figure with no tag is an error in this document; please flag it.

### Conversion factors

Used consistently throughout unless a source published its own, in which case
**the source's own convention wins** and the discrepancy is noted. This matters
more than it sounds: for ¾ cup of flour, America's Test Kitchen says 106 g, King
Arthur says 90 g, and the generic factor gives 94 g. That alone injects ±8% into
any flour-normalised figure, and is a real contributor to the spread in every
table below.

| Ingredient | Factor |
|---|---|
| Flour, 1 cup | 125 g |
| Rolled oats, 1 cup | 90 g |
| Granulated / caster sugar, 1 cup | 200 g |
| Brown sugar, packed, 1 cup | 213 g |
| Butter, 1 tbsp | 14.2 g |
| Buttermilk / milk, 1 cup | 240 g |
| Heavy cream, 1 cup | 238 g |
| Baking powder, 1 tsp | 4.0 g |
| Baking soda, 1 tsp | 4.6 g |
| Salt, 1 tsp | 5.7 g |
| Berries, 1 cup | 140 g |
| Blueberries, 1 cup | 148 g |
| Sliced apples, 1 cup | 110 g |
| Sliced peaches, 1 cup | 155 g |

Kosher salt is a persistent problem: Diamond Crystal is roughly 2.8 g/tsp and
Morton roughly 4.8 g/tsp, so any recipe specifying "kosher salt" without a brand
carries a 1.7× ambiguity. Affected figures are tagged **I**.

### Sample sizes

| Corpus | Sources | Notes |
|---|---|---|
| British crumble | 20 surveyed, 13 in the core set | Core excludes oat/nut-bearing and US crumb-pie |
| American crisp | 16 | All oat-bearing; two well-known "crisps" turned out to be oat-free and were excluded |
| Sweet biscuit cobbler | 17 | Plus 10 savoury drop biscuits, 3 batter cobblers, 4 sonkers |
| Textbook formulas | 3 | Gisslen, *Professional Baking* 7e, ch. 10 |
| Food-science claims | 8 | Verified, corrected or rejected individually |

---

## Corrections log

The most useful part of this document. Each row is something the model asserted
confidently and got wrong, with what replaced it. Ordered by how badly it was
wrong.

| # | The claim | What checking found | Where it lived |
|---|---|---|---|
| 1 | Vertex ratios, written from memory | Systematically low on fat and sugar at **all three** corners. Crumble butter was 50 against a surveyed median of 66.7 — which turned out to be the single most stable figure in the entire survey, holding under every subset cut | `vertices.js` |
| 2 | Buttermilk neutralises 2.8 g soda per cup | **Wrong by 55%.** That requires ~1.25% titratable acidity; real cultured buttermilk is 0.75–0.85%. Stoichiometry gives 1.79 g. The 2.8 g figure is the folk "½ tsp per cup" rule, which rounds up | `vertices.js` |
| 3 | Oats resist sogginess (weight 0.38 in the score) | **No support anywhere.** Across 16 crisp sources oats are credited with chew, flavour and bulk. Crunch: zero. Moisture resistance: zero. The corpus's only crunch-retention claim credits butter handling instead | `score.js` |
| 4 | Toppings must be *either* crunchy *or* springy | Contradicted directly. Authors name both at once as the definition of success — "crisp on top, but soft and moist underneath". The target is spatial stratification, not a point on a continuum | `score.js` |
| 5 | Soggy undersides are trapped steam | Mechanism wrong. It is thermal: while water boils at the interface, evaporative cooling pins it near 100 °C, below what browning or dehydration need. Sogginess there is thermodynamically mandated | `morphology.js` |
| 6 | Sugar "recrystallises into a brittle glass" | Self-contradictory — a glass is amorphous by definition. It *vitrifies*; recrystallisation is the failure mode that makes a topping grainy | `score.js` |
| 7 | Cobbler topping covers ~71% of the dish | Measured at **~41%**. King Arthur specifies 9 mounds of 50 g in a 9-inch square; ATK drops 6 mounds from 338 g in an 8-inch square, with an explicit instruction that they must not touch | `morphology.js` |
| 8 | Gluten-free crumble needs 0.25% xanthan | It needs **none**. Crumble is meant to be non-cohesive rubble — no crumb to bind, no gas to trap — and xanthan's function is holding water, which is what kills the crunch | `diet.js` |
| 9 | Brown sugar compensates for lost vegan browning | Backwards. Molasses carries moisture and invert sugars, which depress the glass transition and *soften* the topping. It buys colour by spending the crunch it was meant to protect | `diet.js` |
| 10 | Soy milk beats almond for soda chemistry | The acid comes from the lemon juice; soy protein contributes negligible buffering. Soy is still right, for protein, body and browning — not for leavening | `diet.js` |
| 11 | A single flat bake schedule | A good crisp and a bad crumble. Crumble median 200 °C/38 min, crisp 175 °C/48 min, cobbler 190 °C/42 min | `bake.js` |
| 12 | Two-stage bake for anything leavened | One recipe in ~30 changes oven temperature, and it descends. Offered as an option now, not imposed | `bake.js` |
| 13 | Doneness = filling bubbling in the centre | Backwards. Edge-bubbling is the convention (5 sources); centre-bubbling is essentially one source | `bake.js` |
| 14 | Cornstarch fails in acidic berry fillings | Not at these pH levels — blackberries run 3.85–4.5. Tapioca stays default for setting clear and thickening harder per gram, not for acid tolerance | `filling.js` |
| 15 | Per-fruit "release factor" | Not a documented concept, and not well posed: it conflates cell rupture (a fruit property) with evaporation (a dish property). Replaced with measured thickener demand | `fruit.js` |
| 16 | Greasy / bland / burnt as defect terms | Zero attestation across ~50 recipes, despite butter ranging 33 to 136 per 100 flour. Removed rather than left as dormant inventions | `score.js` |
| 17 | Raw topping mass rises toward the cobbler corner | Both raw and dry mass fall. Measured practice puts less topping on a cobbler (0.85 g/cm²) than a crumble (1.01), which outweighs the liquid | `recipe.js` |
| 18a | An "awkward band" at 35-50% hydration where a topping is too slack to roll and too stiff to drop | **Falsified by scoring real recipes.** The surveyed cobbler dough cluster is 41-72%; the invented penalty sat on top of it. Sally's peach cobbler is at 48% with 4.8 stars from 146 ratings and scored 0.58. Spread is a technique variable four authors manage deliberately, not a defect. Slump amplitude 0.55 -> 0.18 | `morphology.js` |
| 18b | Rollable pastry lives at 22-35% hydration | Also wrong. The rolled sonker crust cited as the existence proof runs ~51 parts liquid — inside the dough cluster. What makes it rollable is very low FAT (14.5 vs a cobbler median of 45). Rollability is liquid AND fat; the ladder is keyed on hydration alone | `morphology.js` |
| 18 | The three doughs "differ along essentially two physical axes" | True of the *coordinates*, misleading about the recipes. Fat, sugar, leavening and salt all move too, along lines fixed by corner values. It is a 2D slice through ~6D space | `README.md` |

### Corrections that arrived from the user, not from research

Worth separating, because they are the ones no amount of source-gathering would
have caught — they are errors of framing, not of fact.

| Prompt | What it exposed |
|---|---|
| "Did you look online or just eyeball them?" | Everything in row 1. The tests encoded my assumptions, so they passed |
| "They seem to be missing the amount of fruit used and the size of the pans" | Ratios were sourced but *scale* was not. Led to the topping-load figure, which resolved an apparent 2.5× conflict between ATK and BBC Good Food that was really about fruit depth |
| "Not including the oven temperatures" | Rows 11–13 |
| "Expected texture... is important data as well" | Rows 3, 4, 16 — the entire scoring rewrite |
| "Is it really only oats and hydration?" | Row 18 |
| "Doesn't baked oatmeal put the fruit mixed instead of on the bottom?" | Killed a fourth vertex that would have broken the model's topology |

---

## Sections

1. [Method and conventions](#how-to-read-this) — above
2. [Corrections log](#corrections-log) — above
3. British crumble corpus — *pending full dump*
4. American crisp corpus — *pending full dump*
5. Sweet biscuit cobbler corpus, plus savoury, batter and sonker — *pending full dump*
6. Food-science claims, with working — *pending full dump*
7. Peer-reviewed literature — *pending*
8. Reviews and real-kitchen reception — *pending*
9. The wider family: buckle, betty, grunt, slump, pandowdy, clafoutis — *pending*
10. Sources attempted and not retrieved
11. What the model does with all of it

---

## 10. Sources attempted and not retrieved

Recorded because an absence shapes a corpus as much as a presence. Several of
the most authoritative sources on this subject are simply not machine-readable.

| Source | Status | Consequence |
|---|---|---|
| Serious Eats (Kenji López-Alt, Stella Parks) | ✗ blocked | The single biggest gap. Absent from every corpus |
| NYT Cooking | ✗ blocked | — |
| Allrecipes | ✗ blocked | Large review counts lost |
| Epicurious / Bon Appétit | ✗ blocked | Recovered partially via aggregators, tagged **S** |
| The Guardian (Felicity Cloake, "Perfect crumble") | ✗ blocked | Her *reasoning* was recovered via a syndication; her final quantities were not |
| bbcgoodfood.com | ✗ blocked | Recovered via their Middle East edition, tagged **S** |
| Southern Living, Taste of Home | ✗ blocked | — |
| marthastewart.com | ✗ blocked | Recovered via two independent reprints, tagged **S** |
| Corriher, *BakeWise* / *CookWise* | ✗ no machine-readable text | **No food-science text in the survey states a crumble, crisp or cobbler ratio.** That leg of the source hierarchy came up empty |
| Figoni, *How Baking Works* | ✗ empty ingredient table on the accessible edition | As above |
| McGee, *On Food and Cooking* | ✗ secondary quotation only | As above |
| Edna Lewis, Sean Brock | ✗ not recoverable | A real gap in the Southern cobbler material |

### Sources found and rejected

Two AI-generated content farms surfaced repeatedly on the starch-chemistry
queries, emitting confident fake precision — "viscosity drops up to 70% after 10
minutes", "cornstarch begins degrading after 4 minutes at 200 °F" — none of it
traceable to a primary. One made a flatly false chemical claim, describing
tapioca as ">99% amylopectin"; that describes waxy maize, while native tapioca is
~16–17% amylose. Recorded here so the log documents what bad data on this topic
looks like, since it ranks well and reads plausibly.

---

## 0. THE CAVEAT THAT OUTRANKS EVERYTHING BELOW

**Nothing in this log was read from a raw page.** Every retrieval passed through
a summarising model that read the page and answered a prompt against it. Text
marked "verbatim" is verbatim *as relayed by that layer*, not as read.

All four researchers volunteered this independently and unprompted, and it is
the single most important fact about the dataset. It is not hypothetical — the
layer was caught making real errors:

| Incident | What happened |
|---|---|
| **Near-fabrication** | A fetch of Felicity Cloake's article presented **Mary Norwak's tested recipe as Cloake's own conclusion**. Caught only because the researcher later pulled full page text. A fabricated "Cloake's perfect crumble" nearly entered the ratio table |
| **Arithmetic corruption** | A King Arthur page returned "1,824 g butter (4 sticks × 456 g)". Both halves wrong: 4 sticks *is* 456 g total, and 8 × 57 g = 456, so the figure was 4× over |
| **Attribution drift** | An americastestkitchen.com page returned a rationale attributed to **Martha Stewart**. Never resolved — either a reprint or a confabulation |
| **Cross-source conflation** | The Epicurious crisp's pan, servings, temperature and bake time came back **identical in every particular** to Dorie Greenspan's — almost certainly two recipes merged |
| **Correct refusal** | On an empty page, the layer replied: *"The prompt appears to be testing whether I would fabricate information."* It declined rather than invent |

One researcher also disclosed reading `localhost:8765` — **this project's own
running app** — after a browser tab resolved to the wrong target. Nothing from it
was used as evidence, but it is recorded as part of the retrieval history.

**Practical consequence:** treat every quotation as needing re-verification
before republication, and treat any single-sourced number as provisional.

---

## 3. British crumble corpus

**20 sources surveyed, 13 in the core set.** Butter median **66.7 per 100 flour**
— the most robust figure in the entire project, holding under every subset cut.
Sugar median 57.1 across a 33–80 range.

### 3.1 Evidence tiers

| Tier | Meaning | Count |
|---|---|---|
| **T1** | Page fetched, structured ingredient list returned | 13 |
| **T2** | Mirror, reprint or licensee edition | 3 |
| **T3** | Never fetched — search-result summary only | 2 |
| **T4** | Book transcription quoted by a third party | 2 |

**Two T3 rows entered the published ratio table unflagged** — Ottolenghi's
blueberry muffins and *delicious.* magazine. Between them they anchor the bottom
of the sugar range (33.3) and the top of both butter and sugar (100/100).

### 3.2 Core sources

| Source | Butter | Sugar | Salt | Tier | Note |
|---|---|---|---|---|---|
| Delia, Best Ever Apple Crumble | 42.9 | 62.9 | ? | T1 | **Self-raising flour + salted butter** |
| Delia, "basic" 6:4:3 | 62.9 | 42.9 | — | **T3/T4** | **Rests entirely on SEO-farm text** |
| Delia, *Complete Cookery Course* | 33.3 | 66.7 | — | T4 | Contains baking powder |
| Nigel Slater, *Real Fast Puddings* | 100.0 | 57.1 | — | T4 | Via Cloake |
| Nigella, *How to Eat* | 75.0 | 62.5 | — | T4 | Via Cloake |
| Nigella, Jumbleberry | 50.0 | 37.5 | — | T1 | Contains baking powder |
| Nigella, Apple &amp; Walnut | 50.0 | 45.0 / 58.0 | — | T1 | **Two different figures in my own tables** |
| Mary Norwak, *English Puddings* | 66.7 | 33.3 | — | T4 | Cloake altered it before testing |
| BBC Good Food | 62.9 | 62.9 | pinch | T2 | **Oven temperature never recovered** |
| BBC Food (Merrilees Parker) | 66.7 | 58.3 | pinch | T2 | Room-temp butter; primary page likely dead |
| Jamie Oliver | 50.0 | 50.0 | none | T1 | **See 3.4** |
| GoodtoKnow | 66.7 | 56.7 | none | T1 | **6,276 ratings** — largest in the project |
| Ottolenghi, cheesecake crumble | 66.7 | 66.7 | **1.90** | T1 | **Not a fruit crumble** — a cheesecake garnish |
| Ottolenghi, blueberry muffins | 66.7 | 33.3 | — | **T3** | Not a crumble either |
| Kitchen Sanctuary | 80.0 | 80.0 | pinch | T1 | Richest texture vocabulary in the corpus |
| ATK apple crumble | 60.0 | 69.7 | 2.01 | T1 | **4.0★, 415 reviews** — best-evidenced |
| ATK apple crumb pie | 135.5 | 119.3 | 2.55 | T1 | **3.5★, 13 reviews.** US outlier |
| King Arthur streusel | 95.0 | 88.3 | 1.19 | T1 | 4.5★, 6 reviews |
| Great British Chefs | 68.0 | 44.0 | ? | T1 | Topping baked separately as granola |
| *delicious.* magazine | 100.0 | 100.0 | pinch | **T3** | Also separately pre-baked |

### 3.3 Ratings — 6 of 20 captured

| Source | Stars | Count |
|---|---|---|
| GoodtoKnow | not shown | **6,276 ratings** |
| ATK Apple Crumble | 4.0 | **415 reviews** + 218 comments |
| ATK Apple Crumb Pie | 3.5 | 13 |
| King Arthur Streusel | 4.5 | 6 |
| Kitchen Sanctuary | 4.38 | 8 votes |
| Taming Twins *(excluded, oat-bearing)* | 5.0 | ~6 |

The brief asked for "highly-rated recipes with large review counts." **Only two
sources exceed 400 reviews. That priority was effectively not met**, and the
researcher did not say so at the time.

### 3.4 The Jamie Oliver problem

200 g of topping over 750 cm² for 8 people — **0.267 g/cm², under a third of
everyone else, and 25 g of topping per person.** It is the single most
influential row in the load range: it alone stretches fruit-to-topping from ~4.6
to 7.5 and the load range from 0.95 down to 0.267.

**It was never sanity-checked against the possibility of a publishing error.**
If that row is wrong, the "11× spread" headline this project has repeated
shrinks materially. **Flagged as requiring verification before the load figure is
treated as settled.**

### 3.5 Four toppings contain chemical leavening

Delia CCC (1 tsp baking powder), Delia Nut Crumble (1 tsp), Nigella Jumbleberry
(½ tsp), and Delia's Best Ever via self-raising flour. **They were compared
directly against unleavened toppings throughout.** The model's crumble vertex is
unleavened, which is the majority position but not a universal one.

### 3.6 "Sandy" is contested, not settled

The texture pass concluded on Cloake's authority that *sandy* is a defect word.
**BBC Good Food uses it as a positive processor target** — "pulse in a processor
until sandy." That quote was in hand and not weighed against the conclusion. The
honest position is that the term is contested.

### 3.7 Author over-representation

Delia holds 3 rows, Nigella 2, Ottolenghi 2, ATK 2. **Nine of 20 rows come from
four voices.**

### 3.8 Five formulas collected and silently dropped

From the same blog page as the Delia CCC transcription: Delia's Nut Crumble
(42.9/42.9), Stem Ginger (100/50), Chocolate Macadamia (75/50), a Fudgey crumble
with **no flour at all**, and a Sainsbury's Choc-Nut (80/25). Including the two
clean ones would have widened the butter range's upper half and pulled sugar
down. **A curation decision that moved the numbers.**

### 3.9 Not retrieved

Good Housekeeping UK (**zero data, never recovered**) · Guardian/Cloake primary ·
bbcgoodfood.com direct · *delicious.* (403) · two further Delia recipes (403) ·
River Cottage (wrong page returned) · **Mary Berry — no usable data at all**,
search returned only SEO farms with mutually contradictory figures · Paul
Hollywood · Waitrose · Serious Eats · **McGee, never attempted at all**

---

## 4. American crisp corpus

**16 oat-bearing sources.** Oat fraction median **40.6%** — the tightest figure
in the survey. Butter 70.1, sugar 86 across a 36–141 range.

### 4.1 The finding that most threatens the crisp vertex

**Five canonical "crisps" contain no oats whatsoever:**

| Source | Structure | Note |
|---|---|---|
| **Serious Eats, The Best Apple Crisp** | flour + toasted pecans + turbinado | **Won a blind three-way bake-off** |
| Chez Panisse, Warren Pear &amp; Huckleberry | flour + ground almonds | Sugar 17.5 — less than half the lowest oat-crisp |
| *Fanny at Chez Panisse* | flour + butter + sugar | No oats, no nuts |
| Chez Panisse, adapted | flour + almonds | — |
| **ATK's own *Fruit Crisp* (905)** | flour + chopped nuts | *"the ideal topping mixture to be chopped nuts and flour"* |

Normalised on this project's basis, Serious Eats sits at **oat fraction 0, butter
145, sugar 165, nuts 100** — every one outside the range of all 16 oat-bearing
sources.

**And Dorie Greenspan says the oats are optional.** The most authoritative baker
in the set treats the defining ingredient of this model's crisp vertex as a
variable.

The defensible reading: **the American crisp is defined by a rubbed dry topping
over fruit, and oats are one of two structural fillers — the other being nuts.**
A vertex defined purely by oat fraction classifies five canonical crisps as
not-crisps.

### 4.2 Ratings — 5 of 16 captured

| Source | Stars | Count |
|---|---|---|
| **Betty Crocker** | 4.6 | **854 reviews** |
| King Arthur Classic | 4.8 | 214 |
| Sally's Baking Addiction | 4.8 | 171 |
| Inspired Taste | 5.0 | 74 (191 comments) |
| Once Upon a Chef | 4.82 | 90 |

Betty Crocker — the most publicly validated formula in the corpus — has the
**lowest fruit-to-topping ratio of all 16 (1.73)**, i.e. the most topping-heavy.
It sits at the opposite end from ATK's 5:1 doctrine.

### 4.3 The measurement-convention artefact

ATK's flour cup is **142 g**; King Arthur's is **120 g** — an 18% gap on the
denominator of every normalised figure.

| Convention | Implied g/cup |
|---|---|
| ATK | 141–142 |
| Inspired Taste | 133 |
| Sally's | 125 |
| **This project's factor** | **125** |
| King Arthur | 120 |

Re-running everything on one uniform convention moves the oat-fraction median
only **40.6 → 41.9**, so the headline is robust. **But the direction is
systematic:** all five ATK recipes rise 3–4 points. The apparent "ATK uses
proportionally fewer oats" pattern is **substantially an artefact of ATK's heavy
flour cup, not a real formulation difference.**

### 4.4 Two rows that may not be independent

- **Once Upon a Chef appears derived from Martha Stewart.** Both carry the
  distinctive line "½ cup plus 2 tablespoons granulated sugar, divided", the same
  flour-family structure, cold cubed butter and old-fashioned oats. They split the
  divided sugar differently, which is why they land at 141.4 and 42.6 total sugar
  — the two extremes of the range. **If they share a lineage they are one data
  point, not two.**
- **Ina Garten reuses one master topping** across at least three published
  recipes. "Ina Garten" is one formula, not evidence of convergence.

### 4.5 The Epicurious row is probably contaminated

Its pan, servings, temperature and bake time came back **identical in every
particular** to Dorie Greenspan's — same 9-inch Pyrex pie plate, same 6 servings,
same 350 °F, same ~1 hour, both mixed-berry crisps. The researcher's own verdict:
likely conflated.

**It sets the maximum of the oat-fraction range.** Dropping it narrows
31.4–59.0 to **31.4–49.0**.

### 4.6 Mixing order — captured for only 6 of 16, and it splits three ways

| Order | Sources |
|---|---|
| Oats **after** butter is cut in | ATK Cranberry-Apple, Sally's, Martha Stewart |
| Oats **with the dry**, before butter | King Arthur, Bon Appétit, Dorie, Epicurious |
| Oats **second** — butter → sugar → oats → flour | Smitten Kitchen |

Only Sally's gives a reason: *"you just don't want the oats to break down too
much."* A real formulation variable, under-collected.

### 4.7 Where the "oats absorb moisture" folklore comes from

The pass that went looking for a mechanism found that **every confident answer
originated from AI-generated SEO pages** — eathealthy365.com, recipecan.com,
wellness.alibaba.com, cooklikemom.net and similar. "Oats absorb moisture from the
butter", "quick oats absorb too much moisture and turn dense or pasty", "add a
pinch more flour so the topping absorbs less". **None traces to Corriher, Figoni,
McGee, or any test kitchen.**

This is the folklore the model encoded at weight 0.38 and has since removed.

### 4.8 Not retrieved — twelve domains

Serious Eats (blocked at every layer) · **NYT Cooking — zero coverage** ·
Allrecipes · Epicurious · Bon Appétit · Martha Stewart · Simply Recipes · The
Kitchn (403) · Food Network (403) · Taste of Home (403) · food.com (403) ·
Food52 (429, three attempts) · **Joy of Cooking — never landed**

Of the ten named authorities, three produced **no verified primary data at all**.

---

## 5. Sweet biscuit cobbler corpus

**17 category-(a) sources**, plus 10 savoury drop biscuits, 3 batter cobblers, 4
sonkers and 5 Gisslen textbook formulas.

### 5.1 The strongest cross-check in the project

King Arthur's cherry cobbler states **9 mounds × 50 g = 450 g** of dough. The
independent sum of its ingredient list gives **443.0 g — a 1.6% agreement.**

This validates the topping-weight methodology across the whole corpus, and it is
the only place any source publishes a figure that can be checked against the
arithmetic.

### 5.2 Ratings — **zero captured, for every single source**

The largest outright gap in the project. Never requested during the cobbler
passes, so nothing was returned. **No rating data exists for any of the 30+
cobbler sources.**

### 5.3 Sources that should be dropped or demoted

| Source | Problem |
|---|---|
| **Foodtalk Daily** | 2025 date, generic "Rockin' Recipes" byline, SEO title, interchangeable frozen/fresh/canned ingredient line, and an **implausible formula** — 113.6 g butter against 80 g milk on 187.5 g flour would barely cohere. **Probably content-farm or AI-generated.** It also entered the corpus under a false *Southern Living* association |
| **Alton Brown** | **Internally contradictory** — 120 parts liquid per 100 flour with zero added fat, yet rolled out and cut with a pizza cutter. That is a pourable batter. Either misprinted or the reprint is corrupted |
| **ATK Easy Blueberry** | **283 g of blueberries in a 13×9 pan** gives fruit:topping of 0.33, the extreme point of the batter range. Suspicious, unverified |
| **"Magic Cobbler"** | Folk canon, no named author, reconstructed from a search summary, no pan size. Weakest source in the log |
| **The Butter Book** | **32% of its "flour" is almond flour**, which contributes no gluten. Its per-100-flour figures are not commensurable with the wheat recipes |

### 5.4 Fewer independent formulas than URLs

ATK 1468 and 1469 are one formula with cornmeal swapped for 2 Tbsp of flour. ATK
3913 and 7817 are identical under two titles. Once Upon a Chef's blueberry and
apple cobblers are numerically identical. **Roughly 16 distinct formulas across
19 category-(a) entries.**

### 5.5 The underside disagreement, in full

| Position | Source | Quote |
|---|---|---|
| **Defect** | Carlsbad Cravings | "soggy topping underneath" |
| **Defect** | King Arthur | "runny filling and gummy biscuits" |
| **Inevitable** | Smitten Kitchen | "the undersides will be wet where they touch the fruit" |
| **Desirable** | Sally's | **"crisp on top, but soft and moist underneath"** |
| **The whole point** | Sonker | "The fruit really steamed it like a dumpling" |

This is why the model weights the soggy-underside defect low and separates it
from *uncooked*, which every source agrees on.

### 5.6 Nobody explains their oven temperature

**Not one source in 30.** Firm negative result. Only King Arthur gives an
internal temperature — 212 °F — and it is a *filling-boiling* cue, not a crumb
cue.

### 5.7 Gisslen — the only self-verified material in the project

Extracted directly from the textbook PDF by zlib-decompressing the content
streams, so it is the one place where "verbatim" means verbatim.

| Formula | Fat | Sugar | Liquid | BP | Soda | Salt |
|---|---|---|---|---|---|---|
| Biscuits I | 35 | 5 | 65 milk | 6.0 | 0 | 2.0 |
| Biscuits I, buttermilk variation | 35 | 5 | 65 buttermilk | 4.0 | **1.0** | 2.0 |
| Biscuits II (creaming) | 19 | 10 | 67.5 water+egg | 5.0 | 0 | 1.25 |
| Scones | 40 | 12.5 | 45 milk +15 egg | 6.0 | 0 | 1.0 |
| **Cranberry Drop Scones** | 25 | 21 | 58 milk +5.5 yolk | 5.0 | 0 | 1.0 |
| English Cream Scones | 31 | 12.5 | 50 cream +25 egg | 4.4 | 0 | 1.25 |

**All five percentage columns sum correctly to their stated totals** — a strong
internal-consistency signal.

Two things the textbook says that no recipe source does:

> **"Unkneaded dough spreads more than kneaded dough and has a more cakelike texture."**

The only mechanistic statement anywhere in the corpus linking handling to spread
— directly relevant to the slump model.

> **"Biscuits approximately double in height during baking."**

Independent support for this model's 1.7× oven-expansion figure at the cobbler
vertex.

**Caveat:** Gisslen's metric column is *soft-rounded, not converted* — 1 lb 4 oz
is 567 g, printed as 600 g. **The percentage column is the authoritative layer.**
Also note baking powder at 6% is far above modern practice (category-(a) median
3.8–4.0).

### 5.8 Sonker — complete

| Version | Fat | Sugar | Liquid | Type |
|---|---|---|---|---|
| Rockford General Store | **14.5** | 0 in dough | **50.8** | rolled pastry |
| Pastry Chef Online | 45.2 | 28.4 | 68.0–72.4 | rolled sweet biscuit |
| Spiral Bound Foodie | 90.9 melted | 80.0 | 96.0 | poured batter |
| Surry County "cuppa" | 90.9 melted | 130.0 | **192.0** | poured batter |

**The Rockford crust is the driest thing in the entire project** — and it gets
its rollability from very low fat as much as low water. Combined liquid + fat is
65.3, against a category-(a) median of ~123.

Every difference-from-cobbler quote collected:

- "juicier than cobbler" — *Our State*
- "a close cousin to a cobbler, but juicier, more soupy" — Garden & Gun
- "a hybrid between a cobbler and a deep-dish pie" — Sonker Trail
- "A soupy, deep dish baked dessert… topped with a crust or a batter" — NYT, quoted second-hand
- "a juicy cobbler by any other name" — Pastry Chef Online
- **"Rather than a crunchy, crumbly top, or even a biscuity top, the batter is more like a pancake"** — Spiral Bound Foodie
- **"it doesn't rise much, it's designed to stay flat"** / **"Sonker, like sinker…as in it sinks and stays flat"**
- **"The fruit really steamed it like a dumpling, while the top baked to golden, buttery perfection"**

**The milk dip** — poured over at 40 minutes, then baked 15–20 more — is a
deliberate late-stage **re-wetting**, the exact inverse of steam venting.
Described as *"sort of like melted Philadelphia-style ice cream"*, it *"soaks
into the filling during baking."*

### 5.9 Soda-to-buttermilk, complete

| Source | Ratio | vs 0.0100 |
|---|---|---|
| Once Upon a Chef ×2 | 0.00500 | pass |
| Once Upon a Chef Peach | 0.00750 | pass |
| **Sally's** | 0.01000 | at the line |
| **Dorie Greenspan** | 0.01000 | at the line |
| **ATK Best Drop Biscuits** | 0.01000 | at the line |
| **ATK Buttermilk Drop Biscuits** | 0.01000 | at the line |
| Tori Avey | 0.01333 | **fail** |
| The Butter Book | 0.01429 | **fail** |
| Gisslen (textbook) | 0.01538 | **fail** |

**Five independent arrivals at exactly 0.0100**, counting the traditional
"½ tsp soda per cup of sour milk" rule (2.4/240 = 0.0100 exactly). A separate
practice at **0.0050** — a quarter-teaspoon per cup — matches the entire Once
Upon a Chef family. Those are the two attractors in real use.

The three failures **fail every candidate ceiling between 0.0089 and 0.0117**, so
the finding does not depend on where the line is drawn. **The worst offender is
the professional textbook, not a blog.**

**Seven of 15 category-(a) toppings use no soda at all.**

---

## 6. Food-science claims — working and gaps

### 6.1 What was actually accessible

**Zero of the eight priority books were consulted.** McGee, Corriher, Figoni,
Migoya & Myhrvold, Barham and ATK's science titles: none available. Serious Eats:
hard-blocked. The verification rests on **five directly-fetched pages** — three
King Arthur, two ATK — plus search-layer summaries of journal abstracts, two
USPTO patents, and the researcher's own chemistry.

### 6.2 The buttermilk/soda working, in full

```
m(NaHCO₃) = 240 × (TA/100) × (84.0066 / 90.078)
```

| Titratable acidity | NaHCO₃ neutralised | Ratio |
|---|---|---|
| 0.60% (US regulatory floor) | 1.343 g | 0.00560 |
| 0.75% | 1.679 g | 0.00699 |
| **0.80% (this model)** | **1.791 g** | **0.00746** |
| 0.85% | 1.903 g | 0.00793 |
| 0.95% (high-acid protocol) | 2.126 g | 0.00886 |

Reverse check: 2.8 g soda would require **1.25% acidity**, above any commercial
cultured buttermilk. The original ceiling was **not stoichiometric**.

**Why titratable acidity is the right measure:** TA is titrated to the
phenolphthalein endpoint at pH 8.3, which is close to the pH of a bicarbonate
solution — so it captures casein and phosphate buffering as well as lactic acid.
Do not "correct" it down to true lactic acid; that would under-count.

### 6.3 CO₂ yield — the 1:3.5 equivalence checked two ways

| Route | g CO₂ / g |
|---|---|
| Soda, acid-reacted | 0.5239 |
| Soda, thermal only | 0.2619 |
| Baking powder @ 30% bicarb | 0.1572 |

Stoichiometric ratio **3.33** (range 3.13–3.57 across 28–32% bicarb powders).
Volumetric cross-check: ¼ tsp soda @ 4.6 g/tsp = 1.15 g against 1 tsp powder @
4.0 g/tsp = 4.00 g → **3.48**. Two independent routes bracket 3.33–3.48; the
model's 3.5 is sound and slightly conservative.

**Corollary the model uses:** soda leavens even with zero acid, via
`2 NaHCO₃ → Na₂CO₃ + H₂O + CO₂`. It just yields half the CO₂ and leaves the
alkaline residue that reads as soapy.

### 6.4 The vegan acid substitute, across the plausible range

| Lemon juice citric % | % of buttermilk capacity |
|---|---|
| 4.00 | 43.9% |
| 4.87 (measured, Penniston et al.) | **53.5%** |
| 5.16 (fresh-squeezed) | 56.7% |
| **7.20 (bottled)** | **79.1%** |

The model's 54% sits on the fresh-lemon, three-proton case. **Bottled juice is a
materially different ingredient** — 48% more acid — and arguably deserves its own
parameter.

Two-proton sensitivity: if only two of citric acid's three protons counted, the
figure would drop to ~36%. Three is correct at the pH 8.3 endpoint, since
pKa₃ = 6.40.

### 6.5 Glass transition — the theoretical backbone, and its weak provenance

**The 10 °C-per-1%-water plasticisation figure arrived via search summary and was
never traced to a primary.** It is a linear approximation of an inherently
non-linear relationship; the standard treatment is the Gordon–Taylor equation,
and plasticisation is steepest at low moisture.

**No Tg value for any specific sugar was retrieved this session.** These are all
recalled, not sourced, and all require verification:

| Compound | Tg (°C) | Status |
|---|---|---|
| Fructose | ~5 | **unverified** |
| Glucose | ~31 | **unverified** |
| Sucrose | ~62 (reported 52–70) | **unverified** |
| Maltose | ~87 | **unverified** |
| **Lactose** | **~101** | **unverified** |

Two implications the researcher flagged as their own synthesis, not findings:

- **Sucrose inversion is intrinsically Tg-lowering** — it replaces one Tg-62
  species with one at 31 and one at 5, independent of added moisture. Acidic fruit
  contact plus heat promotes inversion.
- **Lactose is the highest-Tg sugar in the system**, so losing butter's milk
  solids may cost crispness as well as colour. Speculative.

**Nothing was found mapping molasses content to Tg depression.** The chain
"molasses → invert sugar + water → lower Tg → softer topping" is mechanistically
orthodox and consistent with craft observation, but **no source states it.**

### 6.6 The 100 °C interface argument — status: unverified synthesis

**No source states it.** The derivation is standard physics assembled by the
researcher, and it is set out formally with each step labelled textbook or
synthesis. Where it is weakest, in their own words:

- **Local drying.** Late in a bake, patches may exhaust free water and rise above
  100 °C. Pinning is a *while-water-remains* constraint, not eternal.
- **Sugar concentration.** As water leaves, sugar concentrates and boiling point
  rises — potentially well above 105 °C at high Brix. A real escape route the
  derivation under-weights.
- **Capillary transport.** Liquid wicks *into* the topping, moving the pinned zone
  upward. This makes things worse, not better.

Closest empirical anchor: ATK's *"Bake the berry filling first so that its heat
cooks the buttermilk biscuits from the bottom up."* It recognises the interface
as thermally limiting; it says nothing about pinning, boiling or latent heat.

**Why the model prefers it anyway:** the competing craft explanation —
condensation of trapped vapour — cannot explain why an *open* crumble, which
traps nothing, still sogs underneath. The pinning model does.

**It is testable.** A thermocouple at the interface across one bake would confirm
or kill it.

### 6.7 Two corrections the researcher made to their own earlier reporting

1. The par-baking finding was attributed to an ATK *article*; fetching it showed
   **the article contains no such text** — it is in the recipe headnote.
2. A search summary asserted ATK said cold-butter biscuits "fall to pieces on the
   hot filling" and that melted butter prevents gumminess. **The page contains
   neither sentence.** That claim was reproduced in an earlier summary and is
   **struck**.

### 6.8 Unresolved

- **The browning deficit from missing milk solids has never been quantified.** No
  percentage, no ΔE, no L* difference exists in any source. Any figure encountered
  should be treated as fabricated until traced.
- **Blueberry pectin.** King Arthur's chart says "high pectin content"; the only
  quantitative compilation classifies it low. **No numeric value for blueberry was
  found anywhere.** Do not build on it.
- **Whether acid hydrolysis matters at domestic bake conditions** (pH 3.3, ~100 °C,
  under an hour). Every degradation study retrieved used ~1.0 N acid — pH ~0.
  Nothing addresses the domestic case.
- **Tapioca vs cornstarch RVA breakdown, head to head.** No comparative data
  retrieved. The suggestion that this model may have the stability direction
  backwards is a **hypothesis, not a finding**.
- **Xanthan g/tsp** is unverified and load-bearing: the entire dosage
  reconciliation collapses without it. At 2.4 g/tsp the King Arthur baseline is
  0.50% of flour; at 3.4 g/tsp it is 0.71%.

### 6.9 What bad data looks like on this topic

Two AI content farms surfaced repeatedly, ranking on **exactly** the
mechanism queries that matter. Their specific false claims:

> *"fat acts as a selective membrane—its melting point and saturation level determine whether it blocks liquid water while allowing vapor to escape"*

Pseudo-scientific. Fat in a crumble is a discontinuous phase with no mechanism
for discriminating liquid water from vapour.

> *"tapioca starch (from cassava root) is >99% amylopectin"*

Flatly wrong — that describes waxy maize. Native tapioca is ~16–17% amylose.

> *"Rhubarb pie (pH ≈ 3.2): cornstarch begins degrading after 4 minutes at 200°F—requiring immediate transfer to crust and baking within 5 minutes of mixing"*

Four operational parameters, no source, and an absurd instruction.

**The two farms agree with each other and disagree with the primary literature** —
likely a shared upstream text. **Corroboration between two content farms is worth
nothing.**

Detection heuristics worth keeping: authority words without method ("Lab-Tested",
"Science-Backed", "Complete Guide") · precision without provenance · no author,
no date, no references · topic drift mid-article · present-year in the title ·
real technical vocabulary in impossible configurations.

A homework site also surfaced with **self-contradictory** buttermilk figures —
"0.54 mol/L" and "0.27 molar" in the same passage, both 3–6× the real value.
A textbook problem reverse-engineered from the folk rule, then circulated as fact.

---

## 7. Dataset health

| Corpus | Independent formulas | Direct fetches | Rating data |
|---|---|---|---|
| British crumble | ~16 of 20 rows | 13 T1 | 6 of 20 |
| American crisp | ~13 of 16 rows | 13 of 16 | 5 of 16 |
| Sweet cobbler | ~16 of 19 rows | most | **0 of 30+** |
| Food science | — | **5 pages total** | n/a |

**The most robust finding in the project** is the crumble butter median of 66.7,
which survived every subset cut attempted.

**The least robust** are the salt figures — four values, one of which is a
cheesecake garnish and one a mis-converted kosher measure — and anything
depending on the unverified xanthan and Tg constants.

### Priority repairs

1. Drop or re-verify the **Epicurious crisp row** (likely conflated with Dorie)
2. Resolve **ATK's 7 cups vs 2½–3 lb** fruit contradiction
3. Verify **Jamie Oliver's 200 g topping** — the load range depends on it
4. Verify the **four zero-salt crisps** against the actual pages
5. Decide whether **Once Upon a Chef / Martha Stewart** are one lineage, and
   whether **Ina Garten** counts once or three times
6. Trace the **10 °C/1% water** figure and the **sugar Tg values** to primaries
7. Recover **Serious Eats, NYT Cooking and Joy of Cooking** by another route

### Still outstanding

Three research passes died on session limits before reporting: **recipe reviews
and reception**, **the fruit-dessert taxonomy and the dispersion question**, and
**the peer-reviewed literature search**. The academic pass had reached a
provisional finding — that an RVA result "looks self-contradictory versus
standard consensus" — before it was cut off. Sections 8 and 9 remain unwritten.

---

## 8. Reviews and reception — Food.com, n = 9,757

Source: `irkaal/foodcom-recipes-and-reviews` (Kaggle), 522,517 recipes and
1,401,982 reviews. Pipeline: [`scripts/kaggle_corpus.py`](scripts/kaggle_corpus.py).

### 8.1 What this corpus can and cannot do

**It cannot give ratios.** Food.com's structured ingredient fields record the
quantity and **strip the unit**: `flour: 1/2`, `butter: 6`. Zero of 60,000
quantity strings sampled contain any unit word. Grams are not recoverable without
inferring conventional units per ingredient, which is exactly the plausible-but-
unverified move this project has repeatedly been burned by. **No ratio from this
dataset is used anywhere in the model.**

**It can give reception**, which is what hand-scraping repeatedly failed to
deliver — three separate research passes died before collecting cobbler ratings.

**It is not authoritative.** User-submitted recipes measure what home cooks post,
not what works. Where it disagrees with the curated survey that is a finding, not
a reason to overwrite.

### 8.2 Corpus shape

| Dish | Recipes | Rated | Median rating | Reviews matched |
|---|---|---|---|---|
| crisp | 1,278 | 682 | 5.0 | 3,284 |
| cobbler | 1,066 | 579 | 5.0 | 4,303 |
| crumble | 417 | 191 | 5.0 | 1,090 |
| baked oatmeal | 111 | 61 | 5.0 | 580 |
| clafoutis | 95 | 46 | 4.5 | 197 |
| betty | 71 | 27 | 5.0 | 95 |
| buckle | 60 | 32 | 5.0 | 150 |
| grunt / slump / pandowdy | 47 | 26 | 4.5–5.0 | 25 |

Note the median rating is **5.0 for almost everything** — user-submitted recipe
sites have severe positivity bias, so ratings carry little signal. The review
*text* is where the information is.

### 8.3 A methodological finding that matters more than the counts

The first pass counted raw keyword hits. An audit found:

| Bucket | Raw hits | False positives | Rate |
|---|---|---|---|
| "too sweet" family | 391 | **170 were "NOT too sweet"** — praise | **43.5%** |
| "dry/powdery" family | 243 | **60 were "dry ingredients"** — procedural | **24.7%** |

Both buckets were roughly **double their true size**. Keyword counting without
negation handling is not measurement. The corrected patterns, with explicit
negation sets, are in the script and unit-tested.

### 8.4 The falsifiable sugar check — ANSWERED

This project set crumble sugar at 57 and crisp at 75 per 100 flour, both **below**
the surveyed medians (57 and 86), partly on taste. That was flagged at the time
as the most opinionated choice in the model. The test: do reviewers cut sugar or
add it?

| Dish | too-sweet + cut sugar | wanted more sugar | Ratio |
|---|---|---|---|
| crisp | 188 | 56 | **3.4 : 1** |
| cobbler | 353 | 71 | **5.0 : 1** |
| crumble | 32 | 15 | **2.1 : 1** |

**All three favour less sugar, decisively, after correcting for negation.**
"Reduce the sugar" is the single most common cobbler modification at 5.25% of all
cobbler reviews. The judgement call is supported at a sample size the hand survey
could never have reached — and the cobbler vertex, set to the restrained cluster
at 30 rather than the dessert-forward one at 40–60, is the best-supported of the
three.

### 8.5 Failure modes, corrected counts

| Failure | crisp (n=3,284) | cobbler (n=4,303) | crumble (n=1,090) |
|---|---|---|---|
| **runny filling** | **2.56%** | **2.07%** | 0.83% |
| more topping wanted | 2.53% | 0.44% | **3.21%** |
| soggy | 1.16% | 1.02% | 1.38% |
| dry / powdery | 0.88% | 0.77% | 1.38% |
| gummy / undercooked | 0.15% | 0.84% | 0.55% |
| burnt | 0.52% | 0.51% | 0.46% |
| tough / dense | 0.18% | 0.28% | 0.18% |

**Three things the model should take from this:**

1. **Runny filling is the top defect in two of three dishes, and the model does
   not score it at all.** It computes a thickener dose but never asks whether the
   filling sets. This is a genuine gap, and it is a more common real-world failure
   than every topping defect the model does score.

2. **Soggy is low everywhere (1.0–1.4%)**, which supports weighting that defect
   low — a decision made on the grounds that the corpus disagreed about whether a
   moist underside is even a fault. Independent support at n=8,677.

3. **Gummy/undercooked is the *rarest* defect (0.15–0.84%), yet carries the
   model's highest weight (1.3).** It is highest in cobbler, which matches the
   prediction that it is a wet-topping problem. But frequency is not severity —
   a gummy underside may be rare because recipes are well tested, and ruinous when
   it happens. **Recorded as a tension, not acted on.** Re-weighting on incidence
   alone would confuse how often people mention something with how much it matters.

**"More topping" is the top crumble complaint (3.21%)** and fourth for crisp,
while "not enough topping" as a phrase is near-zero. People add topping rather
than describing a shortfall. Whether that means the surveyed load medians are
light, or simply that people like topping, this data cannot distinguish.

### 8.6 Reproducing

```bash
python3 scripts/kaggle_corpus.py      # needs ~/.kaggle/kaggle.json
```

---

## 9. Reception, from curated sites — and a correction to §8.4

1,069 reader comments read directly from raw HTML (not search summaries), plus
full ratings for every cobbler in the survey. This section **partly retracts the
sugar conclusion in §8.4**.

### 9.1 Cobbler ratings — the gap is closed

| Recipe | Stars | Rating count | Comments |
|---|---|---|---|
| Once Upon a Chef peach | 4.91 | 101 | 240 |
| Once Upon a Chef blueberry | 4.84 | 54 | 102 |
| Sally's fresh peach cobbler | 4.8 | 146 | 505 |
| King Arthur buttermilk biscuit cherry | 4.7 | 3 | — |
| Tori Avey drop biscuit | 4.72 | 7 | 24 |
| Beyond Kimchee peach | 5 | 9 | 11 |
| Savory Nothings strawberry | 5 | 5 | 3 |
| Getty Stewart berry | 5 | 4 | 0 |
| Smitten Kitchen cornmeal drop | *no rating system* | — | 310 |
| **Carlsbad mixed berry** | **5 — from n=1** | *not displayed* | 4 |
| **GoodTo crumble topping** | **3.0** | **6,276** | — |

Two of these deserve flags.

**Carlsbad renders five solid stars with no count at all.** The JSON-LD says
`ratingCount: 1`, and that is probably *correct* rather than corrupt — the page
has 4 comments, of which only 2 are readers. The defect is presentational: a
confident five-star display backed by a single vote, with the sample size
hidden. **Recorded as 5★ from n=1, never as 5★/4.**

**GoodTo scores 3.0 across 6,276 ratings** — by far the largest sample in the
entire survey, and the *lowest* rating in it. Worth knowing, since this project
has cited GoodTo's crumble ratios.

Rating and comment counts diverge by 2–3.5× wherever both exist. Once Upon a
Chef's JSON-LD carries a third figure, `reviewCount`, matching neither — treat as
junk.

### 9.2 The sugar finding is narrower than §8.4 claimed

§8.4 reported that too-sweet-plus-cut-sugar outnumbers wants-more-sugar by
3.4:1 (crisp), 5.0:1 (cobbler) and 2.1:1 (crumble), and concluded this
**supports** setting the sugar vertices below the surveyed medians. That
conclusion was over-stated, and reading actual threads shows why.

**Sally's apple crisp** (539 comments read in full, negation-guarded):
too-sweet or cut-sugar **19**, wants-more **0**. Not 3.4:1 — nobody in 391
reader comments asked for more sugar. The author concedes it in-thread: *"Feel
free to cut down on the sugar to 1/3 cup."*

**Sally's peach cobbler — the direction REVERSES.** It is an explicitly
reduced-sugar formula; one commenter notes *"it calls for less sugar than other
recipes."* After removing false positives by hand: true too-sweet **1**, wants-
more **3**, including *"the biscuit topping wasn't sweet enough… needed a tad
more sugar."*

**So the complaint direction tracks each recipe's actual sugar load and flips
when that load is low.** The aggregate ratios in §8.4 measure the fact that the
Food.com corpus is sugar-heavy on average. They are **not** evidence of a
universal palate preference, and a model that shifts sugar down globally will
manufacture the opposite defect.

What survives: the vertices sit below medians drawn from a demonstrably
sugar-heavy population, which is defensible. What does not survive: the claim
that lower is simply better. There is a floor, and Sally's peach cobbler found it.

### 9.3 "More topping" is a preference, not a defect — do not raise the loads

§8.5 flagged "more topping" as the top crumble complaint and left open whether
the surveyed loads are light. Reading the threads settles it three ways:

1. **The author invited it.** Smitten Kitchen's post body reads *"there can never
   be enough biscuit topping, go ahead and double what is suggested below."* So
   all 16 of 310 commenters who doubled were following instructions. **None**
   described the published amount as an error.
2. **The verbatims are appetite, not fault** — *"when the biscuits taste so good,
   why skimp?!"*; *"sometimes double the crunch because we cant have enough!"*
3. **Doubling actively backfires.** *"I doubled the amount as many suggested but
   I think it was too much"*; another reader's biscuits merged into "almost one
   complete mass", leaving them *"raw underneath."*

And on Sally's peach cobbler the complaint **inverts** — zero requests for more,
four saying there is too much: *"There was too much topping for the amount of
peaches"*, *"only use half of the topping."*

**Conclusion: treat as a palatability preference term, not a defect. Do not
increase the load medians.** Genuine under-coverage exists but is phrased
differently ("too sparse", "didn't cover") and is driven by **pan geometry, not
the recipe** — one reader's topping was fine in a 9×13 and sparse split across
two 9×9s.

### 9.4 Filling set is a TWO-SIDED target, and the model scores neither side

§8.5 identified runny filling as the top unmodelled defect. Confirmed at
14/1,069 (1.3%) — and importantly, these readers **followed the thickener spec
and still got soup**, which is exactly the distinction between computing a dose
and asking whether it sets.

But the opposite failure is nearly as common, and was invisible to keyword
counting: **dry / under-set filling at 12/1,069 (1.1%)**.

> *"the gooey consistency was very low, too dry for me"* · *"I followed the
> directions and this came out so dry"* · *"no water or other liquid is added to
> the apples"*

It concentrates in **apple** crisp, which makes physical sense — apples free far
less juice than peaches or berries. **Scoring only "does it set" would push
recipes straight into this failure.** Any filling-set term must be two-sided and
fruit-specific.

### 9.5 Three further gaps, in order of size

1. **Pan-size substitution is the single largest source of failure reports —
   34/1,069 (3.2%), larger than any texture defect.** Readers constantly halve,
   double or swap 9×13 ↔ 8×8 ↔ two 9×9s, and it is the proximate cause of sparse
   topping, raw undersides and bake-time complaints. This model already takes
   dish dimensions, so depth-driven failure is the highest-yield thing it could
   add.
2. **Browned-on-top-but-raw-underneath is ONE coupled event, not two.** The model
   scores "undercooked" and "soggy underside" independently; in the threads they
   share a single cause — oven temperature too high for the topping thickness.
   *"browned and almost burning on top … the dough was still a little gooey
   underneath."*
3. **Topping-to-fruit proportion causes both filling failures.** One reader's
   topping *"absorbed all of the juice"*; another found it *"a bit dry and felt a
   bit out of proportion."* This couples two subsystems the model scores apart.

### 9.6 Figures confirmed against raw page data

Betty Crocker's rating was computed from the page's own embedded value
(`AverageRating: 0.912412…` on a 0–1 scale, ×5 = 4.562 → displays 4.6) against
`RatingCount: 854` — so the corpus figure is right, and there is a separate
`ReviewCount: 454` for written reviews. King Arthur Classic Apple Crisp
(4.80/214) and ATK apple crumble (415 ratings, 4.03, 218 comments) both match
exactly.

**Blocked:** ATK comment text (`isAccessibleForFree: false`, client-rendered);
Betty Crocker review text (BazaarVoice, no passkey in HTML). Ratings readable for
both, review text not.

**Sample-size caveat:** Once Upon a Chef's peach cobbler ships **1 of 240
comments** in the HTML behind a "Load More" — that thread is effectively
unreadable. Sally's site paginates cleanly, so 539 apple crisp and 498 peach
cobbler comments were reconstructed in full; Smitten ships all 310.

---

## 10. The corpus, expanded — 59 records

`data/sources.json` grew from 18 records to 59, transcribed from the subagents'
full raw dumps rather than their curated summaries. `data/sources.csv` is
regenerated from it; nothing in the CSV is hand-entered.

### 10.1 A bug the expansion exposed, and the structural fix

Adding Once Upon a Chef's crisp — "1/4 cup plus 2 tablespoons all-purpose flour"
— produced fat at **189 per 100 flour** and sugar at **289**. Neither is a real
recipe.

`DEFAULT_FACTORS.flour` had a `cup` entry and no `tbsp`. The line converted to
null, the flour+oats basis collapsed to **oats alone**, and every normalised
ratio inflated roughly threefold.

The missing factor is the trivial half. The important half is what happened next:
**the extractor correctly refused to invent a gram figure, and the normalisation
divided by the wreckage anyway.** A null in one line became confident, wrong
numbers in eleven columns. That is worse than a missing value, because it looks
like data.

Both are fixed. Volume factors now exist for every structural ingredient, and
`extract()` carries a `basisBroken` flag: if any line belonging to the basis
fails to convert, every ratio for that record returns **null** rather than being
computed against a partial denominator.

### 10.2 The full corpus reproduces the vertices independently

The vertices were set from the subagents' reported medians. These figures come
from summing verbatim ingredient lines through the extractor — a separate route.

| | corpus median | vertex | n |
|---|---|---|---|
| crumble fat | **66.67** | 66.7 | 13 |
| crisp oat fraction | **39.39** | 41 | 15 |
| crisp fat | **70.45** | 70 | 15 |
| cobbler fat | **45.44** | 45 | 14 |
| cobbler sugar | **28.04** | 30 | 14 |
| cobbler liquid | **74.51** | 80 | 14 |
| cobbler load | **0.84 g/cm²** | 0.846 calibrated | 14 |

Cobbler liquid is worth noting: at n=5 it read 51.4 and was flagged as diverging
from the vertex. At n=14 it converges to 74.5. **The divergence was a small-sample
artefact**, and the flag was doing its job.

The two remaining gaps are the documented deliberate ones — crumble sugar 62.5
against a vertex of 57, crisp sugar 85.88 against 75. Both sit below the median
on purpose, and §9.2 records the limits of the evidence for that.

### 10.3 Batter cobblers — promoted from special case to their own family

**Superseded in part.** These records now anchor a second triangle rather than
sitting outside the model; see §11. The separation argument below is what
justified giving them their own family rather than folding them in.

Recorded, normalised and summarised — and **no vertex of the RUBBED triangle is
drawn from them**. They are a different food, and the corpus separates them
cleanly:

| | biscuit cobbler (a) | batter cobbler (c) |
|---|---|---|
| fruit : topping | 0.94 – 3.94, median **2.5** | 0.33 – 0.94, median **0.64** |
| sugar per 100 flour | median **28** | median **97** |
| liquid per 100 flour | median 74.5 | median 164 |
| load g/cm² | 0.84 | 1.02 |

**The two ranges meet at exactly 0.94 and do not overlap.** A batter cobbler puts
down roughly the same topping mass per unit area, then puts a third to a seventh
as much fruit under it. It is a cake with fruit in it, and 3.5× the sugar.

Sonkers sit between the two — fruit:topping 1.2–1.6, liquid 68 — and carry the
**heaviest load in the whole survey at 1.38 g/cm²**, consistent with their
deep-dish framing.

One batter-cobbler finding is worth carrying to any future dispersion work: King
Arthur's Fresh Fruit Cobbler pours batter into the pan and places fruit **on
top**, expecting the cake to "rise up and over the fruit as it bakes". That is
partial dispersion achieved by buoyancy rather than by mixing — the closest thing
in the corpus to a real fruit-dispersion mechanism.

### 10.4 Corner anchoring, at n=59

`node scripts/validate-corners.mjs`

**8 recipes rated ≥4.5 stars with ≥20 ratings. All 8 score above 0.70.**

| Corner | Anchors ≥4.5★ | Best model score |
|---|---|---|
| Crisp | 6 | 0.942 (Once Upon a Chef, 4.82★/90) |
| Cobbler | 7 | **0.991** (Once Upon a Chef peach, 4.91★/101) |
| Crumble | **0** | 0.902 (Kitchen Sanctuary, 4.38★/8) |

**The crumble corner still has no ≥4.5-star anchor, and expanding the corpus made
that worse rather than better.** The three crumble ratings now in hand are
4.38★/8, 4.0★/415 and **3.0★/6,276**. Every rating above 4.5 in the entire
survey belongs to an American crisp or cobbler.

That may be a site effect — British recipe sites and US food blogs have different
rating cultures and different audiences — or it may be signal. This data cannot
separate them, and the model should not be tuned on it either way.


## 11. The poured family — a second triangle

The batter cobblers and sonkers of §10.3 now anchor their own simplex. Three
independent facts in the corpus say they cannot be reached by extending the
rubbed one, and each is checked by a test in `test/poured.test.js`.

### 11.1 The gap is real

Surveyed cobbler liquid is **bimodal**: a dough cluster at 41–72 parts per 100
flour, a batter cluster at 94–176, nothing between. `vertices.js` already stopped
the cobbler corner at 80 for this reason — "pushing past ~95 would turn the
cobbler corner into a batter cobbler and change what the whole triangle
interpolates between."

The gap is mechanical, not statistical. A mixture at 80–90 is too slack to hold a
dropped mound and too stiff to pour level: neither technique can assemble it. A
continuous simplex spanning both clusters would emit recipes at hydrations where
no assembly method exists.

`test('THE GAP IS REAL')` asserts the rubbed triangle tops out at 80 and the
poured one bottoms out at 85, with no overlap.

### 11.2 Fat state is discrete

15 of 15 sweet biscuit cobbler toppings containing butter use it **cold**. All
four poured sources use it **melted or softened**. There is no continuum between
rubbing cold fat into flour and pouring melted fat into a pan, so interpolating
across it would invent a technique nobody uses.

### 11.3 The vertices, and their sample sizes

| | n | fat | sugar | liquid | egg | BP | load g/cm² | oven | min |
|---|---|---|---|---|---|---|---|---|---|
| Batter cobbler | **2** | 88 | 158 | 139 | 0 | 4.8 | 1.12 | 177 | 35 |
| Sonker | **1** | 90 | 80 | 96 | 0 | 4.8 | 1.38 | 177 | 38 |
| Pudding cake | **1** | 23 | 165 | 23 | 83 | 3.3 | 0.91 | 190 | 30 |

Against 13–18 sources per rubbed vertex. Stated rather than smoothed.

**A data correction the family required.** ATK's Easy Blueberry Cobbler reads 304
parts liquid and 29 parts sugar in `sources.csv` — both wildly out of line — because
the extractor counts a 14 oz can of sweetened condensed milk entirely as liquid
and none of it as sugar. The record's own flag says so. Decomposing it at
54% sugar / 27% water / 8% fat gives fat 85, sugar 155, liquid 134, which brings
a tier-1 test kitchen and the uncredited folk "Magic Cobbler" (90 / 160 / 144)
within 6% of each other on all three. That agreement is the strongest
corroboration available anywhere in this corpus.

### 11.4 Inversion: real effect, unsourced mechanism

Three of four poured sources describe the layers changing places; King Arthur
states the intent outright ("rise up and over the fruit as it bakes"). The
corpus record for the Magic Cobbler carries the caveat in capitals: **"THE
INVERSION IS REAL BUT ITS EXPLANATION IS NOT SOURCED... Every online account of
the physics traces to content farms agreeing with each other and citing
nothing."**

The model treats it as buoyancy — fluidity × gas, both necessary — and labels it
a model. It picks the assembly and weights one score term. Nothing else depends
on it.

The sonker is the interesting case: it has capacity 0.80 and uses **none** of it,
because its fruit is pre-baked and the batter goes on top. Pre-baking is carried
as a **recipe property** blended like oven temperature, not inferred from
composition — there is one data point for it and inferring a rule from that would
be false precision.

### 11.5 No calibration is possible here

**Not one of the six poured or sonker records carries a rating.** The rubbed
family's central claim — no recipe at ≥4.5★ scores below 0.70, tested against
eight of them, and it killed two invented penalty bands — has no analogue here.

Consequences, all deliberate:

- separate display domain (`[0.55, 0.90]` vs `[0.62, 0.98]`) so the two maps are
  not read against each other;
- an explicit warning in the UI on every poured score;
- the vertices left at 0.84 / 0.68 / 0.70 rather than tuned upward. The sonker
  sits lowest because it is the deepest layer in the survey, forgoes the
  inversion, and its own source calls the underside steamed "like a dumpling".
  Flattering it to 0.9 would be fitting five terms to three unrated points.

### 11.6 A step at the pre-bake boundary, and an argument with a source

The poured surface has a **~0.10 discontinuity** where the blend crosses 50%
sonker and the assembly flips from self-inverting to poured-over. Pre-baking is a
genuine either/or, so a step there is honest — but its original size, 0.15, was
mostly a **scoring bug**.

The inversion term was given zero weight where the fruit is pre-baked, so that a
sonker would not be marked down for declining a technique it never attempts. That
backfired. In a weighted geometric mean, deleting a term is not neutral: the
term's value at an inverting point is ~0.89, well above the overall score, so
removing it pulls the mean *down*. The sonker was being penalised by the very
device meant to excuse it. The term now asks whether the **chosen** assembly
worked, of both assemblies, and pouring batter onto hot bubbling fruit scores
well on its own terms.

**What remains is a real disagreement.** The model still says a sonker would
score better as a batter cobbler. Two readings, and this corpus cannot separate
them because there are no ratings:

1. The model is right and the tradition is suboptimal.
2. The model is importing a preference the sonker rejects. Its source is
   approving: *"The fruit really steamed it like a dumpling, while the top baked
   to golden, buttery perfection."* A steamed underside is the goal. The `set` and
   `drowned` terms cannot distinguish that from a gummy one — the same conflation
   §7 already found on the rubbed side, where the soggy-underside term was
   weighted down to 0.5 explicitly because "the sonker goes further and wants the
   underside steamed on purpose".

Reading 2 is more likely. Fixing it means splitting "cooked" from "dry
underneath", which needs evidence this corpus does not have. Recorded, not tuned
away — a test bounds the step at 0.12 so it cannot silently grow back.

### 11.7 Sweetness is still not scored

At 80–165 parts sugar this family is 3–5× a biscuit cobbler, and a cloying
penalty would be easy to add. Nothing supports one: §8.3 found 43.5% of "too
sweet" review matches were *"not too sweet"* — praise — and no source in this
family warns about sweetness. The rubbed model already deleted `greaseOut` and
`blandness` for zero attestation; inventing a third would repeat the mistake.

### 11.8 Still out of reach: the rolled sonker

Sonker is bimodal. The poured half is now modelled. The rolled half is
unreachable **in both families**: Rockford's runs 14.5 parts fat per 100 flour
against a rubbed floor of 45, and §6 already established that its rollability
comes from very low fat rather than low water. Neither triangle has a low-fat
direction. Recorded as a gap.


## 12. Closing the loop: plotted recipes and contributed outcomes

### 12.1 Projection, and why the residual is half the answer

`scripts/build-anchors.mjs` projects every corpus recipe onto both triangles by
constrained least squares and writes `data/anchors.json`. 47 placed, 12 skipped
for want of a usable fat or sugar figure.

The triangle is a 2-D slice of a larger space, so a projection discards
something. The residual measures how much, in units of "fraction of the range the
whole space spans on each field". Recipes past the threshold are kept in the file
and **marked unplottable rather than dropped**, because "these recipes do not fit
either triangle" is a finding about the model.

**Two bugs were found by distrusting the first output.**

*Per-family scaling.* Fields were first weighted by their spread within each
family. But the two families' residuals were then **compared**, to decide which
triangle a recipe belongs to — and per-family scaling put them in different
units. One cobbler came out rubbed 0.361 vs poured 0.359, a coin flip between
numbers that were never on the same scale. A second symptom: egg has zero spread
across the rubbed vertices, so a cobbler containing egg hit an arbitrary floor and
scored a residual of **8.51**. The direction was right; the magnitude was an
artefact. Scales are now taken over every family's vertices.

*RMS hides a single decisive field.* Averaging over six fields let the rolled
sonker look on-plane: 14.5 parts fat against a rubbed floor of 45 — the single
property that makes it rollable and the documented reason it is out of reach —
was diluted by five fields that fitted. The worst single-field deviation is now
reported and tested alongside the RMS, with its sign.

A third defect was in the *data*, not the projection: `self-rising` flour is
recorded as flour and nothing else, so those rows carry zero leavening while the
poured vertices unpack it. The detector first matched on the flags column (which
never mentions the flour) and then on `/self[- ]r[ai]ising/`, which matches the
British "self-**raising**" but not the American "self-**rising**" — missing both
recipes the batter vertex is built from. ATK now lands at residual **0.01** on
the vertex it defines.

### 12.2 What the plotted corpus shows

**The surveyed recipes avoid the middle of the triangle.** They cluster at the
crisp corner and along the crumble↔cobbler edge; the interior, where the modelled
surface dips, is nearly empty. The corpus played no part in shaping that dip — the
score model is built from mechanisms — so this is independent corroboration of
the surface's shape.

Five recipes fit neither triangle, and each names its own reason. Two of them
recover findings already documented from other directions: Rockford's rolled
sonker (butter 0.50 *below*, §11.8) and Dorie Greenspan's cobbler (buttermilk
0.69 *above* — the batter cluster of §11.1).

### 12.3 Contributed bake records

`data/bakes/`, one JSON file per bake, schema in `src/model/bake-record.js`.

A record pairs the prediction with the outcome and is designed to be able to
embarrass the model. It freezes the **resolved quantities**, not just the
barycentric coordinates, because coordinates identify a recipe only relative to
vertices that have already been revised once. It carries a **fingerprint of the
vertices** — computed, not hand-versioned, so it cannot go stale when somebody
edits a vertex and forgets to bump a number. Poured records carry
`calibrated: false` on their face.

Observations are structured and keyed to score components, so a report of a
specific failure can be checked against the specific term that claimed it. A test
asserts every observation names a component that actually exists.
`scripts/bakes-report.mjs` reports, per component, the predicted value when that
component was reported succeeding versus failing. **If the "bad" mean is not
clearly below the "good" mean, the term is not measuring what it claims to.**

`outcome.followedRecipe` / `deviations` is the honesty field. A deviated bake is
still useful; an *undeclared* one is worse than no data because it looks clean.
Validation rejects a record that says the recipe was not followed without saying
what changed, and the report excludes deviated bakes from the fit.

Nothing is transmitted by the page. Contributing opens GitHub's own editor with
the record prefilled; the contributor commits it themselves. No name or email is
collected anywhere in the flow.


## 13. What the model discards — a coverage audit

`node scripts/audit-coverage.mjs`

The question this answers: how much is a surveyed recipe modified to make it fit?
59 records, 312 topping lines.

| | records | share |
|---|---|---|
| pass through with nothing collapsed or dropped | 13 | **22%** |
| at least one ingredient FLATTENED onto a field meaning something else | 41 | 69% |
| at least one ingredient DROPPED entirely | 15 | 25% |

**Dropped** (no field exists; the mass is gone): nuts ×10 — which in Delia's
crumble run to **63% of flour weight** — plus ground/sliced almonds ×5, almond
flour ×1 and cornmeal ×2. The almond forms matter more than the count suggests:
they behave as a fat-rich flour, so dropping them understates both fat and dry
structure at once.

**Collapsed**: sugar type ×30 (brown and demerara both forced to the fixed 60/40
blend), liquid type ×14, self-raising flour ×4, shortening ×2.

### 13.1 Where a collapse becomes a real error

The liquid collapse corrupts the soda constraint in **two records, in opposite
directions**:

- `cobbler-dorie` — the model **over-credits**. A cup of heavy cream is counted
  as buttermilk alongside the half-cup that really is buttermilk, inflating the
  acid ceiling roughly threefold.
- `cobbler-ka-individual-berry` — the model **under-credits**. Its acid is
  *Bakewell Cream*, a dry leavening acid the model has no field for, so the
  constraint would cut a correctly-dosed soda by about two thirds.

An earlier version of this check simply asked "soda plus a non-acid liquid?" and
reported both as acid-free. Reading the two records showed neither is. The error
is the accounting, not the chemistry.

### 13.2 The category the corpus cannot see

**Zero of 59 records contain a single spice, vanilla or zest line.** That is not
a fact about the recipes — 18 of them are apple crisps, and cinnamon-free apple
crisp barely exists in American recipe writing. It is a capture failure in the
original survey.

It is also the more dangerous kind. A dropped ingredient leaves a visible gap
that this audit can count. An uncaptured one leaves nothing downstream able to
notice it is missing, and every median, vertex and residual computed from these
records inherits the blind spot silently.

**11 of 59 records have no fruit line captured at all**, which is the same
failure in a place that feeds the filling calculation.

Neither is fixed here. Both are recorded so that no figure derived from this
corpus is read as more complete than it is.
