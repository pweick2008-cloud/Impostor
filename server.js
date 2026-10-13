"use strict";

// Partyspiele – Online-Server (Verräter & Wer bin ich?)
// Liefert die Website aus und verwaltet Lobbys über WebSockets.
// Der Server kennt alle Rollen und den Begriff; jeder Spieler bekommt
// nur die Informationen, die er sehen darf.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { CATEGORIES } = require("./words.js");
const { shuffle, pick, normalize, isCorrectGuess, displayWord, pickWord } = require("./shared.js");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 3; // Verräter
const MIN_PLAYERS_BY_GAME = { verraeter: 3, werbinich: 2, luegen: 2 };
const MAX_PLAYERS_BY_GAME = { verraeter: 20, werbinich: 20, luegen: 2 };
const GAME_TYPES = ["verraeter", "werbinich", "luegen"];
const MAX_PLAYERS = 20;
const LOBBY_IDLE_MS = 30 * 60 * 1000; // leere Lobbys werden nach 30 Min. gelöscht
const DIFFICULTIES = ["leicht", "mittel", "schwer", "gemischt"];

/* =========================================================
   Statische Dateien
   ========================================================= */
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/online.js": ["online.js", "text/javascript; charset=utf-8"],
  "/shared.js": ["shared.js", "text/javascript; charset=utf-8"],
  "/words.js": ["words.js", "text/javascript; charset=utf-8"],
  "/wbi.js": ["wbi.js", "text/javascript; charset=utf-8"],
  "/wbi-online.js": ["wbi-online.js", "text/javascript; charset=utf-8"],
  "/luegen-online.js": ["luegen-online.js", "text/javascript; charset=utf-8"]
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  const entry = STATIC[url.pathname];
  if (!entry || req.method !== "GET") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nicht gefunden");
    return;
  }
  fs.readFile(path.join(__dirname, entry[0]), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "no-cache" });
    res.end(data);
  });
});

/* =========================================================
   Lobbys
   ========================================================= */
const lobbies = new Map();

function newId() {
  return crypto.randomBytes(6).toString("hex");
}

function newCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join("");
  } while (lobbies.has(code));
  return code;
}

function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function sanitizeSettings(input, playerCount) {
  const s = {
    category: CATEGORIES[input.category] || input.category === "zufall" ? input.category : "laender",
    difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : "leicht",
    impostors: Math.max(1, Math.floor(Number(input.impostors) || 1)),
    hint: input.hint !== false
  };
  s.impostors = Math.min(s.impostors, Math.max(1, Math.max(playerCount, MIN_PLAYERS) - 1));
  return s;
}

function connectedPlayers(lobby) {
  return lobby.players.filter((p) => p.connected);
}

function ensureHost(lobby) {
  const host = lobby.players.find((p) => p.id === lobby.hostId);
  if (host && host.connected) return;
  const next = connectedPlayers(lobby)[0] || lobby.players[0];
  if (next) lobby.hostId = next.id;
}

/* =========================================================
   Sichten pro Spieler (nur erlaubte Informationen!)
   ========================================================= */
