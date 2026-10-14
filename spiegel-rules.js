"use strict";

/* =========================================================
   SPIEGEL – Spielregeln und Wertung
   Wird vom Browser (Pass & Play) und vom Server (Online) benutzt,
   damit beide Modi exakt gleich werten.
   ========================================================= */
const SpiegelRules = (() => {
  const ROUNDS = 8;
  const JOKERS = 2;
  const TRAP_POINTS = { 1: 9, 2: 6, 3: 3 };

  function newGame(names, starter) {
    return {
      players: names.map((n, i) => ({
        id: "p" + i, name: n, starter: i === starter, connected: true,
        hand: [1, 2, 3, 4, 5, 6, 7, 8, 9], jokers: JOKERS, score: 0,
        trap: null, trapSet: false, trapState: "offen"
      })),
      phase: "setup", rounds: ROUNDS, round: 1, attacker: "p" + starter,
      step: "attack", move: null, history: [], lastResult: null, result: null
    };
  }

  const byId = (G, id) => G.players.find((p) => p.id === id);
  const other = (id) => (id === "p0" ? "p1" : "p0");

  function setTrap(G, id, card, from, to) {
    const p = byId(G, id);
    from = Math.max(1, Math.min(ROUNDS, from));
    to = Math.max(from, Math.min(ROUNDS, to, from + 2));
    p.trap = { card, from, to, points: TRAP_POINTS[to - from + 1] };
    p.trapSet = true;
    if (G.players.every((x) => x.trapSet)) G.phase = "play";
  }

  function attack(G, card, nums) {
    const att = byId(G, G.attacker);
    if (!att.hand.includes(card) || nums.length !== 3) return false;
    G.move = { card, nums: [...nums], claim: nums.includes(card) ? "truth" : "lie" };
    G.step = "defend";
    return true;
  }

  // Wertet eine Runde aus und gibt den Eintrag fürs Rundenlog zurück
  function defend(G, defense, defCard) {
    const att = byId(G, G.attacker);
    const def = byId(G, other(G.attacker));
    if (!def.hand.includes(defCard)) return null;
    const a = G.move.card;
    const d = defCard;
    const gain = { [att.id]: 0, [def.id]: 0 };
    const lines = [];

    // 1. Karten
    const diff = Math.abs(a - d);
    if (diff === 0) lines.push(`Gleiche Karten (${a}) – keine Punkte.`);
    else if (diff === 1) {
      const lo = a < d ? att : def;
      gain[lo.id] += a + d;
      lines.push(`Differenz 1: ${lo.name} gewinnt mit der niedrigeren Karte die Summe ${a + d}.`);
    } else {
      const hi = a > d ? att : def;
      gain[hi.id] += Math.max(a, d);
      lines.push(`${hi.name} gewinnt mit der höheren Karte ${Math.max(a, d)} Punkte.`);
    }

    // 2. Lüge und Lügenjoker
    const lie = G.move.claim === "lie";
    const useJoker = defense === "joker" && def.jokers > 0;
    const defHadJoker = def.jokers > 0;
    let exposed = false;
    if (useJoker) {
      def.jokers--;
      if (lie) {
        exposed = true;
        gain[def.id] += 2;
        lines.push(`Lügenjoker richtig: ${att.name} hat gelogen und bekommt in dieser Runde 0 Punkte. ${def.name} +2.`);
      } else {
        gain[def.id] -= 2;
        lines.push(`Lügenjoker falsch: ${att.name} hat die Wahrheit gesagt. ${def.name} −2.`);
      }
    } else if (lie) {
      if (defHadJoker) {
        gain[att.id] += 2;
        lines.push(`Unentdeckte Lüge: ${att.name} +2.`);
      } else {
        lines.push(`${att.name} hat gelogen – kein Bonus, weil ${def.name} keine Lügenjoker mehr hat.`);
      }
    }

    // 3. Fallen
    att.hand = att.hand.filter((c) => c !== a);
    def.hand = def.hand.filter((c) => c !== d);
    for (const owner of [att, def]) {
      const t = owner.trap;
      if (!t || owner.trapState !== "offen") continue;
      const played = owner === att ? d : a; // Karte des Gegners
      if (played === t.card) {
        if (G.round >= t.from && G.round <= t.to) {
          owner.trapState = "ausgelöst";
          gain[owner.id] += t.points;
          lines.push(`Falle von ${owner.name} ausgelöst: +${t.points}.`);
        } else {
          owner.trapState = "verpasst";
        }
      } else if (G.round >= t.to) {
        owner.trapState = "verpasst";
      }
    }

    // Entlarvter Lügner: alle Punkte dieser Runde fallen weg
    if (exposed) gain[att.id] = 0;

    att.score += gain[att.id];
    def.score += gain[def.id];
    const entry = { round: G.round, attacker: att.id, card: a, defCard: d, nums: G.move.nums, claim: G.move.claim, defense: useJoker ? "joker" : "believe", lines, gain };
    G.history.push(entry);
    G.lastResult = entry;
    G.step = "reveal";
    return entry;
  }

  function next(G) {
    if (G.round >= ROUNDS) return finish(G);
    G.round++;
    G.attacker = other(G.attacker);
    G.step = "attack";
    G.move = null;
  }

  function finish(G) {
    const notes = [];
    for (const p of G.players) {
      if (p.trapState === "offen") p.trapState = "verpasst";
      if (p.jokers > 0) {
        p.score -= p.jokers;
        notes.push(`${p.name} −${p.jokers} für ${p.jokers === 1 ? "einen ungenutzten Lügenjoker" : `${p.jokers} ungenutzte Lügenjoker`}`);
      }
    }
    const [x, y] = G.players;
    const winner = x.score > y.score ? x.id : y.score > x.score ? y.id : null;
    G.result = { winner, reason: notes.length ? notes.join(" · ") + "." : "Alle Lügenjoker wurden eingesetzt." };
    G.phase = "over";
    G.step = "reveal";
  }

  return { newGame, setTrap, attack, defend, next, finish, other, byId, ROUNDS };
})();

if (typeof module !== "undefined") module.exports = { SpiegelRules };
