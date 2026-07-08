// MACRODLE — comparator + game loop
// Distance/direction hint model, same spirit as Worldle (haversine distance + bearing)
// but applied to macro metrics instead of lat/long: each column reports
//   - a distance (how far the guess is from the answer, normalized to 0-100% "closeness")
//   - a direction (guess needs to go up or down / across categories to reach the answer)
//   - a raw delta (the actual difference, signed)

const MAX_GUESSES = 6;

const ORDINAL_SCALES = {
  status: ["Frontier", "EM", "DM"],
  fx: ["Pegged", "Managed Float", "Free Float"]
};

// Compute numeric ranges dynamically from the dataset so proximity% adapts if you edit data.js
function computeRanges(data) {
  const keys = ["gdp", "inf", "rate", "ca", "debt"];
  const ranges = {};
  keys.forEach(k => {
    const vals = data.map(d => d[k]);
    ranges[k] = Math.max(...vals) - Math.min(...vals);
  });
  return ranges;
}

const EARTH_RADIUS_KM = 6371;
const toRad = deg => deg * Math.PI / 180;

// Haversine great-circle distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Initial compass bearing in degrees (0-360, 0 = north) from point 1 to point 2
function bearingDeg(lat1, lng1, lat2, lng2) {
  const phi1 = toRad(lat1), phi2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function evalGeo(col, guessCountry, answerCountry) {
  const km = haversineKm(guessCountry.lat, guessCountry.lng, answerCountry.lat, answerCountry.lng);
  const bearing = bearingDeg(guessCountry.lat, guessCountry.lng, answerCountry.lat, answerCountry.lng);
  const cls = km <= 1500 ? "green" : km <= 5000 ? "yellow" : "gray";
  const proximity = Math.max(0, Math.round(100 * (1 - km / 20000)));
  return {
    cls,
    value: Math.round(km).toLocaleString() + " km",
    arrow: "", // rendered as a rotated arrow by the UI using `bearing`
    bearing,
    delta: "",
    proximity
  };
}

const COLS = [
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
  const diff = answerVal - guessVal; // signed: positive means answer is higher
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

function evalCell(col, guessCountry, answerCountry, ranges) {
  if (col.kind === "geo") return evalGeo(col, guessCountry, answerCountry);
  const guessVal = guessCountry[col.key];
  const answerVal = answerCountry[col.key];
  if (col.kind === "nominal") return evalNominal(col, guessVal, answerVal);
  if (col.kind === "ordinal") return evalOrdinal(col, guessVal, answerVal);
  return evalNumeric(col, guessVal, answerVal, ranges);
}

function dailySeedIndex(data) {
  const d = new Date();
  const key = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return key % data.length;
}

function createGame(data) {
  const ranges = computeRanges(data);
  let answer, guesses, over;

  function start(daily) {
    answer = daily ? data[dailySeedIndex(data)] : data[Math.floor(Math.random() * data.length)];
    guesses = [];
    over = false;
  }

  function guess(name) {
    if (over) return { ok: false, reason: "over" };
    const match = data.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!match) return { ok: false, reason: "not_found" };
    if (guesses.find(g => g.name === match.name)) return { ok: false, reason: "duplicate" };

    const row = COLS.map(col => ({ col, result: evalCell(col, match, answer, ranges) }));
    guesses.push(match);

    const win = match.name === answer.name;
    const lose = !win && guesses.length >= MAX_GUESSES;
    if (win || lose) over = true;

    return { ok: true, row, win, lose, guessesUsed: guesses.length, answer: over ? answer : null };
  }

  function shareText() {
    let out = `MACRODLE ${guesses.length}/${MAX_GUESSES}\n`;
    guesses.forEach(g => {
      let line = "";
      COLS.forEach(col => {
        const r = evalCell(col, g, answer, ranges);
        line += r.cls === "green" ? "🟩" : r.cls === "yellow" ? "🟨" : "⬛";
      });
      out += line + "\n";
    });
    return out;
  }

  start(true);
  return { start, guess, shareText, cols: COLS, get answer() { return answer; }, get guesses() { return guesses; }, get over() { return over; } };
}

if (typeof module !== "undefined") module.exports = { createGame, COLS, computeRanges };
