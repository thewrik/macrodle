import { countryAliases } from "./vendor/country-guess-kit/core.mjs";
import { $, bindGuessForm } from "./vendor/country-guess-kit/dom.mjs";
import { copyToClipboard, fireConfetti, showFloatingEmoji } from "./vendor/country-guess-kit/effects.mjs";
import { DATA } from "./data.js";
import { createMacrodleGame, MAX_GUESSES, pickCountriesForTier } from "./app.js";

const game = createMacrodleGame(DATA);
const cols = game.cols;

function populateCountryList() {
  const values = [...new Set(DATA.flatMap(countryAliases))].sort((a, b) => a.localeCompare(b));
  $("countryList").innerHTML = values.map(v => `<option value="${v.replaceAll('"', '&quot;')}"></option>`).join("");
}

populateCountryList();

function currentMode() {
  return $("modeSelect")?.value || "all";
}

function candidatesForMode() {
  const candidates = pickCountriesForTier(DATA, currentMode());
  return candidates.length ? candidates : DATA;
}

function restart(random = true) {
  game.start({ random, candidates: candidatesForMode() });
  $("board").innerHTML = "";
  $("answerCard").hidden = true;
  $("message").innerHTML = currentMode() === "surprise" ? "Surprise mode: expect macro outliers — high inflation, pegs, frontier markets, or unusual balances." : "Six guesses. Use the direction and distance to shrink the search space.";
  $("geoHint").textContent = "Make a guess to reveal distance and direction, just like a country guessing game.";
  $("macroHint").textContent = "Each row shows whether the hidden economy is higher, lower, closer, or farther on the macro variables.";
  $("guessInput").disabled = false;
  $("guessBtn").disabled = false;
  $("guessInput").value = "";
  setAttemptsLabel();
  renderMysteryRow();
}

const headerRow = $("headerRow");
const nameHeader = document.createElement("div");
nameHeader.className = "cell";
nameHeader.style.background = "transparent";
headerRow.appendChild(nameHeader);
cols.forEach(c => {
  const d = document.createElement("div");
  d.className = "cell";
  d.style.background = "transparent";
  d.style.color = "inherit";
  d.textContent = c.label;
  headerRow.appendChild(d);
});

function renderMysteryRow() {
  const mysteryRow = $("mysteryRow");
  const visible = cols.filter(col => col.kind !== "geo").slice(0, 8);
  mysteryRow.innerHTML = visible.map(col => {
    const raw = game.target[col.key];
    const value = col.kind === "numeric" ? col.fmt(raw) + (col.unit || "") : raw;
    return `<div class="mystery-tile"><span>${col.label}</span><strong>${value}</strong></div>`;
  }).join("");
}

function renderRow(country, row) {
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  const nameCell = document.createElement("div");
  nameCell.className = "namecell";
  nameCell.textContent = country.name;
  rowEl.appendChild(nameCell);

  row.forEach(({ col, result }) => {
    const cell = document.createElement("div");
    cell.className = "cell " + result.cls;
    const label = document.createElement("div");
    label.className = "cell-label";
    label.textContent = col.label;
    cell.appendChild(label);
    const mainLine = document.createElement("div");
    if (col.kind === "geo") {
      mainLine.appendChild(document.createTextNode(result.value + " "));
      const arrow = document.createElement("span");
      arrow.className = "geo-arrow";
      arrow.style.transform = "rotate(" + result.bearing + "deg)";
      arrow.textContent = "▲";
      mainLine.appendChild(arrow);
    } else {
      mainLine.textContent = result.value + (result.arrow ? " " + result.arrow : "");
    }
    cell.appendChild(mainLine);
    if (result.delta) {
      const deltaLine = document.createElement("div");
      deltaLine.className = "delta";
      deltaLine.textContent = result.delta;
      cell.appendChild(deltaLine);
    }
    const proxLine = document.createElement("div");
    proxLine.className = "prox";
    proxLine.textContent = result.proximity + "% close";
    cell.appendChild(proxLine);
    rowEl.appendChild(cell);
  });

  $("board").appendChild(rowEl);
}

