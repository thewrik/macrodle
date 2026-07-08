(function () {
  const game = createGame(DATA);
  const cols = game.cols;

  const datalist = document.getElementById("countryList");
  DATA.forEach(c => {
    const o = document.createElement("option");
    o.value = c.name;
    datalist.appendChild(o);
  });

  const headerRow = document.getElementById("headerRow");
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

  function renderRow(country, row) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    const nameCell = document.createElement("div");
    nameCell.className = "namecell";
    nameCell.textContent = country.name;
    rowEl.appendChild(nameCell);

    row.forEach(({ result }) => {
      const cell = document.createElement("div");
      cell.className = "cell " + result.cls;
      const mainLine = document.createElement("div");
      mainLine.textContent = result.value + (result.arrow ? " " + result.arrow : "");
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

    document.getElementById("board").appendChild(rowEl);
  }

  function setAttemptsLabel() {
    document.getElementById("attemptsLabel").textContent =
      "Attempt " + (game.guesses.length + 1) + " of 6 — daily country resets at midnight";
  }

  function addShareButton() {
    const btn = document.createElement("button");
    btn.className = "share-btn";
    btn.textContent = "Copy share grid";
    btn.onclick = function () {
      const text = game.shareText();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy share grid"), 1500);
        }).catch(() => { btn.textContent = "Copy failed"; });
      }
    };
    const msg = document.getElementById("message");
    msg.appendChild(document.createElement("br"));
    msg.appendChild(btn);
  }

  function submit() {
    const input = document.getElementById("guessInput");
    const val = input.value.trim();
    if (!val) return;
    const res = game.guess(val);
    const msg = document.getElementById("message");

    if (!res.ok) {
      if (res.reason === "not_found") msg.innerHTML = '<span style="color:#c0392b">Not in the country list — pick from the dropdown.</span>';
      else if (res.reason === "duplicate") msg.innerHTML = '<span style="color:#c0392b">Already guessed that one.</span>';
      return;
    }

    renderRow(DATA.find(c => c.name.toLowerCase() === val.toLowerCase()), res.row);
    input.value = "";

    if (res.win) {
      msg.innerHTML = "✅ Nailed it in " + res.guessesUsed + "/6 — it was <b>" + res.answer.name + "</b>.";
      addShareButton();
    } else if (res.lose) {
      const a = res.answer;
      msg.innerHTML = "❌ Out of tries. It was <b>" + a.name + "</b>." +
        '<div class="reveal">' +
        "Region: " + a.region + " · Status: " + a.status + " · FX: " + a.fx + "<br/>" +
        "GDP " + a.gdp + "% · Inflation " + a.inf + "% · Policy rate " + a.rate + "% · CA " + a.ca + "% GDP · Debt " + a.debt + "% GDP" +
        "</div>";
      addShareButton();
    } else {
      setAttemptsLabel();
    }
  }

  document.getElementById("guessBtn").addEventListener("click", submit);
  document.getElementById("guessInput").addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  document.getElementById("newBtn").addEventListener("click", () => {
    game.start(false);
    document.getElementById("board").innerHTML = "";
    document.getElementById("message").innerHTML = "";
    document.getElementById("guessInput").value = "";
    setAttemptsLabel();
  });

  setAttemptsLabel();
})();