function viewFor(lobby, me) {
  const g = lobby.game;
  const view = {
    type: "state",
    you: me.id,
    code: lobby.code,
    hostId: lobby.hostId,
    gameType: lobby.gameType,
    minPlayers: MIN_PLAYERS_BY_GAME[lobby.gameType],
    maxPlayers: MAX_PLAYERS_BY_GAME[lobby.gameType],
    settings: lobby.settings,
    players: lobby.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    game: null
  };
  if (!g) return view;
  if (g.type === "luegen") {
    view.game = luView(lobby, g, me);
    return view;
  }
  if (g.type === "werbinich") {
    view.game = wbiView(lobby, g, me);
    return view;
  }

  const over = g.phase === "over";
  const inGame = g.order.includes(me.id);
  const meImpostor = inGame && g.impostors.has(me.id);
  const categoryLabel = `${g.category.icon} ${g.category.name}`;

  view.game = {
    phase: g.phase,
    inGame,
    me: inGame
      ? {
          impostor: meImpostor,
          word: meImpostor ? null : g.word,
          category: meImpostor && !lobby.settings.hint ? null : categoryLabel,
          out: g.out.has(me.id)
        }
      : null,
    players: g.order.map((id) => {
      const p = lobby.players.find((x) => x.id === id);
      return {
        id,
        name: p ? p.name : g.names[id],
        connected: !!(p && p.connected),
        out: g.out.has(id),
        tips: g.tips[id],
        tipped: g.sinceVote.has(id),
        ready: g.ready.has(id),
        role: over ? (g.impostors.has(id) ? "impostor" : "crew") : null,
        result: over ? g.results[id] || null : null
      };
    }),
    turnId: g.phase === "play" ? g.order[g.turn] : null,
    voteUnlocked: g.voteUnlocked,
    voteReady: g.phase === "play" && voteReady(g),
    tipsUntilVote: g.phase === "play" ? activeIds(g).filter((id) => !g.sinceVote.has(id)).length : 0,
    vote: g.vote
      ? {
          voters: g.vote.voters,
          voted: [...g.vote.ballots.keys()],
          myBallot: g.vote.ballots.has(me.id) ? g.vote.ballots.get(me.id) || "abstain" : null,
          startedBy: g.vote.startedBy
        }
      : null,
    impostorsLeft: activeIds(g).filter((id) => g.impostors.has(id)).length,
    log: g.log,
    result: over ? { winner: g.winner, reason: g.reason, word: g.word, category: categoryLabel } : null
  };
  return view;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastState(lobby) {
  for (const p of lobby.players) if (p.ws) send(p.ws, viewFor(lobby, p));
}

function broadcastEvent(lobby, event) {
  for (const p of lobby.players) if (p.ws) send(p.ws, { type: "event", ...event });
}

/* =========================================================
   Spiellogik
   ========================================================= */
const activeIds = (g) => g.order.filter((id) => !g.out.has(id));
const voteReady = (g) => activeIds(g).every((id) => g.sinceVote.has(id));

function nextActiveFrom(g, idx) {
  const n = g.order.length;
  for (let i = 1; i <= n; i++) {
    const j = (idx + i) % n;
    if (!g.out.has(g.order[j])) return j;
  }
  return idx;
}

function fixTurn(g) {
  if (g.out.has(g.order[g.turn])) g.turn = nextActiveFrom(g, g.turn);
}

function nameOf(lobby, id) {
  return lobby.game.names[id];
}

function startGame(lobby) {
  const players = lobby.players.slice();
  const settings = sanitizeSettings(lobby.settings, players.length);
  lobby.settings = settings;

  const { catId, category, entry } = pickWord(CATEGORIES, settings.category, settings.difficulty, lobby.usedWords);
  lobby.usedWords = [...lobby.usedWords.filter((w) => w !== entry), entry].slice(-150);

  const ids = players.map((p) => p.id);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  lobby.game = {
    type: "verraeter",
    phase: "reveal",
    entry,
    word: displayWord(entry),
    categoryId: catId,
    category,
    order: ids, // Sitzreihenfolge = Reihenfolge in der Lobby
    names,
    impostors: new Set(shuffle(ids).slice(0, settings.impostors)),
    out: new Set(),
    results: {},
    tips: Object.fromEntries(ids.map((id) => [id, []])),
    ready: new Set(),
    turn: 0,
    sinceVote: new Set(),
    voteUnlocked: false,
    vote: null,
    log: [],
    winner: null,
    reason: ""
  };
}

function startPlay(lobby) {
  const g = lobby.game;
  g.phase = "play";
  g.turn = Math.floor(Math.random() * g.order.length);
  fixTurn(g);
  g.log.push(`${nameOf(lobby, g.order[g.turn])} beginnt mit dem ersten Tipp.`);
}

function endGame(lobby, winner, reason) {
  const g = lobby.game;
  g.phase = "over";
  g.vote = null;
  g.winner = winner;
  g.reason = reason;
  for (const id of g.impostors) if (!g.results[id]) g.results[id] = "nicht enttarnt";
}

// Prüft nach einem Ausscheiden, ob das Spiel vorbei ist.
function checkImpostorsGone(lobby, reason) {
  const g = lobby.game;
  if (activeIds(g).some((id) => g.impostors.has(id))) return false;
  endGame(lobby, "crew", reason);
  return true;
}

function finishVote(lobby) {
  const g = lobby.game;
  const v = g.vote;
  const counts = new Map();
  let abstentions = 0;
  for (const id of v.voters) {
    const target = v.ballots.get(id);
    if (!target) abstentions++; // nicht abgestimmt zählt als Enthaltung
    else counts.set(target, (counts.get(target) || 0) + 1);
  }
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranking.length ? ranking[0][1] : 0;
  const leaders = ranking.filter(([, c]) => c === top);
  const eliminated = top > 0 && leaders.length === 1 && top > abstentions ? leaders[0][0] : null;

  const tally = ranking.map(([id, c]) => `${nameOf(lobby, id)}: ${c} ${c === 1 ? "Stimme" : "Stimmen"}`);
  if (abstentions) tally.push(`Enthaltungen: ${abstentions}`);

  g.vote = null;
  g.sinceVote = new Set(); // nach einem Vote muss wieder jeder einen Tipp abgeben

  if (!eliminated) {
    g.log.push("Vote: niemand ist ausgeschieden.");
    broadcastEvent(lobby, {
      emoji: "🤷",
      title: "Niemand scheidet aus",
      text: top === 0 ? "Alle haben sich enthalten." : leaders.length > 1 ? "Gleichstand – keine Entscheidung." : "Die Enthaltungen überwiegen.",
      tally
    });
    return;
  }

  const name = nameOf(lobby, eliminated);
  g.out.add(eliminated);
  if (!g.impostors.has(eliminated)) {
    g.results[eliminated] = "rausgewählt (war unschuldig)";
    g.log.push(`Vote: ${name} wurde rausgewählt – war KEIN Verräter.`);
    broadcastEvent(lobby, { emoji: "😱", title: `${name} war unschuldig!`, text: `${name} war kein Verräter.`, tally });
    endGame(lobby, "impostor", `${name} war unschuldig und wurde rausgewählt.`);
    return;
  }

  g.results[eliminated] = "rausgewählt";
  g.log.push(`Vote: ${name} wurde rausgewählt – war ein Verräter!`);
  if (!checkImpostorsGone(lobby, "Alle Verräter wurden enttarnt.")) {
    broadcastEvent(lobby, {
      emoji: "🎯",
      title: `${name} war ein Verräter!`,
      text: `${name} ist raus. Es sind noch Verräter im Spiel.`,
      tally
    });
    fixTurn(g);
  } else {
    broadcastEvent(lobby, { emoji: "🎯", title: `${name} war ein Verräter!`, text: `${name} ist raus.`, tally });
  }
}

// Spieler verlässt eine laufende Partie endgültig
function dropFromGame(lobby, id) {
  const g = lobby.game;
  if (g && g.type === "werbinich") return wbiDrop(lobby, id);
  if (g && g.type === "luegen") return luDrop(lobby, id);
  if (!g || g.phase === "over" || !g.order.includes(id) || g.out.has(id)) return;
  g.out.add(id);
  g.results[id] = "hat das Spiel verlassen";
  g.ready.delete(id);
  g.log.push(`${nameOf(lobby, id)} hat das Spiel verlassen.`);
  if (g.vote) {
    g.vote.voters = g.vote.voters.filter((v) => v !== id);
    g.vote.ballots.delete(id);
    for (const [voter, target] of g.vote.ballots) if (target === id) g.vote.ballots.set(voter, null);
  }
  if (checkImpostorsGone(lobby, "Kein Verräter ist mehr im Spiel.")) return;
  if (activeIds(g).filter((x) => !g.impostors.has(x)).length === 0) {
    endGame(lobby, "impostor", "Es sind keine normalen Spieler mehr übrig.");
    return;
  }
  if (g.phase === "reveal" && activeIds(g).every((x) => g.ready.has(x))) startPlay(lobby);
  if (g.phase === "play") {
    fixTurn(g);
    if (g.vote && g.vote.voters.every((v) => g.vote.ballots.has(v))) finishVote(lobby);
  }
}

function removePlayer(lobby, player) {
  dropFromGame(lobby, player.id);
  lobby.players = lobby.players.filter((p) => p !== player);
  if (player.ws) player.ws.ctx = null;
  if (lobby.players.length === 0) {
    lobbies.delete(lobby.code);
    return;
  }
  if (lobby.hostId === player.id) lobby.hostId = null;
  ensureHost(lobby);
  if (!lobby.game) lobby.settings = sanitizeSettings(lobby.settings, lobby.players.length);
}

/* =========================================================
   Nachrichten der Spieler
   ========================================================= */
class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

function attach(ws, lobby, player) {
  if (player.ws && player.ws !== ws) {
    send(player.ws, { type: "kicked", message: "Du hast dich auf einem anderen Gerät oder Tab verbunden." });
    player.ws.ctx = null;
  }
  if (ws.ctx && ws.ctx.player !== player) {
    const old = ws.ctx;
    old.player.ws = null;
    old.player.connected = false;
  }
  player.ws = ws;
  player.connected = true;
  ws.ctx = { lobby, player };
  ensureHost(lobby);
}

const handlers = {
  create(ws, msg) {
    const name = cleanName(msg.name);
    if (!normalize(name)) fail("Bitte gib einen Namen ein.");
    leaveCurrent(ws);
    const lobby = {
      code: newCode(),
      gameType: GAME_TYPES.includes(msg.gameType) ? msg.gameType : "verraeter",
      hostId: null,
      players: [],
      settings: sanitizeSettings({ ...(msg.settings || {}) }, 1),
      game: null,
      usedWords: [],
      emptySince: null
    };
    const player = { id: newId(), token: String(msg.token || newId()), name, key: normalize(name), ws: null, connected: false };
    lobby.players.push(player);
    lobby.hostId = player.id;
    lobbies.set(lobby.code, lobby);
    attach(ws, lobby, player);
    return lobby;
  },

  join(ws, msg) {
    const code = String(msg.code || "").trim().toUpperCase();
    const lobby = lobbies.get(code);
    if (!lobby) fail(`Die Lobby „${code}“ gibt es nicht (mehr).`);
    const token = String(msg.token || "");

    // Wiederverbinden mit demselben Gerät/Tab
    const existing = token && lobby.players.find((p) => p.token === token);
    if (existing) {
      attach(ws, lobby, existing);
      lobby.emptySince = null;
      return lobby;
    }

    const name = cleanName(msg.name);
    if (!normalize(name)) fail("Bitte gib einen Namen ein.");
    if (lobby.game && lobby.game.phase !== "over") fail("Das Spiel läuft gerade. Tritt bei, sobald die Runde vorbei ist.");
    if (lobby.players.length >= MAX_PLAYERS_BY_GAME[lobby.gameType]) {
      fail(lobby.gameType === "luegen" ? "Die Lobby ist voll – Lügenduell spielt man zu zweit." : "Die Lobby ist voll.");
    }
    if (lobby.players.some((p) => p.key === normalize(name))) fail(`Der Name „${name}“ ist in dieser Lobby schon vergeben.`);

    leaveCurrent(ws);
    const player = { id: newId(), token: token || newId(), name, key: normalize(name), ws: null, connected: false };
    lobby.players.push(player);
    lobby.emptySince = null;
    attach(ws, lobby, player);
    return lobby;
  },

  leave(ws) {
    const lobby = ws.ctx && ws.ctx.lobby;
    leaveCurrent(ws);
    send(ws, { type: "left" });
    return lobby && lobbies.has(lobby.code) ? lobby : null;
  },

  settings(ws, msg, lobby, me) {
    requireHost(lobby, me);
    if (lobby.game && lobby.game.phase !== "over") fail("Während des Spiels können die Einstellungen nicht geändert werden.");
    lobby.settings = sanitizeSettings({ ...lobby.settings, ...msg.settings }, lobby.players.length);
    return lobby;
  },

  kick(ws, msg, lobby, me) {
    requireHost(lobby, me);
    if (lobby.game && lobby.game.phase !== "over") fail("Während des Spiels kann niemand entfernt werden.");
    const target = lobby.players.find((p) => p.id === msg.playerId);
    if (!target || target === me) return lobby;
    send(target.ws, { type: "kicked", message: "Du wurdest vom Host aus der Lobby entfernt." });
    removePlayer(lobby, target);
    return lobby;
  },

  start(ws, msg, lobby, me) {
    requireHost(lobby, me);
    if (lobby.game && lobby.game.phase !== "over") fail("Das Spiel läuft bereits.");
    const min = MIN_PLAYERS_BY_GAME[lobby.gameType];
    if (lobby.players.length < min) fail(`Ihr braucht mindestens ${min} Spieler.`);
    if (lobby.players.length > MAX_PLAYERS_BY_GAME[lobby.gameType]) fail("Zu viele Spieler für dieses Spiel.");
    if (lobby.gameType === "luegen") luStart(lobby);
    else if (lobby.gameType === "werbinich") wbiStart(lobby);
    else startGame(lobby);
    return lobby;
  },

  ready(ws, msg, lobby, me) {
    const g = requireGame(lobby, "reveal");
    if (!g.order.includes(me.id)) return lobby;
    g.ready.add(me.id);
    if (activeIds(g).every((id) => g.ready.has(id))) startPlay(lobby);
    return lobby;
  },

  forcePlay(ws, msg, lobby, me) {
    requireHost(lobby, me);
    requireGame(lobby, "reveal");
    startPlay(lobby);
    return lobby;
  },

  tip(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play");
    if (g.vote) fail("Während einer Abstimmung können keine Tipps abgegeben werden.");
    if (g.order[g.turn] !== me.id) fail("Du bist gerade nicht dran.");
    const text = String(msg.text || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!text) fail("Bitte gib einen Tipp ein.");
    const wasReady = voteReady(g);
    g.tips[me.id].push(text);
    g.sinceVote.add(me.id);
    g.turn = nextActiveFrom(g, g.turn);
    if (!wasReady && voteReady(g)) {
      g.voteUnlocked = true;
      g.log.push("Runde komplett – ein Vote ist jetzt möglich.");
    }
    return lobby;
  },

  skipTurn(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "play");
    if (g.vote) fail("Erst die Abstimmung beenden.");
    const skipped = g.order[g.turn];
    const wasReady = voteReady(g);
    g.sinceVote.add(skipped);
    g.turn = nextActiveFrom(g, g.turn);
    g.log.push(`${nameOf(lobby, skipped)} wurde übersprungen.`);
    if (!wasReady && voteReady(g)) {
      g.voteUnlocked = true;
      g.log.push("Runde komplett – ein Vote ist jetzt möglich.");
    }
    return lobby;
  },

  startVote(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play");
    if (!activeIds(g).includes(me.id)) fail("Ausgeschiedene Spieler können keinen Vote starten.");
    if (g.vote) fail("Es läuft bereits eine Abstimmung.");
    if (!voteReady(g)) fail("Erst muss jeder einen Tipp abgeben.");
    g.vote = { voters: activeIds(g), ballots: new Map(), startedBy: me.id };
    g.log.push(`${me.name} hat einen Vote gestartet.`);
    broadcastEvent(lobby, { emoji: "🗳️", title: "Abstimmung!", text: `${me.name} hat einen Vote gestartet. Wähle einen Spieler oder enthalte dich.`, silent: true });
    return lobby;
  },

  ballot(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play");
    const v = g.vote;
    if (!v) fail("Es läuft keine Abstimmung.");
    if (!v.voters.includes(me.id)) fail("Du darfst bei dieser Abstimmung nicht mitstimmen.");
    if (v.ballots.has(me.id)) fail("Du hast schon abgestimmt.");
    const target = msg.target || null;
    if (target && (target === me.id || !activeIds(g).includes(target))) fail("Ungültige Stimme.");
    v.ballots.set(me.id, target);
    if (v.voters.every((id) => v.ballots.has(id))) finishVote(lobby);
    return lobby;
  },

  finishVote(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "play");
    if (!g.vote) fail("Es läuft keine Abstimmung.");
    finishVote(lobby);
    return lobby;
  },

  cancelVote(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "play");
    if (!g.vote) return lobby;
    g.vote = null; // abgebrochen → Vote nicht verbraucht
    g.log.push("Der Host hat die Abstimmung abgebrochen.");
    return lobby;
  },

  guess(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play");
    if (!activeIds(g).includes(me.id) || !g.impostors.has(me.id)) fail("Nur Verräter dürfen den Begriff raten.");
    const guess = String(msg.word || "").trim();
    if (!guess) fail("Bitte gib einen Begriff ein.");

    const correct = isCorrectGuess(guess, g.entry, !!g.category.person);
    const wasLast = activeIds(g).filter((id) => g.impostors.has(id)).length === 1;
    g.out.add(me.id);
    g.results[me.id] = correct ? "hat den Begriff erraten 🏆" : "hat falsch geraten";
    if (g.vote) {
      g.vote.voters = g.vote.voters.filter((v) => v !== me.id);
      g.vote.ballots.delete(me.id);
      for (const [voter, target] of g.vote.ballots) if (target === me.id) g.vote.ballots.set(voter, null);
    }

    if (wasLast) {
      g.log.push(`${me.name} hat ${correct ? "richtig" : "falsch"} geraten.`);
      endGame(lobby, correct ? "impostor" : "crew", correct ? `${me.name} hat den Begriff erraten!` : `${me.name} hat den Begriff falsch geraten.`);
      return lobby;
    }

    // Mehrere Verräter: persönlicher Sieg/Niederlage, Begriff bleibt geheim
    g.log.push(`${me.name} hat ${correct ? "richtig" : "falsch"} geraten und ist ausgeschieden.`);
    broadcastEvent(lobby, {
      emoji: correct ? "🏆" : "💥",
      title: correct ? `${me.name} hat richtig geraten!` : `${me.name} lag falsch!`,
      text: `${me.name} war Verräter, ${correct ? "gewinnt persönlich" : "hat verloren"} und ist ausgeschieden. Der Begriff bleibt geheim.`
    });
    fixTurn(g);
    if (g.vote && g.vote.voters.every((id) => g.vote.ballots.has(id))) finishVote(lobby);
    return lobby;
  },

  endGame(ws, msg, lobby, me) {
    requireHost(lobby, me);
    lobby.game = null; // zurück in die Lobby
    lobby.settings = sanitizeSettings(lobby.settings, lobby.players.length);
    return lobby;
  }
};

