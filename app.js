import { countryAliases, createGuessGame } from "./vendor/country-guess-kit/core.mjs";
import { bearingDeg, haversineKm } from "./vendor/country-guess-kit/geo.mjs";
import { resultGridShare } from "./vendor/country-guess-kit/share.mjs";

export const MAX_GUESSES = 6;

const ORDINAL_SCALES = {
  status: ["Frontier", "EM", "DM"],
  fx: ["Pegged", "Managed Float", "Free Float"]
};

export const COLS = [
  { key: "region", label: "Region", kind: "nominal" },
  { key: "geo", label: "Distance & Direction", kind: "geo" },
  { key: "status", label: "Dev Status", kind: "ordinal", scale: ORDINAL_SCALES.status },
  { key: "fx", label: "FX Regime", kind: "ordinal", scale: ORDINAL_SCALES.fx },
  { key: "gdp", label: "GDP Growth", unit: "%", kind: "numeric", tight: 0.3, wide: 1.5, fmt: v => v.toFixed(1) },
  { key: "inf", label: "Inflation", unit: "%", kind: "numeric", tight: 0.5, wide: 3, fmt: v => v.toFixed(1) },
  { key: "rate", label: "Policy Rate", unit: "%", kind: "numeric", tight: 0.25, wide: 2, fmt: v => v.toFixed(2) },
  { key: "ca", label: "Current Acct", unit: "% GDP", kind: "numeric", tight: 0.5, wide: 2.5, fmt: v => v.toFixed(1) },
  { key: "debt", label: "Debt/GDP", unit: "%", kind: "numeric", tight: 5, wide: 20, fmt: v => v.toFixed(0) }
];

export function computeRanges(data) {
  const keys = ["gdp", "inf", "rate", "ca", "debt"];
  const ranges = {};
  keys.forEach(k => {
    const vals = data.map(d => d[k]);
    ranges[k] = Math.max(...vals) - Math.min(...vals);
  });
  return ranges;
}

const MAJOR_ECONOMIES = new Set(["United States", "China", "India", "Japan", "Germany", "United Kingdom", "Brazil", "Canada", "Australia", "South Korea", "Mexico", "Indonesia", "Saudi Arabia"]);

export function tierForCountry(country) {
  if (MAJOR_ECONOMIES.has(country.name) || country.status === "DM") return "easy";
  if (country.status === "Frontier" || country.inf >= 12 || country.rate >= 15 || country.fx === "Pegged" || Math.abs(country.ca) >= 5 || country.debt >= 100) return "surprise";
  return "all";
}

export function pickCountriesForTier(countries, tier) {
  if (tier === "easy") return countries.filter(c => tierForCountry(c) === "easy");
  if (tier === "surprise") return countries.filter(c => tierForCountry(c) === "surprise");
  return countries;
}

function evalGeo(col, guessCountry, answerCountry) {
  const km = haversineKm(guessCountry, answerCountry);
  const bearing = bearingDeg(guessCountry, answerCountry);
  const cls = km <= 1500 ? "green" : km <= 5000 ? "yellow" : "gray";
  const proximity = Math.max(0, Math.round(100 * (1 - km / 20000)));
  return {
    cls,
    value: Math.round(km).toLocaleString() + " km",
    arrow: "",
    bearing,
    delta: "",
    proximity
  };
}

function evalNominal(col, guessVal, answerVal) {
  const match = guessVal === answerVal;
  return { cls: match ? "green" : "gray", value: guessVal, arrow: "", delta: "", proximity: match ? 100 : 0 };
}

function evalOrdinal(col, guessVal, answerVal) {
  const gi = col.scale.indexOf(guessVal);
  const ai = col.scale.indexOf(answerVal);
  const dist = Math.abs(gi - ai);
  const maxDist = col.scale.length - 1;
  const proximity = Math.round(100 * (1 - dist / maxDist));
  let arrow = "";
  if (gi < ai) arrow = "▲";
  else if (gi > ai) arrow = "▼";
  const cls = dist === 0 ? "green" : dist === 1 ? "yellow" : "gray";
  return { cls, value: guessVal, arrow, delta: dist === 0 ? "" : (dist + " step" + (dist > 1 ? "s" : "")), proximity };
}

function evalNumeric(col, guessVal, answerVal, ranges) {
  const diff = answerVal - guessVal;
  const absDiff = Math.abs(diff);
  const range = ranges[col.key] || 1;
  const proximity = Math.max(0, Math.round(100 * (1 - absDiff / range)));
  const cls = absDiff <= col.tight ? "green" : absDiff <= col.wide ? "yellow" : "gray";
  let arrow = "";
  if (diff > 0) arrow = "▲";
  else if (diff < 0) arrow = "▼";
  const deltaText = diff === 0 ? "exact" : (diff > 0 ? "+" : "") + col.fmt(diff) + (col.unit || "");
  return { cls, value: col.fmt(guessVal) + (col.unit || ""), arrow, delta: deltaText, proximity };
}

export function evalCell(col, guessCountry, answerCountry, ranges) {
  if (col.kind === "geo") return evalGeo(col, guessCountry, answerCountry);
  const guessVal = guessCountry[col.key];
  const answerVal = answerCountry[col.key];
  if (col.kind === "nominal") return evalNominal(col, guessVal, answerVal);
  if (col.kind === "ordinal") return evalOrdinal(col, guessVal, answerVal);
  return evalNumeric(col, guessVal, answerVal, ranges);
}

function macroLesson(answer) {
  const realRate = answer.rate - answer.inf;
  const caText = answer.ca >= 0 ? "a current-account surplus" : "a current-account deficit";
  const debtText = answer.debt >= 100 ? "a heavy public-debt load" : answer.debt <= 40 ? "a comparatively light public-debt load" : "a moderate public-debt load";
  const realRateText = realRate >= 3 ? "very tight real rates" : realRate <= -2 ? "negative real rates" : "a roughly balanced real-rate stance";
  return `Macro lesson: ${answer.name} combines ${answer.status} market status, ${answer.fx.toLowerCase()} FX, ${caText}, and ${debtText}. Growth is ${answer.gdp.toFixed(1)}%, inflation is ${answer.inf.toFixed(1)}%, and the policy rate is ${answer.rate.toFixed(2)}%, implying ${realRateText}.`;
}

export function createMacrodleGame(data) {
  const ranges = computeRanges(data);
  const engine = createGuessGame({
    items: data,
    maxGuesses: MAX_GUESSES,
    getId: c => c.name,
    aliases: c => countryAliases(c),
    evaluateGuess: ({ guess, target }) => ({
      row: COLS.map(col => ({ col, result: evalCell(col, guess, target, ranges) }))
    })
  });

  return {
    ...engine,
    cols: COLS,
    lesson: () => macroLesson(engine.target),
    shareText() {
      const rows = engine.guesses.map(g => COLS.map(col => evalCell(col, g, engine.target, ranges)));
      return resultGridShare({ title: "MACRODLE", guessesUsed: engine.guesses.length, maxGuesses: MAX_GUESSES, rows, teaser: "Macro fingerprint: arrows show direction, colors show distance." });
    }
  };
}
