"use strict";

/* =========================================================
   Stadt Land Fluss – Online (1 bis 20 Spieler)
   Zeigt an, was der Server schickt: Lobby-Einstellungen, Schreiben mit
   Timer, Auswertung mit Abstimmung und Gleichsetzen, Punktestand.
   ========================================================= */
const SLFOnline = (() => {
  const TIMERS = [0, 60, 90, 120, 180, 240, 300];
  let state = null;
  let fieldsKey = null; // Runde, für die die Eingabefelder gebaut wurden
  let draftTimer = null;
  let clockTimer = null;
  let clockOffset = 0; // Serverzeit − eigene Uhr
  let mergeCat = null; // Kategorie, in der der Host gerade gleichsetzt
  let mergeSel = new Set();

  const g = () => state.game;
  const isHost = () => Online.isHost();
  const name = (id) => (g().players.find((p) => p.id === id) || {}).name || "";
  const fmtTime = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "Ohne");

  function render(s) {
    state = s;
    const phase = s.game.phase;
    if (phase === "write") {
      renderWrite();
      return "slf-write";
    }
    stopClock();
    fieldsKey = null; // nächste Schreibrunde baut frische Felder
    if (phase === "review") {
      renderReview();
      return "slf-review";
    }
    renderScores();
    return "slf-scores";
  }

  /* ---------- Lobby-Einstellungen (nur der Host ändert) ---------- */
  function renderLobbySettings(s) {
    state = s;
    const host = isHost();
    const st = s.slfSettings;
    $("slf-host-pill").textContent = host ? "Du bist Host" : "Nur der Host kann ändern";

    const cats = $("slf-cats");
    cats.innerHTML = "";
    st.categories.forEach((c, i) => {
      const chip = document.createElement(host ? "button" : "span");
      chip.className = "chip selected slf-cat-chip";
      chip.textContent = c;
      if (host) {
        chip.type = "button";
        chip.title = `${c} entfernen`;
        chip.insertAdjacentHTML("beforeend", '<span class="slf-x" aria-hidden="true">×</span>');
        chip.addEventListener("click", () => {
          if (st.categories.length <= 1) return showToast("Mindestens eine Kategorie muss bleiben.");
          send({ categories: st.categories.filter((_, j) => j !== i) });
        });
      }
      cats.appendChild(chip);
    });
    $("slf-cat-form").hidden = !host;

    const timers = $("slf-timers");
    timers.innerHTML = "";
    for (const t of TIMERS) {
      timers.appendChild(makeChip(fmtTime(t), st.timer === t, host ? () => send({ timer: t }) : null));
    }
    timers.classList.toggle("static", !host);
    cats.classList.toggle("static", !host);

    $("slf-rounds").textContent = st.rounds;
    $("slf-rounds-stepper").classList.toggle("disabled", !host);
  }

  function send(settings) {
    Online.send({ type: "slfSettings", settings });
  }

  /* ---------- Schreiben ---------- */
  function buildFields() {
    const wrap = $("slf-fields");
    wrap.innerHTML = "";
    const mine = g().myAnswers || [];
    g().categories.forEach((c, i) => {
      const row = document.createElement("label");
      row.className = "slf-field";
      row.innerHTML = `<span class="slf-field-name"></span><input type="text" maxlength="40" autocomplete="off" spellcheck="false" autocapitalize="words">`;
      row.querySelector(".slf-field-name").textContent = c;
      const input = row.querySelector("input");
      input.value = mine[i] || "";
      input.placeholder = `${c} mit ${g().letter} …`;
      input.addEventListener("input", onType);
      wrap.appendChild(row);
    });
  }

  const inputs = () => [...$("slf-fields").querySelectorAll("input")];
  const answers = () => inputs().map((i) => i.value.trim());
  const filled = (t) => t.trim().length >= 2;

  function onType() {
    updateWriteHint();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => Online.send({ type: "slfDraft", answers: answers() }), 400);
  }

  function updateWriteHint() {
    const a = answers();
    const missing = a.filter((t) => !filled(t)).length;
    const letter = normalize(g().letter);
    inputs().forEach((inp) => {
      const v = normalize(inp.value);
      inp.classList.toggle("off-letter", v.length > 0 && !v.startsWith(letter));
    });
    const me = g().players.find((p) => p.id === state.you);
    const done = me && me.done;
    $("slf-done").disabled = missing > 0 || done;
    $("slf-hint").className = "lu-hint" + (missing ? "" : " good");
    $("slf-hint").textContent = done
      ? "Du bist fertig. Warte auf die anderen …"
      : missing
        ? `Noch ${missing} ${missing === 1 ? "Feld" : "Felder"} offen – jedes Feld braucht mindestens 2 Zeichen.`
        : "Alles ausgefüllt.";
  }

  function renderWrite() {
    const game = g();
    const key = `${game.round}-${game.letter}`;
    if (key !== fieldsKey) {
      fieldsKey = key;
      mergeCat = null;
      buildFields();
    }
    const me = game.players.find((p) => p.id === state.you);
    const done = !!(me && me.done);
    inputs().forEach((i) => { i.disabled = done; });
    $("slf-done").hidden = done;
    $("slf-edit").hidden = !done;
    $("slf-write-sub").textContent = `Runde ${game.round} von ${game.rounds}`;
    $("slf-letter").textContent = game.letter;
    updateWriteHint();

    const active = game.players.filter((p) => !p.left);
    $("slf-done-count").textContent = `${active.filter((p) => p.done).length}/${active.length}`;
    const list = $("slf-done-list");
    list.innerHTML = "";
    for (const p of active) {
      const li = document.createElement("li");
      li.className = "lobby-player" + (p.connected ? "" : " offline");
      li.innerHTML = `<span class="avatar"></span><span class="profile-name"></span><span class="badge${p.done ? " win" : ""}">${p.done ? "fertig" : "schreibt …"}</span>`;
      li.querySelector(".avatar").textContent = p.name.charAt(0).toUpperCase();
      li.querySelector(".profile-name").textContent = p.name + (p.id === state.you ? " (Du)" : "");
      list.appendChild(li);
    }
    $("slf-stop").hidden = !isHost();

    // Timer
    clockOffset = game.now - Date.now();
    $("slf-timer-box").hidden = !game.endsAt;
    if (game.endsAt) startClock();
    else stopClock();
  }

  function startClock() {
    stopClock();
    const tick = () => {
      const left = Math.max(0, Math.ceil((g().endsAt - (Date.now() + clockOffset)) / 1000));
      $("slf-timer").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      $("slf-timer-box").classList.toggle("urgent", left <= 10);
    };
    tick();
    clockTimer = setInterval(tick, 250);
  }

  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  /* ---------- Auswertung ---------- */
  function categoryCard(cat, c, interactive) {
    const game = g();
    const host = isHost() && interactive;
    const card = document.createElement("div");
    card.className = "card slf-cat";
    const merging = host && mergeCat === cat;

    // Gruppen gleicher Antworten: wer hat dasselbe?
    const groupMembers = {};
    for (const a of c.answers) if (a.group) (groupMembers[a.group] = groupMembers[a.group] || []).push(a.id);

    card.innerHTML = `<div class="row-between"><h2></h2><div class="slf-cat-tools"></div></div><div class="slf-answers"></div>`;
    card.querySelector("h2").textContent = c.name;
    const tools = card.querySelector(".slf-cat-tools");
    if (host) {
      if (merging) {
        const ok = button("Übernehmen", "btn primary small-btn", () => {
          Online.send({ type: "slfMerge", cat, ids: [...mergeSel] });
          mergeCat = null;
        });
        ok.disabled = mergeSel.size < 2;
        tools.append(ok, button("Abbrechen", "btn ghost small-btn", () => { mergeCat = null; renderReview(); }));
      } else if (c.answers.filter((a) => a.text).length >= 2) {
        tools.append(button("Gleichsetzen", "btn ghost small-btn", () => { mergeCat = cat; mergeSel = new Set(); renderReview(); }));
      }
    }

    const list = card.querySelector(".slf-answers");
    for (const a of c.answers) {
      const row = document.createElement("div");
      row.className = "slf-answer" + (a.text ? "" : " empty") + (a.text && !a.valid ? " invalid" : "");
      const same = a.group ? groupMembers[a.group].filter((id) => id !== a.id) : [];
      row.innerHTML = `
        <div class="slf-answer-main">
          <span class="slf-who"></span>
          <span class="slf-text"></span>
          <span class="slf-same muted small"></span>
        </div>
        <span class="slf-points">${a.text ? `+${a.points}` : "0"}</span>
        <div class="slf-answer-tools"></div>`;
      row.querySelector(".slf-who").textContent = name(a.id) + (a.id === state.you ? " (Du)" : "");
      row.querySelector(".slf-text").textContent = a.text || "keine Antwort";
      if (same.length) row.querySelector(".slf-same").textContent = `gleich wie ${same.map(name).join(", ")}`;

      const t = row.querySelector(".slf-answer-tools");
      if (merging && a.text) {
        // Auswahl zum Gleichsetzen
        const sel = button(mergeSel.has(a.id) ? "Ausgewählt" : "Auswählen", "btn small-btn" + (mergeSel.has(a.id) ? " selected" : " ghost"), () => {
          mergeSel.has(a.id) ? mergeSel.delete(a.id) : mergeSel.add(a.id);
          renderReview();
        });
        t.append(sel);
      } else if (a.text) {
        if (a.yes || a.no) t.insertAdjacentHTML("beforeend", `<span class="slf-votes muted small">${a.yes} gültig · ${a.no} ungültig</span>`);
        if (interactive && a.id !== state.you) {
          t.append(
            button("Gültig", "btn small-btn vote-yes" + (a.myVote === true ? " selected" : " ghost"), () =>
              Online.send({ type: "slfVote", cat, id: a.id, valid: a.myVote === true ? null : true })),
            button("Ungültig", "btn small-btn vote-no" + (a.myVote === false ? " selected" : " ghost"), () =>
              Online.send({ type: "slfVote", cat, id: a.id, valid: a.myVote === false ? null : false }))
          );
        }
        if (host && same.length) {
          t.append(button("Trennen", "btn ghost small-btn", () => Online.send({ type: "slfSplit", cat, id: a.id })));
        }
      }
      list.appendChild(row);
    }
    return card;
  }

  function button(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderReview() {
    const game = g();
    $("slf-review-sub").textContent = `Runde ${game.round} von ${game.rounds} · Buchstabe ${game.letter}`;
    const wrap = $("slf-review-cats");
    wrap.innerHTML = "";
    game.review.forEach((c, i) => wrap.appendChild(categoryCard(i, c, true)));
    $("slf-finish").hidden = !isHost();
    $("slf-review-wait").hidden = isHost();
  }

  /* ---------- Punktestand ---------- */
  function renderScores() {
    const game = g();
    const over = game.phase === "over";
    const host = isHost();
    const last = game.history[game.history.length - 1];
    $("slf-scores-title").textContent = over ? "Endstand" : "Punktestand";
    $("slf-scores-sub").textContent = over
      ? `Nach ${game.rounds} ${game.rounds === 1 ? "Runde" : "Runden"}`
      : `Nach Runde ${game.round} von ${game.rounds}`;

    const ranked = game.players.slice().sort((a, b) => b.total - a.total);
    const list = $("slf-ranking");
    list.innerHTML = "";
    let place = 0;
    let prev = null;
    ranked.forEach((p, i) => {
      if (p.total !== prev) place = i + 1;
      prev = p.total;
      const li = document.createElement("li");
      li.className = "slf-rank" + (p.id === state.you ? " me" : "") + (place === 1 ? " first" : "");
      li.innerHTML = `<span class="slf-place">${place}.</span><span class="slf-rank-name"></span><span class="slf-gain muted small"></span><span class="slf-total">${p.total}</span>`;
      li.querySelector(".slf-rank-name").textContent = p.name + (p.id === state.you ? " (Du)" : "");
      if (last) li.querySelector(".slf-gain").textContent = `+${last.points[p.id] || 0}`;
      list.appendChild(li);
    });

    // Tabelle: Spieler × Runden
    const head = `<tr><th>Spieler</th>${game.history.map((h) => `<th class="num">${h.round} · ${h.letter}</th>`).join("")}<th class="num">Gesamt</th></tr>`;
    const rows = ranked.map((p) =>
      `<tr><td>${escapeHtml(p.name)}</td>${game.history.map((h) => `<td class="num">${h.points[p.id] || 0}</td>`).join("")}<td class="num"><strong>${p.total}</strong></td></tr>`
    ).join("");
    $("slf-table").innerHTML = head + rows;

    // Antworten der letzten Runde zum Nachlesen
    const cats = $("slf-last-cats");
    cats.innerHTML = "";
    (game.review || []).forEach((c, i) => cats.appendChild(categoryCard(i, c, false)));

    $("slf-next").hidden = !host || over;
    $("slf-again").hidden = !host || !over;
    $("slf-to-lobby").hidden = !host || !over;
    $("slf-scores-wait").hidden = host;
  }

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("slf-cat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("slf-cat-input");
      const c = input.value.trim();
      if (!c) return;
      const st = state.slfSettings;
      if (st.categories.some((x) => normalize(x) === normalize(c))) return showToast("Diese Kategorie gibt es schon.");
      if (st.categories.length >= 12) return showToast("Höchstens 12 Kategorien.");
      send({ categories: [...st.categories, c] });
      input.value = "";
    });
    $("slf-rounds-stepper").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dir]");
      if (!b || !isHost()) return;
      const r = Math.min(20, Math.max(1, state.slfSettings.rounds + Number(b.dataset.dir)));
      send({ rounds: r });
    });

    $("slf-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!answers().every(filled)) return;
      clearTimeout(draftTimer);
      Online.send({ type: "slfDone", answers: answers() });
    });
    $("slf-edit").addEventListener("click", () => Online.send({ type: "slfUndone" }));
    $("slf-stop").addEventListener("click", () =>
      Online.confirmHost("Runde beenden?", "Alle Antworten werden so ausgewertet, wie sie gerade sind.", "slfStop"));
    $("slf-finish").addEventListener("click", () =>
      Online.confirmHost("Auswertung abschließen?", "Die Punkte dieser Runde werden vergeben.", "slfFinishReview"));
    $("slf-next").addEventListener("click", () => Online.send({ type: "slfNext" }));
    $("slf-again").addEventListener("click", () => Online.send({ type: "start" }));
    $("slf-to-lobby").addEventListener("click", () => Online.send({ type: "endGame" }));
    document.querySelectorAll(".slf-leave").forEach((b) => b.addEventListener("click", () => Online.leaveLobby()));
  });

  return { render, renderLobbySettings };
})();
