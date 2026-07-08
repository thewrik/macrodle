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

  function renderMysteryRow() {
    const mysteryRow = document.getElementById("mysteryRow");
    mysteryRow.innerHTML = "";
    const nameCell = document.createElement("div");
    nameCell.className = "namecell";
    nameCell.textContent = "???";
    mysteryRow.appendChild(nameCell);

    cols.forEach(col => {
      const cell = document.createElement("div");
      cell.className = "cell mystery";
      const label = document.createElement("div");
      label.className = "cell-label";
      label.textContent = col.label;
      cell.appendChild(label);
      const val = document.createElement("div");
      if (col.kind === "geo") {
        val.textContent = "?";
      } else {
        const raw = game.answer[col.key];
        val.textContent = col.kind === "numeric" ? col.fmt(raw) + (col.unit || "") : raw;
      }
      cell.appendChild(val);
      mysteryRow.appendChild(cell);
    });
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

    document.getElementById("board").appendChild(rowEl);
  }

  function setAttemptsLabel() {
    document.getElementById("attemptsLabel").textContent =
      "Attempt " + (game.guesses.length + 1) + " of 6 — daily country resets at midnight";
  }

  function revealBlurb(a) {
    return '<div class="reveal">' +
      a.blurb +
      '<br/><br/>' +
      "Region: " + a.region + " · Status: " + a.status + " · FX: " + a.fx + "<br/>" +
      "GDP " + a.gdp + "% · Inflation " + a.inf + "% · Policy rate " + a.rate + "% · CA " + a.ca + "% GDP · Debt " + a.debt + "% GDP" +
      "</div>";
  }

  function fireConfetti() {
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const colors = ["#3aa15e", "#c9a227", "#3b82f6", "#e75480", "#8a8f98", "#f97316"];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * 360,
      vr: -8 + Math.random() * 16
    }));

    const duration = 2600;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (elapsed < duration) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  function showSadEmoji() {
    const el = document.createElement("div");
    el.className = "sad-emoji";
    el.textContent = "😢";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
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
      const a = res.answer;
      msg.innerHTML = "✅ Nailed it in " + res.guessesUsed + "/6 — it was <b>" + a.name + "</b>." + revealBlurb(a);
      fireConfetti();
      addShareButton();
    } else if (res.lose) {
      const a = res.answer;
      msg.innerHTML = "❌ Out of tries. It was <b>" + a.name + "</b>." + revealBlurb(a);
      showSadEmoji();
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
    renderMysteryRow();
  });

  setAttemptsLabel();
  renderMysteryRow();
})();
