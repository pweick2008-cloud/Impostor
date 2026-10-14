"use strict";

/* =========================================================
   SPIEGEL – Online (genau 2 Spieler) und Anzeige für Pass & Play
   Zeigt an, was der Server schickt. Auswahlen (Karte, Zahlen,
   Wahrheit/Lüge …) bleiben lokal, bis der Zug abgeschickt wird.
   ========================================================= */
const LUOnline = (() => {
  const TRAP_POINTS = { 1: 9, 2: 6, 3: 3 };
  let draftKey = null;
  let draft = {};
  let trapDraft = { card: null, from: null, len: 3 };
  let state = null;

  const name = (id) => (state.game.players.find((p) => p.id === id) || {}).name || "";
  const me = () => state.game.players.find((p) => p.id === state.you);

  // Pass & Play: Aktionen gehen an die lokale Spiellogik statt an den Server
  const isLocal = () => !!(state && state.local);
  const send = (msg) => (isLocal() ? LocalSpiegel.handle(msg) : Online.send(msg));
  const isHost = () => isLocal() || Online.isHost();

  let lastPhase = null;
  let lastYou = null;

  function render(s) {
    state = s;
    const g = s.game;
    // Neue Falle-Phase oder anderer Spieler am Gerät → Auswahl zurücksetzen
    if (g.phase === "setup" && (lastPhase !== "setup" || lastYou !== s.you)) trapDraft = { card: null, from: null, len: 3 };
    lastPhase = g.phase;
    lastYou = s.you;
    document.querySelectorAll(".lu-leave").forEach((b) => { b.textContent = isLocal() ? "Spiel abbrechen" : "Lobby verlassen"; });
    if (g.phase === "setup") {
      renderSetup();
      return "lu-setup";
    }
    renderGame();
    return "lu-game";
  }

  /* ---------- Hilfen ---------- */
  function numButtons(container, values, { selected = [], disabled = [], onPick, cls = "" }) {
    container.innerHTML = "";
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "num-btn" + (cls ? " " + cls : "") + (selected.includes(v) ? " selected" : "");
      b.textContent = v;
      b.disabled = disabled.includes(v);
      b.addEventListener("click", () => onPick(v));
      container.appendChild(b);
    }
  }

  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /* ---------- Falle stellen ---------- */
  function renderSetup() {
    const g = state.game;
    const mine = me();
    const opp = g.players.find((p) => p.id === g.opp);
    $("lu-setup-sub").textContent = `Gegen ${opp ? opp.name : "?"} · ${mine.starter ? "Du beginnst" : "Dein Gegner beginnt"} · ${g.rounds} Runden`;

    // Gespeicherte Falle als Ausgangswert übernehmen
    if (mine.trap && trapDraft.card === null) {
      trapDraft = { card: mine.trap.card, from: mine.trap.from, len: mine.trap.to - mine.trap.from + 1 };
    }

    numButtons($("lu-trap-cards"), ALL, { selected: [trapDraft.card], onPick: (v) => { trapDraft.card = v; renderSetup(); } });
    const rounds = Array.from({ length: g.rounds }, (_, i) => i + 1);
    numButtons($("lu-trap-from"), rounds, { selected: [trapDraft.from], onPick: (v) => { trapDraft.from = v; renderSetup(); } });

    const lens = $("lu-trap-len");
    lens.innerHTML = "";
    for (const len of [3, 2, 1]) {
      lens.appendChild(makeChip(`${len} ${len === 1 ? "Runde" : "Runden"} · ${TRAP_POINTS[len]} P.`, trapDraft.len === len, () => { trapDraft.len = len; renderSetup(); }));
    }

    const ready = trapDraft.card !== null && trapDraft.from !== null;
    let preview = "Wähle eine Karte und die erste Runde.";
    if (ready) {
      const to = Math.min(g.rounds, trapDraft.from + trapDraft.len - 1);
      const span = to - trapDraft.from + 1;
      preview = `Spielt ${opp ? opp.name : "dein Gegner"} die ${trapDraft.card} ${span === 1 ? `in Runde ${trapDraft.from}` : `in Runde ${trapDraft.from}–${to}`}, bekommst du ${TRAP_POINTS[span]} Punkte.`;
    }
    $("lu-trap-preview").textContent = preview;
    $("lu-trap-submit").disabled = !ready;
    $("lu-trap-submit").textContent = mine.trapSet ? "Falle ändern" : "Falle stellen";
    $("lu-trap-status").hidden = !mine.trapSet;
    $("lu-trap-status").textContent = mine.trapSet ? `Deine Falle steht: Karte ${mine.trap.card}, Runde ${mine.trap.from}${mine.trap.to > mine.trap.from ? "–" + mine.trap.to : ""}. Warte auf deinen Gegner …` : "";

    const list = $("lu-setup-list");
    list.innerHTML = "";
    for (const p of g.players) {
      const li = document.createElement("li");
      li.className = "lobby-player" + (p.connected ? "" : " offline");
      li.innerHTML = `
        <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(p.name)}${p.id === state.you ? " (Du)" : ""}</span>
        <span class="badge${p.trapSet ? " win" : ""}">${p.trapSet ? "✓ Falle steht" : "wählt …"}</span>`;
      list.appendChild(li);
    }
  }

  function submitTrap() {
    if (trapDraft.card === null || trapDraft.from === null) return;
    const to = Math.min(state.game.rounds, trapDraft.from + trapDraft.len - 1);
    send({ type: "luTrap", card: trapDraft.card, from: trapDraft.from, to });
  }

  /* ---------- Spielbrett ---------- */
  function trapText(p, own) {
    if (!p.trap) return p.trapState === "verpasst" ? "Falle verpasst" : "Falle verdeckt";
    const t = p.trap;
    const span = t.from === t.to ? `Runde ${t.from}` : `Runde ${t.from}–${t.to}`;
    const st = p.trapState === "ausgelöst" ? " · ausgelöst" : p.trapState === "verpasst" ? " · verpasst" : "";
    return `${own ? "Deine Falle" : "Falle"}: ${t.card} in ${span} (${t.points} P.)${st}`;
  }

  // Kurze Anzeige nach jeder Runde: Punktestand und offene Karten des Gegners
  let shownRound = null;
  let overlayTimer = null;

  function showScoreOverlay() {
    const g = state.game;
    const mine = me();
    const opp = g.players.find((p) => p.id === g.opp);
    if (!opp) return;
    const done = g.round - 1;
    $("lu-so-title").textContent = `Punktestand nach Runde ${done}`;
    $("lu-so-scores").innerHTML = [mine, opp].map((p) => `
      <div class="lu-so-player${p === mine ? " me" : ""}">
        <span class="lu-so-name">${escapeHtml(p === mine ? "Du" : p.name)}</span>
        <span class="lu-points">${p.score}</span>
      </div>`).join('<span class="lu-vs">:</span>');
    $("lu-so-opp").textContent = `Noch offene Karten von ${opp.name}`;
    $("lu-so-hand").innerHTML = opp.hand.map((c) => `<span class="mini-card">${c}</span>`).join("");
    $("lu-so-trap").textContent = trapText(mine, true);

    const box = $("lu-score-overlay");
    box.hidden = false;
    const bar = $("lu-so-bar");
    bar.classList.remove("run");
    void bar.offsetWidth; // Countdown-Animation neu starten
    bar.classList.add("run");
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(hideScoreOverlay, 5000);
  }

  function hideScoreOverlay() {
    clearTimeout(overlayTimer);
    $("lu-score-overlay").hidden = true;
  }

  function renderGame() {
    const g = state.game;
    const host = isHost();
    const local = isLocal();
    const over = g.phase === "over";
    const myId = state.you;
    const amAttacker = g.attacker === myId;
    const mine = me();

    $("screen-lu-game").classList.toggle("over", over);
    $("lu-sub").textContent = over
      ? "Das Spiel ist vorbei."
      : `Runde ${g.round} von ${g.rounds} · ${amAttacker ? "Du legst zuerst" : `${name(g.attacker)} legt zuerst`}`;

    // Nach jeder beendeten Runde kurz den Punktestand zeigen
    if (shownRound === null) shownRound = g.round; // nicht direkt nach dem Neuladen
    if (g.phase === "play" && g.round !== shownRound) {
      shownRound = g.round;
      if (g.round > 1) showScoreOverlay();
    }
    if (g.phase !== "play") hideScoreOverlay();

    // Ergebnis
    const banner = $("lu-result");
    banner.hidden = !over;
    if (over && g.result) {
      const won = g.result.winner === myId;
      const draw = !g.result.winner;
      banner.classList.remove("crew", "impostor");
      banner.classList.add(draw || won || local ? "crew" : "impostor");
      $("lu-end-emoji").textContent = draw ? "" : won || local ? "" : "";
      $("lu-end-title").textContent = draw ? "Unentschieden!" : won && !local ? "Du hast gewonnen!" : `${name(g.result.winner)} gewinnt!`;
      // Großer Endstand: online eigene Punkte links, bei Pass & Play Spieler 1 links
      const order = (local ? g.players : [me(), g.players.find((p) => p.id === g.opp)]).filter(Boolean);
      $("lu-final").innerHTML = order.map((p) => `
        <div class="lu-final-side${p.id === myId && !local ? " me" : ""}">
          <span class="lu-final-num">${p.score}</span>
          <span class="lu-final-name">${escapeHtml(p.id === myId && !local ? "Du" : p.name)}</span>
        </div>`).join('<span class="lu-final-sep">:</span>');
      $("lu-end-reason").textContent = g.result.reason || "";
      $("lu-again").hidden = !host;
      $("lu-to-lobby").hidden = !host;
      $("lu-to-lobby").textContent = local ? "Zurück zum Menü" : "Zurück zur Lobby";
      $("lu-wait-host").hidden = host;
    }

    // Aktionsbereich
    const key = `${g.round}-${g.step}-${g.phase}-${myId}`;
    if (key !== draftKey) {
      draftKey = key;
      draft = { card: null, nums: [], joker: false, defCard: null };
    }
    const show = { attack: false, defend: false, wait: false, reveal: false };

    if (g.phase === "play" && g.step === "attack") {
      if (amAttacker) {
        show.attack = true;
        renderAttack(mine);
      } else {
        show.wait = true;
        $("lu-wait-text").textContent = `${name(g.attacker)} legt eine Karte verdeckt und wählt 3 Zahlen …`;
      }
    } else if (g.phase === "play" && g.step === "defend") {
      if (!amAttacker) {
        show.defend = true;
        renderDefend(mine);
      } else {
        show.wait = true;
        const m = g.move;
        $("lu-wait-text").innerHTML = `Du hast die <strong>${m.card}</strong> gelegt und ${m.nums.join(", ")} genannt – ${m.claim === "lie" ? "gelogen" : "wahr"}.<br>${escapeHtml(name(g.defender))} entscheidet …`;
      }
    } else if (g.step === "reveal" && !over) {
      // Am Spielende keine letzte Runde mehr – dort stehen Endstand und Rundenlog
      const last = g.lastResult || g.history[g.history.length - 1];
      if (last) {
        show.reveal = true;
        renderReveal(last, over);
      }
    }
    $("lu-attack").hidden = !show.attack;
    $("lu-defend").hidden = !show.defend;
    $("lu-wait").hidden = !show.wait;
    $("lu-reveal").hidden = !show.reveal;

    renderHistory();
    $("lu-end").hidden = !host || over || local;
  }

  function renderAttack(mine) {
    numButtons($("lu-att-cards"), ALL, {
      selected: [draft.card],
      disabled: ALL.filter((c) => !mine.hand.includes(c)),
      cls: "card-btn",
      onPick: (v) => { draft.card = v; renderGame(); }
    });
    numButtons($("lu-att-nums"), ALL, {
      selected: draft.nums,
      onPick: (v) => {
        if (draft.nums.includes(v)) draft.nums = draft.nums.filter((x) => x !== v);
        else if (draft.nums.length < 3) draft.nums = [...draft.nums, v];
        renderGame();
      }
    });
    // Ob gelogen wird, ergibt sich aus Karte und Zahlen – ohne eigenen Button
    const opp = state.game.players.find((p) => p.id === state.game.opp);
    const liePoints = opp && opp.jokers > 0 ? 2 : 0;
    const hint = $("lu-att-hint");
    let ok = false;
    hint.className = "lu-hint";
    if (draft.card === null) hint.textContent = "Wähle zuerst deine Karte.";
    else if (draft.nums.length !== 3) hint.textContent = `Wähle genau 3 Zahlen (${draft.nums.length}/3).`;
    else {
      ok = true;
      if (attackClaim() === "lie") {
        hint.textContent = `Deine ${draft.card} ist nicht dabei – du lügst${liePoints ? ` (+${liePoints}, wenn er's nicht merkt)` : ""}.`;
        hint.classList.add("bad");
      } else {
        hint.textContent = `Deine ${draft.card} ist dabei – du sagst die Wahrheit.`;
        hint.classList.add("good");
      }
    }
    $("lu-att-submit").disabled = !ok;
  }

  const attackClaim = () => (draft.nums.includes(draft.card) ? "truth" : "lie");

  function submitAttack(e) {
    e.preventDefault();
    if (draft.card === null || draft.nums.length !== 3) return;
    send({ type: "luAttack", card: draft.card, nums: draft.nums, claim: attackClaim() });
  }

  function renderDefend(mine) {
    const g = state.game;
    const m = g.move;
    $("lu-def-label").textContent = `${name(g.attacker)} sagt über seine verdeckte Karte:`;
    $("lu-def-text").textContent = "„Es ist eine dieser Zahlen.“";
    $("lu-def-nums").innerHTML = m.nums.map((n) => `<span class="mini-card">${n}</span>`).join("");

    // Nur ein Feld: Lügenjoker setzen oder nicht
    const choice = $("lu-def-choice");
    const hasJoker = mine.jokers > 0;
    if (!hasJoker) draft.joker = false;
    choice.innerHTML = `
      <button type="button" class="lu-joker${draft.joker ? " on" : ""}" aria-pressed="${draft.joker}" ${hasJoker ? "" : "disabled"}>
        <span><strong>Lügenjoker</strong><br><span class="small muted">${hasJoker
          ? `Noch ${mine.jokers} übrig · richtig: Lügner 0, du +2 · falsch: −2`
          : "Keine Lügenjoker mehr"}</span></span>
        <span class="sw"></span>
      </button>`;
    choice.querySelector(".lu-joker").addEventListener("click", () => { draft.joker = !draft.joker; renderGame(); });

    numButtons($("lu-def-cards"), ALL, {
      selected: [draft.defCard],
      disabled: ALL.filter((c) => !mine.hand.includes(c)),
      cls: "card-btn",
      onPick: (v) => { draft.defCard = v; renderGame(); }
    });
    $("lu-def-submit").disabled = draft.defCard === null;
  }

  function submitDefend(e) {
    e.preventDefault();
    if (draft.defCard === null) return;
    send({ type: "luDefend", defense: draft.joker ? "joker" : "believe", card: draft.defCard });
  }

  function renderReveal(r, over) {
    const g = state.game;
    const def = g.players.find((p) => p.id !== r.attacker);
    $("lu-rev-label").textContent = `Runde ${r.round} – aufgedeckt`;
    $("lu-rev-att").textContent = r.card;
    $("lu-rev-def").textContent = r.defCard;
    $("lu-rev-att-name").textContent = name(r.attacker);
    $("lu-rev-def-name").textContent = def ? def.name : "";
    const defText = { believe: "hat keinen Joker gesetzt", doubt: "hat keinen Joker gesetzt", joker: "hat den Lügenjoker gesetzt" }[r.defense];
    $("lu-rev-statement").innerHTML = `„Eine von ${r.nums.join(", ")}“ war <strong>${r.claim === "lie" ? "gelogen" : "wahr"}</strong> – ${escapeHtml(def ? def.name : "")} ${defText}.`;
    const lines = $("lu-rev-lines");
    lines.innerHTML = "";
    for (const l of r.lines) {
      const li = document.createElement("li");
      li.textContent = l;
      lines.appendChild(li);
    }
    const signed = (v) => (v < 0 ? `−${-v}` : `+${v}`);
    $("lu-rev-gain").textContent = g.players.map((p) => `${p.name} ${signed(r.gain[p.id] || 0)}`).join("   ·   ");

    const iReady = g.ready.includes(state.you);
    $("lu-next").hidden = over || iReady;
    $("lu-next").textContent = g.round >= g.rounds ? "Zum Ergebnis" : "Nächste Runde";
    $("lu-next-status").hidden = over || !iReady;
    $("lu-next-status").textContent = "Warte auf deinen Gegner …";
  }

  function renderHistory() {
    const g = state.game;
    $("lu-history-card").hidden = g.history.length === 0;
    if (!g.history.length) return;
    const [a, b] = [g.you, g.opp];
    const head = `<tr><th>R</th><th>Zahlen</th><th>${escapeHtml(name(a))}</th><th>${escapeHtml(name(b))}</th><th>Punkte</th></tr>`;
    const rows = g.history.map((r) => {
      const cardOf = (id) => (r.attacker === id ? r.card : r.defCard);
      const tag = r.defense === "joker" ? (r.claim === "lie" ? " · Joker entlarvt" : " · Joker daneben") : "";
      return `<tr>
        <td>${r.round}</td>
        <td>${r.nums.join(", ")} · ${r.claim === "lie" ? "Lüge" : "wahr"}${tag}</td>
        <td class="num">${cardOf(a)}</td>
        <td class="num">${cardOf(b)}</td>
        <td class="num">${r.gain[a] || 0} : ${r.gain[b] || 0}</td>
      </tr>`;
    }).join("");
    $("lu-history").innerHTML = head + rows;
  }

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("lu-trap-submit").addEventListener("click", submitTrap);
    $("lu-score-overlay").addEventListener("click", hideScoreOverlay);
    $("lu-attack").addEventListener("submit", submitAttack);
    $("lu-defend").addEventListener("submit", submitDefend);
    $("lu-next").addEventListener("click", () => send({ type: "luNext" }));
    $("lu-end").addEventListener("click", () => Online.confirmHost("Spiel beenden?", "Beide kehren in die Lobby zurück.", "endGame"));
    $("lu-again").addEventListener("click", () => send({ type: "start" }));
    $("lu-to-lobby").addEventListener("click", () => send({ type: "endGame" }));
    document.querySelectorAll(".lu-leave").forEach((b) => b.addEventListener("click", () => (isLocal() ? LocalSpiegel.quit() : Online.leaveLobby())));
  });

  return { render };
})();
