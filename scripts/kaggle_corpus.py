#!/usr/bin/env python3
"""
Build a large-sample corpus from the Food.com recipes-and-reviews dataset.

WHY THIS IS WORTH DOING
-----------------------
The hand survey behind this project rests on 16-20 sources per dish, gathered
through a summarising layer that was caught fabricating at least one data point.
Its medians may well be right, but they are fragile and they are not falsifiable
at that sample size.

This dataset offers roughly half a million recipes and well over a million
reviews. It cannot replace the hand survey — Food.com is user-submitted, so it
has no authority and plenty of junk — but it can do two things the hand survey
cannot:

  1. **Test whether the medians hold at n in the thousands.** If the crumble
     butter median really is 66.7 per 100 flour, it should survive a large,
     independent, differently-biased sample.
  2. **Answer the review questions empirically.** "Do reviewers add sugar or cut
     it?" is a question about thousands of comments, not about the six star
     ratings the hand survey managed to capture.

WHAT IT CANNOT DO
-----------------
Food.com is not a source of authority. A median over user submissions measures
what home cooks post, not what works. Where the two corpora disagree, that is a
finding to report, not a reason to overwrite the curated figures.

Usage:
    python3 scripts/kaggle_corpus.py            # download + analyse
    python3 scripts/kaggle_corpus.py --local D  # use an already-downloaded dir
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)

DATASET = "irkaal/foodcom-recipes-and-reviews"

# --- Dish classification -----------------------------------------------------
# Ordered: the first match wins, so "apple crisp" beats a stray "crumble" in the
# body text. Word boundaries throughout — "crisp" appears constantly as an
# adjective ("crisp apples") and must only match as a dish noun.

DISH_PATTERNS = [
    ("cobbler",   r"\bcobbler(s)?\b"),
    ("crisp",     r"\bcrisp(s)?\b(?!\w)"),
    ("crumble",   r"\bcrumble(s)?\b"),
    ("buckle",    r"\bbuckle(s)?\b"),
    ("betty",     r"\b(brown\s+betty|betty)\b"),
    ("grunt",     r"\bgrunt(s)?\b"),
    ("slump",     r"\bslump(s)?\b"),
    ("pandowdy",  r"\bpandowd(y|ies)\b"),
    ("sonker",    r"\bsonker(s)?\b"),
    ("clafoutis", r"\bclafouti(s)?\b"),
    ("baked oatmeal", r"\bbaked\s+oatmeal\b"),
]

# The dish word must be used as a NOUN, not an adjective. "Crisp" is the problem
# case — it appears constantly as a descriptor ("crisp roasted potatoes", "serve
# with crisp apples"), and an early version of this classifier counted both as
# recipes for a fruit crisp. Recipe titles name the dish as a trailing noun, so
# require the word to end the title or be followed by a separator or connective.
# A dash with no space before it is COMPOUNDING, not separating: "Cobbler-Style
# Chicken" is not a cobbler. Require whitespace before a dash; commas and parens
# may hug the word.
TRAILING = r"(?:\s*$|\s*[,(/]|\s+[-–—]|\s+(?:with|for|recipe|topping|filling|ii?i?|\#|\d))"

# Savoury guard. In a corpus of half a million user-submitted recipes, dish words
# turn up in contexts a title pattern alone will not catch.
SAVOURY = re.compile(
    r"\b(chicken|beef|pork|lamb|turkey|sausage|bacon|ham|fish|shrimp|tuna|"
    r"chili|casserole|pot ?pie|gravy|onion|potato|broccoli|cheese|taco|pizza)\b"
)


def classify(name: str):
    if not isinstance(name, str):
        return None
    low = name.lower().strip()
    if SAVOURY.search(low):
        return None
    for dish, pat in DISH_PATTERNS:
        if re.search(pat + TRAILING, low):
            return dish
    return None


# --- Ingredient parsing ------------------------------------------------------
# Deliberately mirrors src/data/units.js. Kept in sync by test/extract.test.js
# comparing a shared fixture; if you change one, change both.

FACTORS = {
    "flour": {"cup": 125.0},
    "oats": {"cup": 90.0},
    "sugar": {"cup": 200.0, "tbsp": 12.5, "tsp": 4.17},
    "brown sugar": {"cup": 213.0, "tbsp": 13.3125},
    "butter": {"cup": 227.2, "tbsp": 14.2, "stick": 113.6},
    "buttermilk": {"cup": 240.0},
    "milk": {"cup": 240.0},
    "baking powder": {"tsp": 4.0, "tbsp": 12.0},
    "baking soda": {"tsp": 4.6, "tbsp": 13.8},
    "salt": {"tsp": 5.7, "tbsp": 17.1},
    "nuts": {"cup": 100.0},
}

INGREDIENT_ALIASES = [
    ("brown sugar", r"brown sugar|demerara|muscovado"),
    ("flour", r"\bflour\b"),
    ("oats", r"\boat(s|meal)?\b"),
    ("butter", r"\bbutter\b(?!milk)"),
    ("buttermilk", r"\bbuttermilk\b"),
    ("milk", r"\bmilk\b|\bcream\b"),
    ("baking powder", r"baking powder"),
    ("baking soda", r"baking soda|bicarbonate"),
    ("salt", r"\bsalt\b"),
    ("nuts", r"\b(pecan|walnut|almond|nut)s?\b"),
    ("sugar", r"\bsugar\b"),
]

UNICODE_FRACTIONS = {
    "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1/3, "⅔": 2/3,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}

UNIT_WORDS = {
    "cup": "cup", "cups": "cup", "c": "cup",
    "tablespoon": "tbsp", "tablespoons": "tbsp", "tbsp": "tbsp",
    "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp",
    "stick": "stick", "sticks": "stick",
    "ounce": "oz", "ounces": "oz", "oz": "oz",
    "pound": "lb", "pounds": "lb", "lb": "lb",
    "gram": "g", "grams": "g", "g": "g",
}


def parse_qty(text: str):
    """Mixed numbers, unicode and ascii fractions, and ranges (midpoint)."""
    s = str(text).strip()
    rng = re.match(r"^(.+?)\s*(?:to|-|–)\s*(.+)$", s)
    if rng and not re.match(r"^\d+/\d+$", s):
        a, b = parse_qty(rng.group(1)), parse_qty(rng.group(2))
        if a is not None and b is not None:
            return (a + b) / 2
    # Bare decimal first: "0.5" would otherwise match the whole-number branch
    # as "0" and return zero.
    m = re.fullmatch(r"\d*\.\d+", s)
    if m:
        return float(s)
    total, matched = 0.0, False
    m = re.match(r"^(\d+)(?![\d/.])", s)
    if m:
        total += float(m.group(1)); matched = True
    for glyph, val in UNICODE_FRACTIONS.items():
        if glyph in s:
            total += val; matched = True
    m = re.search(r"(\d+)\s*/\s*(\d+)", s)
    if m:
        total += float(m.group(1)) / float(m.group(2)); matched = True
    if not matched:
        m = re.match(r"^(\d*\.?\d+)$", s)
        if m:
            return float(m.group(1))
        return None
    return total


def identify(text: str):
    low = text.lower()
    for name, pat in INGREDIENT_ALIASES:
        if re.search(pat, low):
            return name
    return None


def line_to_grams(qty_text, ingredient_text):
    """Return (ingredient_key, grams) or (None, None)."""
    key = identify(ingredient_text)
    if key is None:
        return None, None
    q = parse_qty(qty_text)
    if q is None:
        return key, None
    unit = None
    for word, canon in UNIT_WORDS.items():
        if re.search(rf"\b{word}\b", str(qty_text).lower()):
            unit = canon
            break
    if unit == "g":
        return key, q
    if unit == "oz":
        return key, q * 28.3495
    if unit == "lb":
        return key, q * 453.592
    if unit is None:
        return key, None
    factor = FACTORS.get(key, {}).get(unit)
    return key, (q * factor if factor else None)


# --- Review mining -----------------------------------------------------------
# Each bucket is a question the model needs answered, not a general sentiment
# scrape. The sugar buckets are the falsifiable check: this project set crumble
# and crisp sugar BELOW the surveyed median on taste, and if reviewers routinely
# add sugar rather than cut it, that choice is wrong.

# (pattern, negation_pattern). The negation half is not optional decoration.
# An audit of the raw counts found 43.5% of "too sweet" hits were "NOT too
# sweet" — praise, counted as complaint — and 24.7% of "dry" hits were "dry
# ingredients", a procedural phrase. Uncorrected, both buckets were roughly
# double their true size. Keyword counting without negation handling is not
# measurement.
REVIEW_PATTERNS = {
    "too_sweet":        (r"(?:too|overly|way too|much too)\s+sweet|cloying|sickly sweet",
                         r"(?:not|n't|never)\s+(?:too\s+|overly\s+)?sweet"),
    "cut_sugar":        (r"(?:cut|cut back on|reduc\w+|halv\w+|less|decreas\w+|lowered)\s+(?:the\s+)?sugar", None),
    "added_sugar":      (r"(?:add\w*|increas\w+|more|extra|doubl\w+)\s+(?:the\s+)?sugar", None),
    "not_sweet_enough": (r"not sweet enough|needed more sugar|wasn'?t sweet", None),
    "dry_powdery":      (r"\bpowder(?:y|ed)\b|\bfloury\b|too dry|very dry|bit dry|came out dry|was dry|rather dry",
                         r"dry ingredient|dry mix|dry goods"),
    "soggy":            (r"\bsogg(?:y|ier)\b|\bmush(?:y|ier)\b", None),
    "gummy_undercooked":(r"\bgumm(?:y|ier)\b|\bdough(?:y|ier)\b|under[- ]?(?:baked|cooked)|not (?:cooked|baked) through", None),
    "runny_filling":    (r"\brunny\b|\bwatery\b|\bsoupy\b|didn'?t (?:set|thicken)|too much liquid", None),
    "tough_dense":      (r"\btough\b|too dense|very dense|\bleaden\b|like a brick", None),
    "more_topping":     (r"(?:doubl\w+|more|extra)\s+(?:the\s+)?(?:topping|crumble|streusel)", None),
    "longer_bake":      (r"(?:needed|took|baked?(?: it)?)\s+(?:an?\s+)?(?:extra|another|additional|\d+)\s*(?:\d+\s*)?min|longer than (?:the\s+)?(?:stated|recipe)", None),
    "burnt":            (r"\bburn(?:t|ed)\b|\bscorch(?:ed)?\b|too dark on top", None),
}


def mine_reviews(reviews_df, recipe_ids, dish_by_id):
    counts = {}
    examples = {}
    total_by_dish = Counter()
    matched = reviews_df[reviews_df["RecipeId"].isin(recipe_ids)]
    for _, row in matched.iterrows():
        text = row.get("Review")
        if not isinstance(text, str):
            continue
        dish = dish_by_id.get(row["RecipeId"])
        total_by_dish[dish] += 1
        low = text.lower()
        for bucket, (pat, negpat) in REVIEW_PATTERNS.items():
            if re.search(pat, low) and not (negpat and re.search(negpat, low)):
                counts.setdefault(dish, Counter())[bucket] += 1
                ex = examples.setdefault((dish, bucket), [])
                if len(ex) < 3:
                    ex.append(text.strip()[:180])
    return counts, examples, total_by_dish


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="Path to an already-downloaded dataset directory")
    ap.add_argument("--max-reviews", type=int, default=0, help="0 = all")
    args = ap.parse_args()

    import pandas as pd

    if args.local:
        path = Path(args.local)
    else:
        try:
            import kagglehub
        except ImportError:
            sys.exit("kagglehub not installed: python3 -m pip install --user kagglehub")
        print(f"Downloading {DATASET} …", flush=True)
        try:
            path = Path(kagglehub.dataset_download(DATASET))
        except Exception as e:  # noqa: BLE001
            sys.exit(
                f"Download failed: {e}\n\n"
                "This almost always means Kaggle credentials are missing. Run:\n"
                '  python3 -c "import kagglehub; kagglehub.login()"\n'
                "or place kaggle.json at ~/.kaggle/kaggle.json"
            )
    print("Dataset at:", path)

    files = {p.name.lower(): p for p in path.rglob("*") if p.suffix.lower() in (".csv", ".parquet")}
    print("Files:", ", ".join(sorted(files)))

    def load(match):
        for name, p in files.items():
            if match in name:
                print(f"  loading {p.name} …", flush=True)
                return pd.read_parquet(p) if p.suffix == ".parquet" else pd.read_csv(p, low_memory=False)
        return None

    recipes = load("recipe")
    reviews = load("review")
    if recipes is None:
        sys.exit(f"No recipes file found in {path}")

    print(f"\nRecipes: {len(recipes):,}   Reviews: {len(reviews):,}" if reviews is not None
          else f"\nRecipes: {len(recipes):,}   Reviews: none found")

    name_col = "Name" if "Name" in recipes.columns else recipes.columns[1]
    recipes["dish"] = recipes[name_col].map(classify)
    hits = recipes[recipes["dish"].notna()].copy()
    print("\n--- Dish counts (title match) ---")
    print(hits["dish"].value_counts().to_string())

    # Normalise ingredient lines into per-100-dry-structure figures.
    rows = []
    qty_col = next((c for c in ("RecipeIngredientQuantities", "IngredientQuantities") if c in hits.columns), None)
    ing_col = next((c for c in ("RecipeIngredientParts", "IngredientParts") if c in hits.columns), None)

    if qty_col and ing_col:
        def split_rlist(v):
            if not isinstance(v, str):
                return []
            return re.findall(r'"([^"]*)"', v) or [x.strip() for x in v.strip("c()").split(",")]

        for _, r in hits.iterrows():
            qs, ins = split_rlist(r[qty_col]), split_rlist(r[ing_col])
            totals = Counter()
            for q, ing in zip(qs, ins):
                key, g = line_to_grams(f"{q} {ing}", ing)
                if key and g:
                    totals[key] += g
            basis = totals["flour"] + totals["oats"]
            if basis <= 0:
                continue
            rows.append({
                "RecipeId": r.get("RecipeId"),
                "name": r[name_col],
                "dish": r["dish"],
                "rating": r.get("AggregatedRating"),
                "reviewCount": r.get("ReviewCount"),
                "flourG": round(totals["flour"], 1),
                "oatsG": round(totals["oats"], 1),
                "basisG": round(basis, 1),
                "oatFractionPct": round(totals["oats"] / basis * 100, 1),
                "fatPct": round(totals["butter"] / basis * 100, 1) if totals["butter"] else None,
                "sugarPct": round((totals["sugar"] + totals["brown sugar"]) / basis * 100, 1) or None,
                "liquidPct": round((totals["buttermilk"] + totals["milk"]) / basis * 100, 1) or None,
                "saltPct": round(totals["salt"] / basis * 100, 2) or None,
                "bakingPowderPct": round(totals["baking powder"] / basis * 100, 2) or None,
                "bakingSodaPct": round(totals["baking soda"] / basis * 100, 2) or None,
                "nutsPct": round(totals["nuts"] / basis * 100, 1) or None,
            })

    df = pd.DataFrame(rows)
    if len(df):
        df.to_csv(OUT / "foodcom_normalised.csv", index=False)
        print(f"\nWrote {OUT/'foodcom_normalised.csv'}  ({len(df):,} rows with a usable flour/oat basis)")

        print("\n--- Medians per 100 dry structure, vs this project's hand survey ---")
        HAND = {
            "crumble": {"fatPct": 66.7, "sugarPct": 57.0, "oatFractionPct": 0},
            "crisp":   {"fatPct": 70.0, "sugarPct": 75.0, "oatFractionPct": 41},
            "cobbler": {"fatPct": 45.0, "sugarPct": 30.0, "liquidPct": 80},
        }
        for dish in ["crumble", "crisp", "cobbler", "buckle", "betty", "grunt", "slump", "pandowdy"]:
            sub = df[df["dish"] == dish]
            if len(sub) < 5:
                continue
            print(f"\n{dish}  (n={len(sub):,})")
            for field in ["oatFractionPct", "fatPct", "sugarPct", "liquidPct", "saltPct"]:
                vals = sub[field].dropna()
                if not len(vals):
                    continue
                hand = HAND.get(dish, {}).get(field)
                delta = f"   hand survey: {hand}" if hand is not None else ""
                print(f"  {field:18} n={len(vals):5,}  median={vals.median():7.1f}  "
                      f"IQR={vals.quantile(.25):.1f}–{vals.quantile(.75):.1f}{delta}")

    # Reviews
    if reviews is not None and len(df):
        print("\n--- Mining reviews ---", flush=True)
        if args.max_reviews:
            reviews = reviews.head(args.max_reviews)
        dish_by_id = dict(zip(df["RecipeId"], df["dish"]))
        counts, examples, totals = mine_reviews(reviews, set(df["RecipeId"]), dish_by_id)
        out = []
        for dish, c in sorted(counts.items()):
            n = totals[dish]
            print(f"\n{dish}  ({n:,} reviews matched)")
            for bucket, k in c.most_common():
                pct = k / n * 100 if n else 0
                print(f"  {bucket:22} {k:6,}  ({pct:5.2f}%)")
                out.append({"dish": dish, "bucket": bucket, "count": k,
                            "reviewsForDish": n, "pct": round(pct, 3),
                            "examples": " ||| ".join(examples.get((dish, bucket), []))})
        if out:
            pd.DataFrame(out).to_csv(OUT / "foodcom_review_signals.csv", index=False)
            print(f"\nWrote {OUT/'foodcom_review_signals.csv'}")

        print("\n--- The falsifiable check ---")
        for dish in ["crumble", "crisp", "cobbler"]:
            c = counts.get(dish, Counter())
            cut, add = c.get("cut_sugar", 0), c.get("added_sugar", 0)
            sweet, bland = c.get("too_sweet", 0), c.get("not_sweet_enough", 0)
            if cut + add + sweet + bland == 0:
                continue
            verdict = ("supports sitting BELOW the median" if (cut + sweet) > (add + bland)
                       else "undercuts it — reviewers want MORE sugar")
            print(f"  {dish:8} cut={cut} added={add} too-sweet={sweet} not-sweet-enough={bland}  → {verdict}")

    print("\nDone.")


if __name__ == "__main__":
    main()
