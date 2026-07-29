# Bake records

One JSON file per bake. Each pairs the model's **prediction** at the time with
what **actually came out of the oven**.

## Why this directory exists

Three of the model's stated weaknesses are the same weakness:

- the crumble corner has **no recipe rated 4.5★ or better** anywhere in the corpus;
- **not one poured or sonker source carries a rating at all**, which is why that
  whole family is uncalibrated and gets its own colour scale;
- filling set is a two-sided target the model scores **neither** side of
  (SOURCES §9.4), because nothing in the survey measured it.

None of those is fixable by surveying more recipes. A published recipe reports
what its author did, not how it turned out for somebody else. Only baking a point
and saying what happened closes the gap.

## Contributing one

Use the **"Made it? Rate this point"** panel in the app. It builds the record,
validates it, and offers three destinations — save locally, download the file, or
open a prefilled pull request. Nothing is transmitted by the page itself, and no
name or email is collected anywhere.

Or write the JSON by hand against `src/model/bake-record.js`, which is the schema
of record.

## One file per bake, deliberately

Two contributors never touch the same file, so pull requests cannot conflict.
Filenames are `<date>-<family>-<name>-<hash>.json`.

## Reading them back

```bash
node scripts/bakes-report.mjs
```

Reports predicted-vs-actual, which components the observations agree with, and
which of them the model got wrong.

## What a record must be honest about

`outcome.followedRecipe` and `outcome.deviations`. A bake that changed the recipe
is still useful data; an **undeclared** deviated bake is worse than no data,
because it looks clean. Validation rejects a record that says the recipe was not
followed without saying what changed.