function requireHost(lobby, me) {
  if (lobby.hostId !== me.id) fail("Das darf nur der Host.");
}

function requireGame(lobby, phase, type = "verraeter") {
  const g = lobby.game;
  if (!g || g.type !== type || g.phase !== phase) fail("Das geht gerade nicht.");
  return g;
}

function leaveCurrent(ws) {
  if (!ws.ctx) return;
  const { lobby, player } = ws.ctx;
  ws.ctx = null;
  player.ws = null;
  removePlayer(lobby, player);
  if (lobbies.has(lobby.code)) broadcastState(lobby);
}


/* =========================================================
   Wer bin ich? – Online
   Jeder denkt sich eine Person für einen anderen Spieler aus. Danach sieht
   jeder die Personen aller anderen, nur die eigene nicht. Wer dran ist,
   schreibt eine Ja/Nein-Frage; die anderen stimmen mit Ja, Nein oder
   Enthaltung ab. Bei „Ja“ darf man weiterfragen, sonst ist der Nächste dran.
   ========================================================= */
function randomPerson(exclude = []) {
  const pool = ["promis", "geschichte", "streamer"]
    .flatMap((id) => Object.values(CATEGORIES[id].words).flat())
    .map(displayWord);
  const taken = new Set(exclude.map(normalize));
  const free = pool.filter((p) => !taken.has(normalize(p)));
  return pick(free.length ? free : pool);
}

