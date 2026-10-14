"use strict";

/* =========================================================
   SPIEGEL – Pass & Play (ein Gerät, 2 Spieler)
   Die Wertung steht in spiegel-rules.js. Baut einen Zustand im gleichen
   Format wie der Server und zeigt ihn mit denselben Bildschirmen an.
   ========================================================= */
const LocalSpiegel = (() => {
  const R = SpiegelRules;
  const NAMES_KEY = "spiegel-local-names";
  let G = null;
  let viewer = null;
  let names = ["", ""];

  // Zustand im Server-Format, aus Sicht des Spielers am Gerät
  function view(you) {
    const players = G.players.map((p) => {
      const showTrap = p.id === you || G.phase === "over" || p.trapState === "ausgelöst";
      return { ...p, hand: [...p.hand], trap: showTrap && p.trap ? { ...p.trap } : null };
    });
    return {
      local: true,
      you,
      game: {
        type: "luegen", inGame: true, phase: G.phase, rounds: G.rounds, round: G.round,
        attacker: G.attacker, defender: R.other(G.attacker), step: G.step, move: G.move,
        history: G.history, lastResult: G.lastResult, result: G.result, ready: [],
        you, opp: R.other(you), players
      }
    };
  }

  function show(you, phase) {
    viewer = you;
    showScreen(LUOnline.render(view(you)), phase);
  }

  async function handover(you, text, phase) {
    const n = R.byId(G, you).name;
    $("lu-score-overlay").hidden = true;
    await showPhase({ icon: "", title: `Gib das Gerät an ${n}`, text, button: `Ich bin ${n}`, phase });
    show(you, phase);
  }

  /* ---------- Start ---------- */
  function openSetup() {
    currentGame = "luegen";
    currentMode = "local";
    try { names = JSON.parse(localStorage.getItem(NAMES_KEY)) || names; } catch (e) { /* egal */ }
    $("lu-local-n1").value = names[0] || "";
    $("lu-local-n2").value = names[1] || "";
    $("lu-local-error").hidden = true;
    showScreen("lu-local", "setup");
  }

  function start() {
    const n = [$("lu-local-n1").value.trim(), $("lu-local-n2").value.trim()];
    const err = $("lu-local-error");
    if (n.some((x) => !normalize(x))) { err.textContent = "Bitte gib beiden Spielern einen Namen."; err.hidden = false; return; }
    if (normalize(n[0]) === normalize(n[1])) { err.textContent = "Die beiden Namen müssen verschieden sein."; err.hidden = false; return; }
    names = n;
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch (e) { /* egal */ }
    newRound();
  }

  function newRound() {
    G = R.newGame(names, Math.random() < 0.5 ? 0 : 1);
    trapTurn("p0");
  }

  function trapTurn(id) {
    const opp = R.byId(G, R.other(id)).name;
    handover(id, `${opp} schaut bitte weg.\nStelle geheim deine Falle für ${opp}.`, "trap");
  }

  function attackTurn() {
    const def = R.byId(G, R.other(G.attacker)).name;
    handover(G.attacker, `Runde ${G.round} von ${G.rounds}.\nDu legst zuerst – ${def} schaut bitte weg.`, "game");
  }

  /* ---------- Aktionen der Spielbildschirme ---------- */
  async function handle(msg) {
    if (!G) return;
    switch (msg.type) {
      case "luTrap":
        R.setTrap(G, viewer, msg.card, msg.from, msg.to);
        if (G.phase === "play") {
          const starter = R.byId(G, G.attacker).name;
          await showPhase({ icon: "", title: "Das Duell beginnt", text: `Beide Fallen stehen.\nDas Los hat entschieden: ${starter} legt zuerst.`, button: "Weiter", phase: "game" });
          attackTurn();
        } else {
          trapTurn(R.other(viewer));
        }
        break;
      case "luAttack":
        if (!R.attack(G, msg.card, msg.nums)) return;
        handover(R.other(G.attacker), `${R.byId(G, G.attacker).name} hat eine Karte verdeckt gelegt.\nJetzt bist du dran.`, "game");
        break;
      case "luDefend":
        if (!R.defend(G, msg.defense, msg.card)) return;
        show(viewer, "game"); // Aufdecken sehen beide
        break;
      case "luNext":
        R.next(G);
        if (G.phase === "over") show(viewer, "game");
        else attackTurn();
        break;
      case "start":
        newRound();
        break;
      case "endGame":
        G = null;
        showScreen("menu");
        break;
    }
  }

  async function quit() {
    const ok = await showModal({ emoji: "", title: "Spiel abbrechen?", text: "Das laufende Spiel geht verloren.", ok: "Abbrechen", cancel: "Weiterspielen" });
    if (!ok) return;
    G = null;
    $("lu-score-overlay").hidden = true;
    showScreen("menu");
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("lu-local-start").addEventListener("click", start);
  });

  return { openSetup, handle, quit };
})();
