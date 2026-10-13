"use strict";

/* =========================================================
   Wer bin ich? – Pass & Play (ein Gerät)
   1. Spieler eintragen
   2. Reihum denkt sich jeder eine Person für einen anderen Spieler aus
   3. Reihum hält jeder das Gerät zu den anderen und tippt blind aufs Feld
   4. Spielrunde: Ja/Nein-Fragen, Raten über das Textfeld
   ========================================================= */

// Zufällige Vorschläge aus den Personen-Kategorien
function randomPerson(exclude = []) {
  const pool = ["promis", "geschichte", "streamer"]
    .flatMap((id) => Object.values(CATEGORIES[id].words).flat())
    .map(displayWord);
  const taken = new Set(exclude.map(normalize));
  const free = pool.filter((p) => !taken.has(normalize(p)));
  return pick(free.length ? free : pool);
}

const WBI = (() => {
  const MIN = 2;
  let game = null;

  /* ---------- Setup ---------- */
  function openSetup() {
    currentGame = "werbinich";
    currentMode = "local";
    renderSetup();
    showScreen("wbi-setup", "setup");
  }

  function renderSetup() {
    while (settings.names.length < MIN) settings.names.push("");
    const list = $("wbi-player-list");
    list.innerHTML = "";
    settings.names.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `<span class="num">${i + 1}.</span>`;
      const input = document.createElement("input");
      input.type = "text";
      input.value = name;
      input.placeholder = `Spieler ${i + 1}`;
      input.autocomplete = "off";
      input.autocapitalize = "words";
      input.maxLength = 24;
      input.addEventListener("input", () => {
        settings.names[i] = input.value;
        saveSettings();
      });
      row.appendChild(input);
      list.appendChild(row);
    });
    $("wbi-count").textContent = settings.names.length;
    $("wbi-setup-error").hidden = true;
  }

  function setupError(msg) {
    $("wbi-setup-error").textContent = msg;
    $("wbi-setup-error").hidden = false;
  }

  function start() {
    const names = settings.names.map((n) => n.trim());
    if (names.length < MIN) return setupError(`Ihr braucht mindestens ${MIN} Spieler.`);
    if (names.some((n) => !n)) return setupError("Bitte gib allen Spielern einen Namen.");
    const keys = names.map(normalize);
    if (keys.some((k) => !k)) return setupError("Namen müssen mindestens einen Buchstaben oder eine Zahl enthalten.");
    if (new Set(keys).size !== keys.length) return setupError("Jeder Name darf nur einmal vorkommen.");

    // Zufällige Reihenfolge; jeder denkt sich eine Person für den Nächsten im Kreis aus
    const order = shuffle(names.map((name) => ({ name, term: "", rank: null, shown: false })));
    order.forEach((p, i) => { p.target = order[(i + 1) % order.length]; });

    game = { players: order, step: 0, turn: 0, solvedCount: 0, over: false, busy: false };
    renderAssign();
    showScreen("wbi-assign", "assign");
  }

  /* ---------- Personen ausdenken ---------- */
  function renderAssign() {
    const writer = game.players[game.step];
    $("wbi-assign-progress").textContent = `${game.step + 1} von ${game.players.length}`;
    $("wbi-writer").textContent = writer.name;
    $("wbi-target").textContent = writer.target.name;
    $("wbi-target-warn").textContent = `${writer.target.name} darf jetzt nicht hinschauen!`;
    $("wbi-term").value = "";
  }

  async function submitAssign(e) {
    e.preventDefault();
    const input = $("wbi-term");
    const term = input.value.trim().replace(/\s+/g, " ");
    if (!normalize(term)) {
      input.focus();
      return;
    }
    input.blur();
    game.players[game.step].target.term = term;
    game.step++;

    if (game.step < game.players.length) {
      // Eingabe ist geleert; die Karte wird für den nächsten Spieler neu eingeblendet
      renderAssign();
      showScreen("wbi-assign", "assign");
      return;
    }

    await showPhase({
      num: 3,
      icon: "🔄",
      title: "Personen zeigen",
      text: "Jetzt hält jeder reihum das Gerät mit dem Bildschirm zu den anderen und tippt blind auf das Feld.\nSo sehen alle seine Person – nur er selbst nicht.",
      button: "Los geht's",
      phase: "show"
    });
    game.step = 0;
    game.revealed = false;
    renderShow();
    showScreen("wbi-show", "show");
  }

  /* ---------- Personen zeigen ---------- */
  function renderShow() {
    const p = game.players[game.step];
    $("wbi-show-progress").textContent = `${game.step + 1} von ${game.players.length}`;
    $("wbi-show-name").textContent = p.name;
    $("wbi-show-for").textContent = `${p.name} ist`;
    $("wbi-show-term").textContent = game.revealed ? p.term : "";
    $("wbi-show-front").hidden = game.revealed;
    $("wbi-show-back").hidden = !game.revealed;
    $("wbi-show-card").classList.toggle("crew", game.revealed);
  }

  async function onShowTap() {
    const card = $("wbi-show-card");
    if (game.busy) return;
    game.busy = true;
    card.classList.add("flip-out");
    await wait(220);
    if (!game.revealed) {
      game.revealed = true;
    } else {
      game.revealed = false;
      game.step++;
    }
    if (game.step >= game.players.length) {
      card.classList.remove("flip-out");
      game.busy = false;
      $("wbi-show-term").textContent = "";
      startPlay();
      return;
    }
    renderShow();
    card.classList.remove("flip-out");
    card.classList.add("flip-in");
    await wait(250);
    card.classList.remove("flip-in");
    game.busy = false;
  }

  /* ---------- Spielrunde ---------- */
  async function startPlay() {
    game.turn = 0;
    game.players.forEach((p) => { p.shown = false; });
    renderGame();
    await showPhase({
      num: 4,
      icon: "❓",
      title: "Wer bin ich?",
      text: `Stellt reihum Ja/Nein-Fragen.\nBei „Ja“ darfst du weiterfragen, bei „Nein“ ist der Nächste dran.\n\n${game.players[0].name} beginnt.`,
      button: "Los geht's",
      phase: "game"
    });
    showScreen("wbi-game", "game");
  }

  const unsolved = () => game.players.filter((p) => p.rank === null);

  function nextTurn() {
    const n = game.players.length;
    for (let i = 1; i <= n; i++) {
      const j = (game.turn + i) % n;
      if (game.players[j].rank === null) {
        game.turn = j;
        return;
      }
    }
  }

  function renderGame() {
    const left = unsolved();
    $("wbi-sub").textContent = game.over
      ? "Das Spiel ist vorbei."
      : `${game.players[game.turn].name} ist dran · ${left.length} noch im Spiel`;
    $("screen-wbi-game").classList.toggle("over", game.over);

    const wrap = $("wbi-cards");
    wrap.innerHTML = "";
    game.players.forEach((p, i) => {
      const card = document.createElement("div");
      const current = !game.over && i === game.turn;
      card.className = "wbi-card" + (current ? " current" : "") + (p.rank !== null ? " solved" : "");

      const badge = p.rank !== null ? `<span class="badge win">🏆 Platz ${p.rank}</span>` : current ? `<span class="badge">Am Zug</span>` : "";
      card.innerHTML = `
        <div class="profile-head">
          <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
          <span class="profile-name">${escapeHtml(p.name)}</span>
          ${badge}
        </div>`;

      // Begriff: bei Bedarf antippen zum Anzeigen (z. B. wenn jemand ihn vergessen hat)
      const termBtn = document.createElement("button");
      termBtn.type = "button";
      const visible = p.shown || p.rank !== null || game.over;
      termBtn.className = "term-box" + (visible ? " shown" : "");
      termBtn.innerHTML = visible
        ? `<span class="term">${escapeHtml(p.term)}</span>${p.rank === null && !game.over ? `<span class="muted small">antippen zum Verdecken</span>` : ""}`
        : `<span class="muted small">Person antippen zum Anzeigen</span>`;
      if (p.rank === null && !game.over) {
        termBtn.addEventListener("click", () => { p.shown = !p.shown; renderGame(); });
      }
      card.appendChild(termBtn);

      // Textfeld zum Raten – nur beim Spieler, der dran ist
      if (current) {
        const form = document.createElement("form");
        form.className = "guess-form";
        form.autocomplete = "off";
        form.innerHTML = `
          <input type="text" maxlength="40" placeholder="Wer bin ich? Person raten" autocomplete="off" spellcheck="false">
          <div class="guess-actions">
            <button class="btn primary" type="submit">Raten</button>
            <button class="btn ghost next-btn" type="button">Antwort war „Nein“ → Nächster</button>
          </div>`;
        form.addEventListener("submit", (e) => { e.preventDefault(); guess(p, form.querySelector("input").value); });
        form.querySelector(".next-btn").addEventListener("click", () => { nextTurn(); renderGame(); });
        card.appendChild(form);
      }
      wrap.appendChild(card);
    });

    // Ergebnis
    if (game.over) {
      const ranking = $("wbi-ranking");
      ranking.innerHTML = "";
      const sorted = game.players.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
      for (const p of sorted) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${escapeHtml(p.name)}</strong> war <strong>${escapeHtml(p.term)}</strong>${p.rank === null ? " – nicht erraten" : ""}`;
        ranking.appendChild(li);
      }
    }
    $("wbi-result").hidden = !game.over;
  }

  async function guess(p, text) {
    if (!normalize(text)) return;
    if (isCorrectGuess(text, p.term, true)) {
      p.rank = ++game.solvedCount;
      p.shown = true;
      if (unsolved().length <= 1) {
        game.over = true;
        renderGame();
        window.scrollTo({ top: 0, behavior: "smooth" });
        await showModal({ emoji: "🎉", title: `${p.name} hat es erraten!`, text: `${p.name} ist ${p.term}.\nDamit ist das Spiel vorbei.` });
        return;
      }
      nextTurn();
      renderGame();
      await showModal({ emoji: "🎉", title: `${p.name} hat es erraten!`, text: `${p.name} ist ${p.term} – Platz ${p.rank}!\nWeiter geht's mit ${game.players[game.turn].name}.` });
    } else {
      nextTurn();
      renderGame();
      await showModal({ emoji: "❌", title: "Leider falsch", text: `„${text.trim()}“ ist es nicht.\nJetzt ist ${game.players[game.turn].name} dran.` });
    }
  }

  async function endGame() {
    const ok = await showModal({ emoji: "🏁", title: "Spiel beenden?", text: "Alle Personen werden aufgedeckt.", ok: "Beenden", cancel: "Weiterspielen" });
    if (!ok) return;
    game.over = true;
    renderGame();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("wbi-stepper").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dir]");
      if (!btn) return;
      const dir = Number(btn.dataset.dir);
      if (dir > 0 && settings.names.length < MAX_PLAYERS) settings.names.push("");
      if (dir < 0 && settings.names.length > MIN) settings.names.pop();
      clampImpostors();
      saveSettings();
      renderSetup();
    });
    $("wbi-start").addEventListener("click", start);
    $("wbi-assign-form").addEventListener("submit", submitAssign);
    $("wbi-suggest").addEventListener("click", () => {
      $("wbi-term").value = randomPerson(game ? game.players.map((p) => p.term) : []);
    });
    $("wbi-show-card").addEventListener("click", onShowTap);
    $("wbi-end").addEventListener("click", endGame);
    $("wbi-again").addEventListener("click", start);
    $("wbi-to-setup").addEventListener("click", () => { renderSetup(); showScreen("wbi-setup", "setup"); });
  });

  return { openSetup };
})();