const wbiInGame = (g) => g.order.filter((id) => !g.left.has(id));
const wbiUnsolved = (g) => wbiInGame(g).filter((id) => !g.ranks[id]);

function wbiStart(lobby) {
  const ids = shuffle(lobby.players.map((p) => p.id));
  lobby.game = {
    type: "werbinich",
    phase: "assign",
    order: ids,
    names: Object.fromEntries(lobby.players.map((p) => [p.id, p.name])),
    // Jeder denkt sich eine Person für den Nächsten im Kreis aus
    targetOf: Object.fromEntries(ids.map((id, i) => [id, ids[(i + 1) % ids.length]])),
    terms: {}, // Ziel-ID → Person
    ranks: {},
    solvedCount: 0,
    left: new Set(),
    turn: 0,
    question: null,
    history: Object.fromEntries(ids.map((id) => [id, []])),
    log: []
  };
}

function wbiView(lobby, g, me) {
  const over = g.phase === "over";
  const writerOf = Object.fromEntries(Object.entries(g.targetOf).map(([w, t]) => [t, w]));
  const q = g.question;
  const myTarget = g.targetOf[me.id];
  return {
    type: "werbinich",
    phase: g.phase,
    inGame: g.order.includes(me.id),
    players: g.order.map((id) => {
      const p = lobby.players.find((x) => x.id === id);
      return {
        id,
        name: g.names[id],
        connected: !!(p && p.connected),
        left: g.left.has(id),
        rank: g.ranks[id] || null,
        // Die eigene Person bleibt bis zum Spielende geheim
        term: id !== me.id || over || g.ranks[id] ? g.terms[id] || null : null,
        termBy: g.names[writerOf[id]] || null,
        assignDone: !!g.terms[g.targetOf[id]] || g.left.has(id),
        history: g.history[id]
      };
    }),
    myTarget: g.phase === "assign" && myTarget
      ? { id: myTarget, name: g.names[myTarget], term: g.terms[myTarget] || "" }
      : null,
    turnId: g.phase === "play" ? g.order[g.turn] : null,
    question: q
      ? {
          asker: q.asker,
          text: q.text,
          voters: q.voters.length,
          answered: q.answers.size,
          canAnswer: q.voters.includes(me.id),
          myAnswer: q.answers.get(me.id) || null
        }
      : null,
    log: g.log
  };
}

