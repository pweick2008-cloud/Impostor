"use strict";

/* =========================================================
   Wer bin ich? – Online
   Zeigt an, was der Server schickt: Personen ausdenken, danach die
   Spielrunde mit allen Personen außer der eigenen, Fragen mit
   Ja/Nein/Enthaltung-Abstimmung und dem Raten der eigenen Person.
   ========================================================= */
const WBIOnline = (() => {
  let lastPhase = null;
  const cards = new Map(); // Spieler-ID → Karten-Elemente (bleiben bestehen, damit Eingaben erhalten bleiben)

  function render(state) {
    const g = state.game;
    if (g.phase !== lastPhase) {
      if (g.phase === "assign") {
        $("wo-term").value = "";
        $("wo-cards").innerHTML = "";
        cards.clear();
      }
      lastPhase = g.phase;
    }
    if (g.phase === "assign") {
      renderAssign(state);
      return "wo-assign";
    }
    renderGame(state);
    return "wo-game";
  }

  /* ---------- Personen ausdenken ---------- */
  function renderAssign(state) {
    const g = state.game;
    const host = Online.isHost();
    const active = g.players.filter((p) => !p.left);
    const done = active.filter((p) => p.assignDone).length;
    $("wo-assign-progress").textContent = `${done} von ${active.length} fertig`;

    const t = g.myTarget;
    $("wo-target").textContent = t ? t.name : "";
    const submitted = t && t.term;
    $("wo-submit").textContent = submitted ? "Ändern" : "Festlegen";
    $("wo-assign-done").hidden = !submitted;
    if (submitted) {
      $("wo-assign-done").textContent = `Du hast „${t.term}“ für ${t.name} festgelegt. Ändern geht, bis alle fertig sind.`;
    }

    const list = $("wo-assign-list");
    list.innerHTML = "";
    for (const p of g.players) {
      const li = document.createElement("li");
      li.className = "lobby-player" + (p.connected && !p.left ? "" : " offline");
      li.innerHTML = `
        <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(p.name)}${p.id === state.you ? " (Du)" : ""}</span>
        <span class="badge${p.assignDone ? " win" : ""}">${p.left ? "verlassen" : p.assignDone ? "✓ fertig" : "denkt nach …"}</span>`;
      list.appendChild(li);
    }
    $("wo-fill").hidden = !host || done === active.length;
  }

  /* ---------- Spielrunde ---------- */
  function cardFor(p, state) {
    let c = cards.get(p.id);
    if (c) return c;

    const el = document.createElement("div");
    el.className = "wbi-card";
    el.innerHTML = `
      <div class="profile-head"></div>
      <div class="term-box"></div>
      <ol class="q-history"></ol>`;

    // Eingaben nur im eigenen Profil: Frage stellen oder Person raten
    let form = null;
    if (p.id === state.you) {
      form = document.createElement("div");
      form.className = "my-turn";
      form.innerHTML = `
        <form class="guess-form ask-form" autocomplete="off">
          <input type="text" maxlength="140" placeholder="Ja/Nein-Frage, z. B. „Bin ich ein Mann?“" autocomplete="off">
          <button class="btn primary" type="submit">Frage stellen</button>
        </form>
        <form class="guess-form solve-form" autocomplete="off">
          <input type="text" maxlength="40" placeholder="Wer bin ich? Person raten" autocomplete="off" spellcheck="false">
          <button class="btn" type="submit">Raten</button>
        </form>`;
      form.querySelector(".ask-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = e.target.querySelector("input");
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        Online.send({ type: "wbiAsk", text });
        input.value = "";
      });
      form.querySelector(".solve-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = e.target.querySelector("input");
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        const ok = await showModal({ emoji: "🙋", title: `Bist du „${text}“?`, text: "Ist es falsch, ist der Nächste dran.", ok: "Raten", cancel: "Abbrechen" });
        if (!ok) return;
        Online.send({ type: "wbiGuess", text });
        input.value = "";
      });
      el.appendChild(form);
    }

    c = { el, head: el.querySelector(".profile-head"), term: el.querySelector(".term-box"), history: el.querySelector(".q-history"), form };
    cards.set(p.id, c);
    return c;
  }

  function renderGame(state) {
    const g = state.game;
    const host = Online.isHost();
    const over = g.phase === "over";
    const turnPlayer = g.players.find((p) => p.id === g.turnId);
    const myTurn = g.turnId === state.you;
    const q = g.question;
    const stillIn = g.players.filter((p) => !p.left && !p.rank).length;

    $("screen-wo-game").classList.toggle("over", over);
    $("wo-sub").textContent = over
      ? "Das Spiel ist vorbei."
      : `${myTurn ? "Du bist dran" : `${turnPlayer ? turnPlayer.name : ""} ist dran`} · ${stillIn} noch im Spiel`;

    // Aktuelle Frage
    const qc = $("wo-question");
    qc.hidden = !q || over;
    if (q && !over) {
      const asker = g.players.find((p) => p.id === q.asker);
      const mine = q.asker === state.you;
      $("wo-q-label").textContent = mine ? "Deine Frage" : `Frage von ${asker ? asker.name : ""}`;
      $("wo-q-text").textContent = q.text;
      $("wo-q-buttons").hidden = !q.canAnswer || !!q.myAnswer;
      const label = { yes: "Ja", no: "Nein", abstain: "Enthaltung" };
      $("wo-q-status").textContent = q.myAnswer
        ? `Du hast mit „${label[q.myAnswer]}“ gestimmt. ${q.answered}/${q.voters} haben abgestimmt.`
        : mine
          ? `Die anderen stimmen ab … ${q.answered}/${q.voters}`
          : `${q.answered}/${q.voters} haben abgestimmt. Enthaltungen zählen nicht.`;
      $("wo-q-host").hidden = !host;
    }

    // Spielerkarten
    const wrap = $("wo-cards");
    g.players.forEach((p, i) => {
      const c = cardFor(p, state);
      const isMe = p.id === state.you;
      const current = !over && p.id === g.turnId;
      c.el.className = "wbi-card" + (current ? " current" : "") + (p.rank ? " solved" : "") + (p.left ? " out" : "") + (isMe ? " me" : "");

      let badge = "";
      if (p.rank) badge = `<span class="badge win">🏆 Platz ${p.rank}</span>`;
      else if (p.left) badge = `<span class="badge">verlassen</span>`;
      else if (current) badge = `<span class="badge">Am Zug</span>`;
      c.head.innerHTML = `
        <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(p.name)}${isMe ? " (Du)" : ""}</span>
        ${p.connected || p.left ? "" : `<span class="dot-offline" title="offline"></span>`}
        ${badge}`;

      // Alle Personen sind sichtbar – außer die eigene (bis man sie erraten hat)
      if (p.term) {
        c.term.className = "term-box shown";
        c.term.innerHTML = `<span class="term">${escapeHtml(p.term)}</span>${p.termBy ? `<span class="muted small">ausgedacht von ${escapeHtml(p.termBy)}</span>` : ""}`;
      } else {
        c.term.className = "term-box secret";
        c.term.innerHTML = `<span class="term">❓ ???</span><span class="muted small">Deine Person ist geheim</span>`;
      }

      c.history.innerHTML = p.history.map((h) =>
        `<li><span>${escapeHtml(h.q)}</span> <span class="answer ${h.a === "Ja" ? "yes" : "no"}">${h.a}</span></li>`
      ).join("");
      c.history.hidden = p.history.length === 0;

      if (c.form) {
        const canAct = myTurn && !q && !over;
        c.form.hidden = !canAct;
      }

      // Reihenfolge sicherstellen, ohne bestehende Elemente unnötig zu verschieben
      if (wrap.children[i] !== c.el) wrap.insertBefore(c.el, wrap.children[i] || null);
    });

    // Ergebnis
    $("wo-result").hidden = !over;
    if (over) {
      const ranking = $("wo-ranking");
      ranking.innerHTML = "";
      const sorted = g.players.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
      for (const p of sorted) {
        const li = document.createElement("li");
        const status = p.rank ? "" : p.left ? " – hat verlassen" : " – nicht erraten";
        li.innerHTML = `<strong>${escapeHtml(p.name)}</strong> war <strong>${escapeHtml(p.term || "?")}</strong>${status}`;
        ranking.appendChild(li);
      }
      $("wo-again").hidden = !host;
      $("wo-to-lobby").hidden = !host;
      $("wo-wait-host").hidden = host;
    }

    // Verlauf
    const logEl = $("wo-log");
    logEl.innerHTML = "";
    for (const entry of g.log) {
      const li = document.createElement("li");
      li.textContent = entry;
      logEl.appendChild(li);
    }
    $("wo-log-card").hidden = g.log.length === 0;

    $("wo-skip").hidden = !host || over || myTurn || !turnPlayer;
    if (turnPlayer) $("wo-skip").textContent = `${turnPlayer.name} überspringen (Host)`;
    $("wo-end").hidden = !host || over;
  }

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("wo-assign-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("wo-term");
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      Online.send({ type: "wbiTerm", text });
    });
    $("wo-suggest").addEventListener("click", () => { $("wo-term").value = randomPerson(); });
    $("wo-fill").addEventListener("click", () =>
      Online.confirmHost("Personen zufällig vergeben?", "Wer noch keine Person festgelegt hat, bekommt eine zufällige.", "wbiFill"));

    $("wo-q-buttons").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-answer]");
      if (btn) Online.send({ type: "wbiAnswer", answer: btn.dataset.answer });
    });
    $("wo-q-resolve").addEventListener("click", () =>
      Online.confirmHost("Jetzt auswerten?", "Wer noch nicht abgestimmt hat, wird nicht gezählt.", "wbiResolve"));
    $("wo-skip").addEventListener("click", () =>
      Online.confirmHost("Spieler überspringen?", "Der Nächste ist dran.", "wbiSkip"));
    $("wo-end").addEventListener("click", () =>
      Online.confirmHost("Spiel beenden?", "Alle kehren in die Lobby zurück.", "endGame"));
    $("wo-again").addEventListener("click", () => Online.send({ type: "start" }));
    $("wo-to-lobby").addEventListener("click", () => Online.send({ type: "endGame" }));
    document.querySelectorAll(".wo-leave").forEach((b) => b.addEventListener("click", () => Online.leaveLobby()));
  });

  return { render };
})();