function setAttemptsLabel() {
  $("attemptsLabel").textContent =
    "Attempt " + (game.guesses.length + 1) + " of " + MAX_GUESSES + " — daily country resets at midnight";
}

function revealBlurb(a) {
  return '<div class="reveal">' +
    a.blurb +
    '<br/><br/>' +
    game.lesson() +
    '<br/><br/>' +
    "Region: " + a.region + " · Status: " + a.status + " · FX: " + a.fx + "<br/>" +
    "GDP " + a.gdp + "% · Inflation " + a.inf + "% · Policy rate " + a.rate + "% · CA " + a.ca + "% GDP · Debt " + a.debt + "% GDP" +
    "</div>";
}

function addShareButton() {
  const btn = document.createElement("button");
  btn.className = "share-btn";
  btn.textContent = "Copy share grid";
  btn.onclick = async function () {
    try {
      await copyToClipboard(game.shareText());
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy share grid"), 1500);
    } catch {
      btn.textContent = "Copy failed";
    }
  };
  const msg = $("message");
  msg.appendChild(document.createElement("br"));
  msg.appendChild(btn);
}

function submit() {
  const input = $("guessInput");
  const val = input.value.trim();
  if (!val) return;
  const res = game.guess(val);
  const msg = $("message");

  if (!res.ok) {
    if (res.reason === "not_found") msg.innerHTML = '<span style="color:#c0392b">Not in the country list — pick from the dropdown.</span>';
    else if (res.reason === "duplicate") msg.innerHTML = '<span style="color:#c0392b">Already guessed that one.</span>';
    else msg.innerHTML = '<span style="color:#c0392b">This round is over.</span>';
    return;
  }

  renderRow(res.guess, res.evaluation.row);
  const geo = res.evaluation.row.find(x => x.col.kind === "geo")?.result;
  if (geo) $("geoHint").innerHTML = `From ${res.guess.name}, target is about <b>${geo.value}</b> away. Follow the arrow in the guess row; ${geo.proximity}% geographic proximity.`;
  const macroDeltas = res.evaluation.row
    .filter(x => x.col.kind === "numeric" || x.col.kind === "ordinal")
    .sort((a, b) => Math.abs((b.result.proximity ?? 0) - 100) - Math.abs((a.result.proximity ?? 0) - 100))
    .slice(0, 4)
    .map(x => `<span><b>${x.col.label}</b>: ${x.result.arrow || "≈"} ${x.result.delta || "exact"}</span>`)
    .join("<br>");
  $("macroHint").innerHTML = `Compared with ${res.guess.name}:<br>${macroDeltas}`;
  input.value = "";

  if (res.win) {
    const a = res.answer;
    msg.innerHTML = `✅ Correct: <b>${a.name}</b>.`;
    $("answerCard").hidden = false;
    $("answerTitle").textContent = `${a.name}: macro lesson unlocked`;
    $("answerContext").innerHTML = a.blurb + "<br><br>" + game.lesson();
    fireConfetti({ className: "confetti-canvas" });
    addShareButton();
  } else if (res.lose) {
    const a = res.answer;
    msg.innerHTML = `❌ Out of tries. It was <b>${a.name}</b>.`;
    $("answerCard").hidden = false;
    $("answerTitle").textContent = `${a.name}: macro lesson unlocked`;
    $("answerContext").innerHTML = a.blurb + "<br><br>" + game.lesson();
    showFloatingEmoji("😢", { className: "sad-emoji" });
    addShareButton();
  } else {
    msg.textContent = `${res.guessesLeft} guesses left. Use both the arrows and the closeness percentages.`;
    setAttemptsLabel();
  }
}

bindGuessForm({ input: $("guessInput"), button: $("guessBtn"), onSubmit: submit });
$("newBtn").addEventListener("click", () => restart(true));
$("modeSelect").addEventListener("change", () => restart(true));

setAttemptsLabel();
renderMysteryRow();