function wbiNextTurn(g) {
  const n = g.order.length;
  for (let i = 1; i <= n; i++) {
    const j = (g.turn + i) % n;
    const id = g.order[j];
    if (!g.left.has(id) && !g.ranks[id]) {
      g.turn = j;
      return;
    }
  }
}

function wbiFixTurn(g) {
  const id = g.order[g.turn];
  if (g.left.has(id) || g.ranks[id]) wbiNextTurn(g);
}

function wbiCheckAssignDone(lobby) {
  const g = lobby.game;
  if (wbiInGame(g).every((id) => g.terms[id])) {
    g.phase = "play";
    g.turn = 0;
    wbiFixTurn(g);
    g.log.push(`Alle Personen sind vergeben. ${g.names[g.order[g.turn]]} beginnt.`);
  }
}

// Ist höchstens noch einer übrig, ist das Spiel vorbei.
function wbiCheckEnd(lobby) {
  const g = lobby.game;
  if (wbiUnsolved(g).length > 1) return false;
  g.phase = "over";
  g.question = null;
  return true;
}

function wbiResolve(lobby) {
  const g = lobby.game;
  const q = g.question;
  let yes = 0;
  let no = 0;
  for (const a of q.answers.values()) {
    if (a === "yes") yes++;
    else if (a === "no") no++; // Enthaltungen zählen nicht
  }
  const isYes = yes > no;
  g.history[q.asker].push({ q: q.text, a: isYes ? "Ja" : "Nein", yes, no });
  g.log.push(`${g.names[q.asker]}: „${q.text}“ → ${isYes ? "Ja" : "Nein"} (${yes}:${no})`);
  g.question = null;
  broadcastEvent(lobby, {
    toast: true,
    text: `„${q.text}“ → ${isYes ? "👍 Ja" : "👎 Nein"} (${yes}:${no})` +
      (isYes ? ` – ${g.names[q.asker]} darf weiterfragen.` : "")
  });
  if (!isYes) wbiNextTurn(g);
}

function wbiDrop(lobby, id) {
  const g = lobby.game;
  if (g.phase === "over" || !g.order.includes(id) || g.left.has(id)) return;
  g.left.add(id);
  g.log.push(`${g.names[id]} hat das Spiel verlassen.`);

  if (g.phase === "assign") {
    // Wer für den Gehenden schreiben sollte, braucht keine Person mehr; fehlt dem
    // Ziel des Gehenden noch eine Person, wird sie zufällig vergeben.
    const target = g.targetOf[id];
    if (!g.terms[target]) g.terms[target] = randomPerson(Object.values(g.terms));
    if (!wbiCheckEnd(lobby)) wbiCheckAssignDone(lobby);
    return;
  }

  const q = g.question;
  if (q) {
    if (q.asker === id) g.question = null;
    else {
      q.voters = q.voters.filter((v) => v !== id);
      q.answers.delete(id);
    }
  }
  if (wbiCheckEnd(lobby)) return;
  wbiFixTurn(g);
  if (g.question && g.question.voters.every((v) => g.question.answers.has(v))) wbiResolve(lobby);
}

