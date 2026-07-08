# MACRODLE

A Wordle-style guessing game for macro folks: guess the country from its macro fingerprint instead of a five-letter word.

Each guess returns, per column, the same distance/direction hint model that games like Worldle use for geography — applied here to macro metrics instead of lat/long:

- **Categorical** columns (Region, Dev Status, FX Regime) — match / no match, and for the two ordinal ones (Dev Status: Frontier → EM → DM, FX Regime: Pegged → Managed Float → Free Float) you also get a step-distance and a direction arrow
- **Numeric** columns (GDP growth, inflation, policy rate, current account % GDP, debt/GDP) — a signed delta (e.g. `+2.3%`), a direction arrow (▲ = answer is higher, ▼ = answer is lower), and a proximity % normalized against the spread of that metric across the whole dataset

6 guesses, one country a day (seeded off the date so a group can compare results), plus unlimited practice rounds, and a Wordle-style emoji share grid.

## Structure

```
index.html   — page shell
style.css    — styling
data.js      — the country/metric dataset (edit this to update values or add countries)
app.js       — comparator + game logic (no DOM dependencies, testable with node)
ui.js        — DOM wiring
```

## Run locally

No build step — just open `index.html`, or serve the folder:

```
python3 -m http.server 8080
```

## Data

Values in `data.js` are illustrative macro snapshots for gameplay — not a live feed. Update them as you see fit; `app.js` computes normalization ranges dynamically from whatever is in the dataset, so adding/editing countries doesn't require touching the game logic.

## Deploy

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys the static site to GitHub Pages on every push to `main`. Enable Pages in the repo settings (Source: GitHub Actions) and it'll deploy automatically.