function wbiRequireTurn(g, me) {
  if (g.order[g.turn] !== me.id) fail("Du bist gerade nicht dran.");
}

Object.assign(handlers, {
  wbiTerm(ws, msg, lobby, me) {
    const g = requireGame(lobby, "assign", "werbinich");
    if (!g.order.includes(me.id) || g.left.has(me.id)) fail("Du spielst in dieser Runde nicht mit.");
    const text = String(msg.text || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!normalize(text)) fail("Bitte gib eine Person ein.");
    g.terms[g.targetOf[me.id]] = text;
    wbiCheckAssignDone(lobby);
    return lobby;
  },

  wbiFill(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "assign", "werbinich");
    for (const id of wbiInGame(g)) {
      if (!g.terms[id]) g.terms[id] = randomPerson(Object.values(g.terms));
    }
    g.log.push("Der Host hat fehlende Personen zufällig vergeben.");
    wbiCheckAssignDone(lobby);
    return lobby;
  },

  wbiAsk(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "werbinich");
    wbiRequireTurn(g, me);
    if (g.question) fail("Über deine Frage wird gerade abgestimmt.");
    const text = String(msg.text || "").trim().replace(/\s+/g, " ").slice(0, 140);
    if (!normalize(text)) fail("Bitte schreib eine Frage.");
    const voters = wbiInGame(g).filter((id) => id !== me.id);
    g.question = { asker: me.id, text, voters, answers: new Map() };
    return lobby;
  },

  wbiAnswer(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "werbinich");
    const q = g.question;
    if (!q) fail("Gerade gibt es keine Frage.");
    if (!q.voters.includes(me.id)) fail("Du kannst bei dieser Frage nicht abstimmen.");
    if (q.answers.has(me.id)) fail("Du hast schon abgestimmt.");
    if (!["yes", "no", "abstain"].includes(msg.answer)) fail("Ungültige Antwort.");
    q.answers.set(me.id, msg.answer);
    if (q.voters.every((id) => q.answers.has(id))) wbiResolve(lobby);
    return lobby;
  },

  wbiResolve(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "play", "werbinich");
    if (!g.question) fail("Gerade gibt es keine Frage.");
    wbiResolve(lobby);
    return lobby;
  },

  wbiGuess(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "werbinich");
    wbiRequireTurn(g, me);
    if (g.question) fail("Warte, bis über deine Frage abgestimmt wurde.");
    const text = String(msg.text || "").trim().slice(0, 40);
    if (!normalize(text)) fail("Bitte gib eine Person ein.");

    const term = g.terms[me.id];
    if (isCorrectGuess(text, term, true)) {
      g.ranks[me.id] = ++g.solvedCount;
      g.log.push(`${me.name} hat es erraten: ${term} (Platz ${g.ranks[me.id]})`);
      broadcastEvent(lobby, { emoji: "🎉", title: `${me.name} hat es erraten!`, text: `${me.name} ist ${term} – Platz ${g.ranks[me.id]}!` });
      if (!wbiCheckEnd(lobby)) wbiNextTurn(g);
    } else {
      g.log.push(`${me.name} hat „${text}“ geraten – falsch.`);
      broadcastEvent(lobby, { toast: true, text: `❌ ${me.name} hat „${text}“ geraten – falsch.` });
      wbiNextTurn(g);
    }
    return lobby;
  },

  wbiSkip(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "play", "werbinich");
    const skipped = g.order[g.turn];
    g.question = null;
    wbiNextTurn(g);
    g.log.push(`${g.names[skipped]} wurde übersprungen.`);
    return lobby;
  }
});


/* =========================================================
   Lügenduell – nur online, genau 2 Spieler
   - Jeder hat die Karten 1–9, einen Fallenjoker und Lügnerjoker
     (wer beginnt: 2, der andere: 3).
   - Vor Spielbeginn stellt jeder eine Falle: eine Karte des Gegners und
     eine Rundenspanne von höchstens 3 Runden.
   - 9 Runden, die Rollen wechseln jede Runde. Der Angreifer legt verdeckt
     eine Karte, macht dazu eine Aussage, die auf 3 Zahlen einschränkt, und
     legt fest, ob sie wahr oder gelogen ist. Der Verteidiger glaubt ihr
     oder nicht (optional mit Lügnerjoker) und legt dann seine Karte.
   ========================================================= */
const LU_ROUNDS = 9;
const LU_TRAP_POINTS = { 1: 9, 2: 6, 3: 3 }; // Spanne → Punkte

function luStart(lobby) {
  const ids = lobby.players.map((p) => p.id);
  const starter = pick(ids);
  const other = ids.find((id) => id !== starter);
  const g = {
    type: "luegen",
    phase: "setup", // setup → play → over
    ids: [starter, other], // Runde 1 greift der Startspieler an, danach abwechselnd
    names: Object.fromEntries(lobby.players.map((p) => [p.id, p.name])),
    starter,
    jokers: { [starter]: 2, [other]: 3 },
    hand: { [starter]: [1, 2, 3, 4, 5, 6, 7, 8, 9], [other]: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    trap: { [starter]: null, [other]: null },
    trapState: { [starter]: "offen", [other]: "offen" }, // offen | ausgelöst | verpasst
    score: { [starter]: 0, [other]: 0 },
    round: 1,
    step: "attack", // attack → defend → reveal
    move: null,
    ready: new Set(),
    history: [],
    log: [],
    result: null
  };
  lobby.game = g;
}

const luAttacker = (g) => g.ids[(g.round - 1) % 2];
const luDefender = (g) => g.ids[g.round % 2];
const luOpp = (g, id) => g.ids.find((x) => x !== id);

function luView(lobby, g, me) {
  const over = g.phase === "over";
  const inGame = g.ids.includes(me.id);
  const opp = inGame ? luOpp(g, me.id) : null;
  const m = g.move;
  const attacker = luAttacker(g);
  const players = g.ids.map((id) => {
    const p = lobby.players.find((x) => x.id === id);
    const own = id === me.id;
    const trap = g.trap[id];
    const showTrap = own || over || g.trapState[id] !== "offen";
    return {
      id,
      name: g.names[id],
      connected: !!(p && p.connected),
      score: g.score[id],
      jokers: g.jokers[id],
      hand: g.hand[id], // gespielte Karten sind ohnehin aufgedeckt
      trapSet: !!trap,
      trap: showTrap && trap ? { ...trap, points: LU_TRAP_POINTS[trap.to - trap.from + 1] } : null,
      trapState: g.trapState[id],
      starter: id === g.starter
    };
  });

  let move = null;
  if (m) {
    const iAmAttacker = me.id === attacker;
    const revealed = g.step === "reveal";
    move = {
      text: m.text,
      nums: m.nums,
      // Karte und Wahrheit/Lüge sieht der Verteidiger erst nach dem Aufdecken
      card: iAmAttacker || revealed ? m.card : null,
      claim: iAmAttacker || revealed ? m.claim : null,
      defense: revealed || me.id !== attacker ? m.defense || null : m.defense ? "done" : null,
      defCard: revealed || me.id !== attacker ? m.defCard || null : null
    };
  }

  return {
    type: "luegen",
    phase: g.phase,
    inGame,
    you: me.id,
    opp,
    players,
    round: g.round,
    rounds: LU_ROUNDS,
    step: g.step,
    attacker,
    defender: luDefender(g),
    move,
    lastResult: g.step === "reveal" ? g.history[g.history.length - 1] : null,
    ready: [...g.ready],
    history: g.history,
    log: g.log,
    result: g.result
  };
}

function luResolve(lobby) {
  const g = lobby.game;
  const m = g.move;
  const att = luAttacker(g);
  const def = luDefender(g);
  const a = m.card;
  const d = m.defCard;
  const lines = [];

  // Kartenvergleich
  let winner = null;
  let pts = 0;
  const diff = Math.abs(a - d);
  if (diff >= 2) {
    winner = a > d ? att : def;
    pts = Math.max(a, d);
    lines.push(`${g.names[winner]} gewinnt mit der höheren Karte (Differenz ${diff}) und bekommt ${pts} Punkte.`);
  } else if (diff === 1) {
    winner = a < d ? att : def;
    pts = a + d;
    lines.push(`Differenz 1: ${g.names[winner]} gewinnt mit der niedrigeren Karte und bekommt die Summe ${pts} Punkte.`);
  } else {
    lines.push("Beide haben die gleiche Karte gelegt – keine Punkte.");
  }

  let attGain = winner === att ? pts : 0;
  let defGain = winner === def ? pts : 0;
  const lied = m.claim === "lie";
  const jokersBefore = g.jokers[def];

  if (m.defense === "joker") {
    g.jokers[def]--;
    if (lied) {
      defGain += 2;
      if (attGain) lines.push(`Lügnerjoker richtig! ${g.names[att]} hat gelogen und verliert ${attGain} Punkte, ${g.names[def]} bekommt 2 Punkte.`);
      else lines.push(`Lügnerjoker richtig! ${g.names[att]} hat gelogen, ${g.names[def]} bekommt 2 Punkte.`);
      attGain = 0;
    } else {
      defGain += 1;
      lines.push(`Lügnerjoker daneben – ${g.names[att]} hat die Wahrheit gesagt. ${g.names[def]} bekommt trotzdem 1 Punkt.`);
    }
  } else if (lied) {
    if (jokersBefore > 0) {
      attGain += 2;
      lines.push(`${g.names[att]} hat erfolgreich gelogen: +2 Punkte.`);
    } else {
      lines.push(`${g.names[att]} hat gelogen – das bringt nichts mehr, weil ${g.names[def]} keine Lügnerjoker mehr hat.`);
    }
  }

  // Fallen: Spielt der Gegner die Fallenkarte in der Spanne, gibt es Punkte
  const trapGain = { [att]: 0, [def]: 0 };
  for (const owner of g.ids) {
    const trap = g.trap[owner];
    if (!trap || g.trapState[owner] !== "offen") continue;
    const victim = luOpp(g, owner);
    const played = victim === att ? a : d;
    if (played !== trap.card) continue;
    if (g.round >= trap.from && g.round <= trap.to) {
      const p = LU_TRAP_POINTS[trap.to - trap.from + 1];
      trapGain[owner] = p;
      g.trapState[owner] = "ausgelöst";
      lines.push(`🪤 Falle! ${g.names[victim]} hat die ${trap.card} in Runde ${g.round} gespielt – ${g.names[owner]} bekommt ${p} Punkte.`);
    } else {
      g.trapState[owner] = "verpasst"; // Karte ist weg, die Falle kann nicht mehr zuschnappen
    }
  }

  const gain = { [att]: attGain + trapGain[att], [def]: defGain + trapGain[def] };
  g.score[att] += gain[att];
  g.score[def] += gain[def];

  g.history.push({
    round: g.round,
    attacker: att,
    text: m.text,
    nums: m.nums,
    claim: m.claim,
    card: a,
    defense: m.defense,
    defCard: d,
    gain,
    lines
  });
  g.log.push(`Runde ${g.round}: ${g.names[att]} ${a} – ${d} ${g.names[def]} (${gain[att]}:${gain[def]})`);
  g.step = "reveal";
  g.ready = new Set();
}

function luFinish(lobby, reason) {
  const g = lobby.game;
  const [x, y] = g.ids;
  const winner = g.score[x] === g.score[y] ? null : g.score[x] > g.score[y] ? x : y;
  // Fallen, die nie ausgelöst wurden, gelten als verpasst
  for (const id of g.ids) if (g.trapState[id] === "offen") g.trapState[id] = "verpasst";
  g.result = { winner, reason: reason || (winner ? `${g.names[winner]} gewinnt mit ${g.score[winner]} Punkten!` : "Unentschieden!") };
  g.phase = "over";
  g.move = null;
}

function luDrop(lobby, id) {
  const g = lobby.game;
  if (g.phase === "over" || !g.ids.includes(id)) return;
  const opp = luOpp(g, id);
  g.log.push(`${g.names[id]} hat das Spiel verlassen.`);
  luFinish(lobby);
  g.result = { winner: opp, reason: `${g.names[id]} hat das Spiel verlassen – ${g.names[opp]} gewinnt.` };
}

function luInt(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail("Ungültige Zahl.");
  return n;
}

Object.assign(handlers, {
  luTrap(ws, msg, lobby, me) {
    const g = requireGame(lobby, "setup", "luegen");
    if (!g.ids.includes(me.id)) fail("Du spielst nicht mit.");
    const card = luInt(msg.card, 1, 9);
    const from = luInt(msg.from, 1, LU_ROUNDS);
    const to = luInt(msg.to, 1, LU_ROUNDS);
    if (to < from) fail("Die Spanne muss mit der kleineren Runde beginnen.");
    if (to - from + 1 > 3) fail("Die Spanne darf höchstens 3 Runden lang sein.");
    g.trap[me.id] = { card, from, to };
    if (g.ids.every((id) => g.trap[id])) {
      g.phase = "play";
      g.log.push(`Beide Fallen sind gestellt. ${g.names[luAttacker(g)]} beginnt.`);
    }
    return lobby;
  },

  luAttack(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    if (g.step !== "attack" || luAttacker(g) !== me.id) fail("Du bist gerade nicht dran.");
    const card = luInt(msg.card, 1, 9);
    if (!g.hand[me.id].includes(card)) fail("Diese Karte hast du schon gespielt.");
    const text = String(msg.text || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!normalize(text)) fail("Bitte schreib eine Aussage zu deiner Karte.");
    const nums = [...new Set((Array.isArray(msg.nums) ? msg.nums : []).map((n) => luInt(n, 1, 9)))].sort((x, y) => x - y);
    if (nums.length !== 3) fail("Wähle genau 3 Zahlen, auf die deine Aussage zutrifft.");
    const claim = msg.claim === "lie" ? "lie" : msg.claim === "truth" ? "truth" : null;
    if (!claim) fail("Wähle, ob deine Aussage die Wahrheit oder eine Lüge ist.");
    const inSet = nums.includes(card);
    if (claim === "truth" && !inSet) fail(`Deine Karte ${card} ist nicht unter ${nums.join(", ")} – das wäre eine Lüge.`);
    if (claim === "lie" && inSet) fail(`Deine Karte ${card} ist unter ${nums.join(", ")} – das wäre die Wahrheit.`);

    g.hand[me.id] = g.hand[me.id].filter((c) => c !== card);
    g.move = { card, text, nums, claim, defense: null, defCard: null };
    g.step = "defend";
    return lobby;
  },

  luDefend(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    if (g.step !== "defend" || luDefender(g) !== me.id) fail("Du bist gerade nicht dran.");
    const defense = ["believe", "doubt", "joker"].includes(msg.defense) ? msg.defense : null;
    if (!defense) fail("Glaubst du der Aussage oder nicht?");
    if (defense === "joker" && g.jokers[me.id] <= 0) fail("Du hast keine Lügnerjoker mehr.");
    const card = luInt(msg.card, 1, 9);
    if (!g.hand[me.id].includes(card)) fail("Diese Karte hast du schon gespielt.");
    g.hand[me.id] = g.hand[me.id].filter((c) => c !== card);
    g.move.defense = defense;
    g.move.defCard = card;
    luResolve(lobby);
    return lobby;
  },

  luNext(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    if (g.step !== "reveal" || !g.ids.includes(me.id)) return lobby;
    g.ready.add(me.id);
    const opponentGone = g.ids.some((id) => !lobby.players.find((p) => p.id === id && p.connected));
    if (g.ids.every((id) => g.ready.has(id)) || opponentGone) {
      if (g.round >= LU_ROUNDS) {
        luFinish(lobby);
      } else {
        g.round++;
        g.step = "attack";
        g.move = null;
        g.ready = new Set();
      }
    }
    return lobby;
  }
});

/* =========================================================
   WebSocket-Verbindungen
   ========================================================= */
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.ctx = null;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "ping") return send(ws, { type: "pong" });
    const handler = handlers[msg.type];
    if (!handler) return;

    try {
      let lobby;
      if (msg.type === "create" || msg.type === "join" || msg.type === "leave") {
        lobby = handler(ws, msg);
      } else {
        if (!ws.ctx) fail("Du bist in keiner Lobby.");
        lobby = handler(ws, msg, ws.ctx.lobby, ws.ctx.player);
      }
      if (lobby && lobbies.has(lobby.code)) broadcastState(lobby);
    } catch (err) {
      if (err instanceof GameError) send(ws, { type: "error", message: err.message });
      else {
        console.error(err);
        send(ws, { type: "error", message: "Unerwarteter Fehler auf dem Server." });
      }
    }
  });

  ws.on("close", () => {
    if (!ws.ctx) return;
    const { lobby, player } = ws.ctx;
    if (player.ws !== ws) return;
    player.ws = null;
    player.connected = false;
    ensureHost(lobby);
    if (connectedPlayers(lobby).length === 0) lobby.emptySince = Date.now();
    broadcastState(lobby);
  });
});

// Verbindungen am Leben halten, tote Verbindungen schließen, leere Lobbys aufräumen
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, lobby] of lobbies) {
    if (lobby.emptySince && now - lobby.emptySince > LOBBY_IDLE_MS) lobbies.delete(code);
  }
}, 25000);

server.listen(PORT, () => {
  console.log(`Partyspiele laufen auf http://localhost:${PORT}`);
});
