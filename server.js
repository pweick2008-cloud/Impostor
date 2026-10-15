"use strict";

// Partyspiele – Online-Server (Verräter, Wer bin ich? & SPIEGEL)
// Liefert die Website aus und verwaltet Lobbys über WebSockets.
// Der Server kennt alle Rollen und den Begriff; jeder Spieler bekommt
// nur die Informationen, die er sehen darf.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { CATEGORIES } = require("./words.js");
const { shuffle, pick, normalize, levenshtein, isCorrectGuess, displayWord, pickWord } = require("./shared.js");
const { SpiegelRules } = require("./spiegel-rules.js");
const { DRAW_POOLS, LEVELS: DR_LEVELS, LEVEL_NAMES: DR_LEVEL_NAMES } = require("./draw-words.js");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 3; // Verräter
const MIN_PLAYERS_BY_GAME = { verraeter: 3, werbinich: 2, luegen: 2, slf: 1, draw: 2 };
const MAX_PLAYERS_BY_GAME = { verraeter: 20, werbinich: 20, luegen: 2, slf: 20, draw: 20 };
const GAME_TYPES = ["verraeter", "werbinich", "luegen", "slf", "draw"];
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
  "/spiegel-rules.js": ["spiegel-rules.js", "text/javascript; charset=utf-8"],
  "/spiegel-online.js": ["spiegel-online.js", "text/javascript; charset=utf-8"],
  "/spiegel-local.js": ["spiegel-local.js", "text/javascript; charset=utf-8"],
  "/slf-online.js": ["slf-online.js", "text/javascript; charset=utf-8"],
  "/draw-canvas.js": ["draw-canvas.js", "text/javascript; charset=utf-8"],
  "/draw-online.js": ["draw-online.js", "text/javascript; charset=utf-8"]
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
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
    slfSettings: lobby.slfSettings,
    drawSettings: lobby.drawSettings,
    players: lobby.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    game: null
  };
  if (!g) return view;
  if (g.type === "draw") {
    view.game = drView(lobby, g, me);
    return view;
  }
  if (g.type === "slf") {
    view.game = slfView(lobby, g, me);
    return view;
  }
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
      emoji: "",
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
    broadcastEvent(lobby, { emoji: "", title: `${name} war unschuldig!`, text: `${name} war kein Verräter.`, tally });
    endGame(lobby, "impostor", `${name} war unschuldig und wurde rausgewählt.`);
    return;
  }

  g.results[eliminated] = "rausgewählt";
  g.log.push(`Vote: ${name} wurde rausgewählt – war ein Verräter!`);
  if (!checkImpostorsGone(lobby, "Alle Verräter wurden enttarnt.")) {
    broadcastEvent(lobby, {
      emoji: "",
      title: `${name} war ein Verräter!`,
      text: `${name} ist raus. Es sind noch Verräter im Spiel.`,
      tally
    });
    fixTurn(g);
  } else {
    broadcastEvent(lobby, { emoji: "", title: `${name} war ein Verräter!`, text: `${name} ist raus.`, tally });
  }
}

// Spieler verlässt eine laufende Partie endgültig
function dropFromGame(lobby, id) {
  const g = lobby.game;
  if (g && g.type === "werbinich") return wbiDrop(lobby, id);
  if (g && g.type === "luegen") return luDrop(lobby, id);
  if (g && g.type === "slf") return slfDrop(lobby, id);
  if (g && g.type === "draw") return drDrop(lobby, id);
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
      slfSettings: { ...SLF_DEFAULTS, categories: [...SLF_DEFAULTS.categories] },
      drawSettings: { ...DR_DEFAULTS },
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
      fail(lobby.gameType === "luegen" ? "Die Lobby ist voll – SPIEGEL spielt man zu zweit." : "Die Lobby ist voll.");
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
    if (lobby.gameType === "draw") drStart(lobby);
    else if (lobby.gameType === "slf") slfStart(lobby);
    else if (lobby.gameType === "luegen") luStart(lobby);
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
    broadcastEvent(lobby, { emoji: "", title: "Abstimmung!", text: `${me.name} hat einen Vote gestartet. Wähle einen Spieler oder enthalte dich.`, silent: true });
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
    g.results[me.id] = correct ? "hat den Begriff erraten" : "hat falsch geraten";
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
      emoji: "",
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
  const pool = ["musiker", "schauspieler", "politiker", "geschichte", "streamer"]
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
    text: `„${q.text}“ → ${isYes ? "Ja" : "Nein"} (${yes}:${no})` +
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
      broadcastEvent(lobby, { emoji: "", title: `${me.name} hat es erraten!`, text: `${me.name} ist ${term} – Platz ${g.ranks[me.id]}!` });
      if (!wbiCheckEnd(lobby)) wbiNextTurn(g);
    } else {
      g.log.push(`${me.name} hat „${text}“ geraten – falsch.`);
      broadcastEvent(lobby, { toast: true, text: `${me.name} hat „${text}“ geraten – falsch.` });
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
   SPIEGEL – online, genau 2 Spieler
   Die Wertung kommt aus spiegel-rules.js (dieselbe wie bei Pass & Play).
   SpiegelRules kennt die Spieler als "p0"/"p1"; der Server übersetzt
   zwischen diesen IDs und den echten Spieler-IDs und schickt jedem
   nur, was er sehen darf.
   ========================================================= */
const LU_ROUNDS = SpiegelRules.ROUNDS;

function luStart(lobby) {
  const ids = lobby.players.map((p) => p.id);
  const G = SpiegelRules.newGame(lobby.players.map((p) => p.name), Math.random() < 0.5 ? 0 : 1);
  lobby.game = {
    type: "luegen",
    G,
    ids, // ids[0] = "p0", ids[1] = "p1"
    ready: new Set(),
    log: [],
    get phase() { return this.G.phase; }
  };
}

const luPid = (g, id) => "p" + g.ids.indexOf(id); // echte ID → "p0"/"p1"
const luReal = (g, pid) => g.ids[Number(String(pid).slice(1))]; // "p0"/"p1" → echte ID

function luMapEntry(g, e) {
  if (!e) return null;
  const gain = {};
  for (const [pid, v] of Object.entries(e.gain)) gain[luReal(g, pid)] = v;
  return { ...e, attacker: luReal(g, e.attacker), gain };
}

function luView(lobby, g, me) {
  const G = g.G;
  const over = G.phase === "over";
  const inGame = g.ids.includes(me.id);
  const attacker = luReal(g, G.attacker);
  const players = G.players.map((p) => {
    const id = luReal(g, p.id);
    const lp = lobby.players.find((x) => x.id === id);
    // Die gegnerische Falle bleibt verdeckt, bis sie zuschnappt oder das Spiel endet
    const showTrap = id === me.id || over || p.trapState === "ausgelöst";
    return {
      id,
      name: p.name,
      connected: !!(lp && lp.connected),
      score: p.score,
      jokers: p.jokers,
      hand: [...p.hand], // gespielte Karten sind ohnehin aufgedeckt
      trapSet: p.trapSet,
      trap: showTrap && p.trap ? { ...p.trap } : null,
      trapState: p.trapState,
      starter: p.starter
    };
  });

  let move = null;
  if (G.move) {
    // Karte und Wahrheit/Lüge sieht der Verteidiger erst nach dem Aufdecken
    const visible = me.id === attacker || G.step === "reveal";
    move = { nums: [...G.move.nums], card: visible ? G.move.card : null, claim: visible ? G.move.claim : null };
  }

  return {
    type: "luegen",
    phase: G.phase,
    inGame,
    you: me.id,
    opp: inGame ? g.ids.find((x) => x !== me.id) : null,
    players,
    round: G.round,
    rounds: G.rounds,
    step: G.step,
    attacker,
    defender: luReal(g, SpiegelRules.other(G.attacker)),
    move,
    lastResult: G.step === "reveal" ? luMapEntry(g, G.lastResult) : null,
    ready: [...g.ready],
    history: G.history.map((e) => luMapEntry(g, e)),
    log: g.log,
    result: G.result ? { ...G.result, winner: G.result.winner ? luReal(g, G.result.winner) : null } : null
  };
}

function luDrop(lobby, id) {
  const g = lobby.game;
  if (g.phase === "over" || !g.ids.includes(id)) return;
  const opp = g.ids.find((x) => x !== id);
  g.log.push(`${g.G.players[g.ids.indexOf(id)].name} hat das Spiel verlassen.`);
  SpiegelRules.finish(g.G);
  const name = (x) => g.G.players[g.ids.indexOf(x)].name;
  g.G.result = { winner: luPid(g, opp), reason: `${name(id)} hat das Spiel verlassen – ${name(opp)} gewinnt.` };
}

function luInt(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail("Ungültige Zahl.");
  return n;
}

function luRequirePlayer(g, me) {
  if (!g.ids.includes(me.id)) fail("Du spielst nicht mit.");
  return SpiegelRules.byId(g.G, luPid(g, me.id));
}

Object.assign(handlers, {
  luTrap(ws, msg, lobby, me) {
    const g = requireGame(lobby, "setup", "luegen");
    luRequirePlayer(g, me);
    const card = luInt(msg.card, 1, 9);
    const from = luInt(msg.from, 1, LU_ROUNDS);
    const to = luInt(msg.to, 1, LU_ROUNDS);
    if (to < from) fail("Die Spanne muss mit der kleineren Runde beginnen.");
    if (to - from + 1 > 3) fail("Die Spanne darf höchstens 3 Runden lang sein.");
    SpiegelRules.setTrap(g.G, luPid(g, me.id), card, from, to);
    if (g.G.phase === "play") {
      g.log.push(`Beide Fallen sind gestellt. ${SpiegelRules.byId(g.G, g.G.attacker).name} beginnt.`);
    }
    return lobby;
  },

  luAttack(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    const G = g.G;
    if (G.step !== "attack" || luReal(g, G.attacker) !== me.id) fail("Du bist gerade nicht dran.");
    const card = luInt(msg.card, 1, 9);
    const nums = [...new Set((Array.isArray(msg.nums) ? msg.nums : []).map((n) => luInt(n, 1, 9)))].sort((x, y) => x - y);
    if (nums.length !== 3) fail("Wähle genau 3 Zahlen.");
    // Ob gelogen wird, ergibt sich aus Karte und Zahlen – ein mitgeschicktes "claim" wird ignoriert
    if (!SpiegelRules.attack(G, card, nums)) fail("Diese Karte hast du schon gespielt.");
    return lobby;
  },

  luDefend(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    const G = g.G;
    if (G.step !== "defend" || luReal(g, SpiegelRules.other(G.attacker)) !== me.id) fail("Du bist gerade nicht dran.");
    const mine = luRequirePlayer(g, me);
    const defense = msg.defense === "joker" ? "joker" : "believe";
    if (defense === "joker" && mine.jokers <= 0) fail("Du hast keine Lügenjoker mehr.");
    const card = luInt(msg.card, 1, 9);
    if (!SpiegelRules.defend(G, defense, card)) fail("Diese Karte hast du schon gespielt.");
    const e = G.lastResult;
    const name = (pid) => SpiegelRules.byId(G, pid).name;
    g.log.push(`Runde ${e.round}: ${name(e.attacker)} ${e.card} – ${e.defCard} ${name(SpiegelRules.other(e.attacker))} (${e.gain[e.attacker]}:${e.gain[SpiegelRules.other(e.attacker)]})`);
    g.ready = new Set();
    return lobby;
  },

  luNext(ws, msg, lobby, me) {
    const g = requireGame(lobby, "play", "luegen");
    if (g.G.step !== "reveal" || !g.ids.includes(me.id)) return lobby;
    g.ready.add(me.id);
    const opponentGone = g.ids.some((id) => !lobby.players.find((p) => p.id === id && p.connected));
    if (g.ids.every((id) => g.ready.has(id)) || opponentGone) {
      SpiegelRules.next(g.G); // nach der letzten Runde: Spielende mit −1 je ungenutztem Joker
      g.ready = new Set();
    }
    return lobby;
  }
});

/* =========================================================
   Stadt Land Fluss – nur online, 1 bis 20 Spieler
   - Der Host legt Kategorien, Timer und Rundenzahl in der Lobby fest.
   - Jede Runde gibt es einen Anfangsbuchstaben. Jeder füllt für jede
     Kategorie ein Feld aus und meldet sich fertig (jedes Feld braucht
     mindestens 2 Zeichen). Die Runde endet, wenn alle fertig sind oder
     der Timer abläuft.
   - Auswertung: Jeder stimmt über die Antworten der anderen ab (gültig /
     ungültig). Gleiche Antworten werden automatisch erkannt, auch mit
     kleinen Tippfehlern; der Host kann Antworten gleichsetzen oder trennen.
   - Punkte: als Einziger eine gültige Antwort in der Kategorie = 20,
     eine Antwort, die kein anderer hat = 10, gleiche Antwort wie ein
     anderer = 5, ungültig oder leer = 0.
   ========================================================= */
const SLF_DEFAULTS = { categories: ["Stadt", "Land", "Fluss", "Name", "Tier", "Beruf"], timer: 120, rounds: 5 };
const SLF_TIMERS = [0, 60, 90, 120, 180, 240, 300]; // 0 = ohne Timer
const SLF_LETTERS = "ABCDEFGHIJKLMNOPRSTUVWZ".split(""); // ohne Q, X, Y
const SLF_MAX_CATEGORIES = 12;

const slfClean = (t, max = 40) => String(t || "").trim().replace(/\s+/g, " ").slice(0, max);
const slfFilled = (t) => slfClean(t).length >= 2; // leer oder nur ein Zeichen zählt nicht

// Zwei Antworten gelten automatisch als gleich, wenn sie bis auf
// Groß-/Kleinschreibung, Umlaute, Leerzeichen und kleine Tippfehler übereinstimmen.
function slfSame(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const len = Math.min(x.length, y.length);
  const tol = len >= 8 ? 2 : len >= 4 ? 1 : 0;
  return tol > 0 && levenshtein(x, y) <= tol;
}

function slfSanitizeSettings(input, current) {
  const out = { ...current };
  if (Array.isArray(input.categories)) {
    const seen = new Set();
    out.categories = input.categories
      .map((c) => slfClean(c, 30))
      .filter((c) => c && !seen.has(normalize(c)) && seen.add(normalize(c)))
      .slice(0, SLF_MAX_CATEGORIES);
    if (!out.categories.length) fail("Es muss mindestens eine Kategorie geben.");
  }
  if (input.timer !== undefined) {
    const t = Number(input.timer);
    if (!SLF_TIMERS.includes(t)) fail("Ungültiger Timer.");
    out.timer = t;
  }
  if (input.rounds !== undefined) {
    const r = Number(input.rounds);
    if (!Number.isInteger(r) || r < 1 || r > 20) fail("Die Rundenzahl muss zwischen 1 und 20 liegen.");
    out.rounds = r;
  }
  return out;
}

function slfStart(lobby) {
  const st = lobby.slfSettings;
  lobby.game = {
    type: "slf",
    phase: "write", // write → review → scores → (write …) → over
    ids: lobby.players.map((p) => p.id),
    names: Object.fromEntries(lobby.players.map((p) => [p.id, p.name])),
    categories: [...st.categories],
    timer: st.timer,
    rounds: st.rounds,
    round: 0,
    usedLetters: [],
    total: Object.fromEntries(lobby.players.map((p) => [p.id, 0])),
    history: [] // pro Runde: { round, letter, points: {id: n} }
  };
  slfNewRound(lobby);
}

function slfNewRound(lobby) {
  const g = lobby.game;
  g.round++;
  let free = SLF_LETTERS.filter((l) => !g.usedLetters.includes(l));
  if (!free.length) free = SLF_LETTERS;
  g.letter = pick(free);
  g.usedLetters.push(g.letter);
  g.phase = "write";
  g.answers = Object.fromEntries(g.ids.map((id) => [id, g.categories.map(() => "")]));
  g.done = new Set();
  g.votes = {}; // "cat|spieler" → Map(abstimmender → true/false)
  g.merges = g.categories.map(() => []); // manuelle Gleichsetzungen: Paare von Spieler-IDs
  g.splits = g.categories.map(() => new Set()); // vom Host getrennte Antworten
  g.roundPoints = null;
  g.endsAt = g.timer ? Date.now() + g.timer * 1000 : null;
  if (g.timer) {
    const round = g.round;
    setTimeout(() => {
      // Nur auswerten, wenn diese Runde noch läuft
      if (lobby.game !== g || g.phase !== "write" || g.round !== round || !lobbies.has(lobby.code)) return;
      slfToReview(lobby, "Die Zeit ist um!");
      broadcastState(lobby);
    }, g.timer * 1000 + 300);
  }
}

const slfActive = (lobby, g) => g.ids.filter((id) => lobby.players.some((p) => p.id === id));

function slfToReview(lobby, reason) {
  const g = lobby.game;
  g.phase = "review";
  g.endsAt = null;
  // Zu kurze Antworten zählen als leer
  for (const id of g.ids) g.answers[id] = g.answers[id].map((a) => (slfFilled(a) ? slfClean(a) : ""));
  if (reason) broadcastEvent(lobby, { toast: true, text: `${reason} Auswertung beginnt.` });
}

// Gruppen gleicher Antworten je Kategorie (Union-Find)
function slfGroups(g, cat) {
  const ids = g.ids.filter((id) => g.answers[id][cat]);
  const parent = Object.fromEntries(ids.map((id) => [id, id]));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const split = g.splits[cat];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      if (split.has(a) || split.has(b)) continue;
      if (slfSame(g.answers[a][cat], g.answers[b][cat])) union(a, b);
    }
  }
  for (const [a, b] of g.merges[cat]) if (parent[a] && parent[b]) union(a, b);
  return Object.fromEntries(ids.map((id) => [id, find(id)]));
}

function slfIsValid(g, cat, id) {
  if (!g.answers[id][cat]) return false;
  const v = g.votes[`${cat}|${id}`];
  if (!v) return true;
  let yes = 0, no = 0;
  for (const ok of v.values()) ok ? yes++ : no++;
  return no <= yes; // ungültig nur, wenn mehr Stimmen dagegen als dafür
}

// Punkte dieser Runde (auch als Vorschau während der Auswertung)
function slfPoints(g) {
  const pts = Object.fromEntries(g.ids.map((id) => [id, g.categories.map(() => 0)]));
  g.categories.forEach((_, cat) => {
    const groups = slfGroups(g, cat);
    const valid = g.ids.filter((id) => slfIsValid(g, cat, id));
    for (const id of valid) {
      if (valid.length === 1) pts[id][cat] = 20;
      else pts[id][cat] = valid.some((o) => o !== id && groups[o] === groups[id]) ? 5 : 10;
    }
  });
  return pts;
}

function slfView(lobby, g, me) {
  const inGame = g.ids.includes(me.id);
  const view = {
    type: "slf",
    phase: g.phase,
    inGame,
    round: g.round,
    rounds: g.rounds,
    letter: g.letter,
    categories: g.categories,
    endsAt: g.endsAt,
    now: Date.now(),
    players: g.ids.map((id) => {
      const p = lobby.players.find((x) => x.id === id);
      return { id, name: g.names[id], connected: !!(p && p.connected), left: !p, done: g.done.has(id), total: g.total[id] };
    }),
    history: g.history
  };

  if (g.phase === "write") {
    // Während des Schreibens sieht jeder nur seine eigenen Antworten
    view.myAnswers = inGame ? g.answers[me.id] : null;
    return view;
  }

  const pts = g.phase === "review" ? slfPoints(g) : g.roundPoints;
  view.review = g.categories.map((name, cat) => {
    const groups = slfGroups(g, cat);
    return {
      name,
      answers: g.ids.map((id) => {
        const v = g.votes[`${cat}|${id}`] || new Map();
        let yes = 0, no = 0;
        for (const ok of v.values()) ok ? yes++ : no++;
        const text = g.answers[id][cat];
        return {
          id,
          text,
          group: text ? groups[id] : null,
          split: g.splits[cat].has(id),
          valid: slfIsValid(g, cat, id),
          yes,
          no,
          myVote: v.has(me.id) ? v.get(me.id) : null,
          points: pts ? pts[id][cat] : 0
        };
      })
    };
  });
  view.roundPoints = pts ? Object.fromEntries(g.ids.map((id) => [id, pts[id].reduce((a, b) => a + b, 0)])) : null;
  return view;
}

function slfDrop(lobby, id) {
  const g = lobby.game;
  if (g.phase === "over" || !g.ids.includes(id)) return;
  // Antworten bleiben stehen; wer geht, muss nicht mehr fertig werden
  if (g.phase === "write" && slfActive(lobby, g).filter((x) => x !== id).every((x) => g.done.has(x))) {
    slfToReview(lobby);
  }
}

function slfRequire(lobby, phase, me) {
  const g = requireGame(lobby, phase, "slf");
  if (!g.ids.includes(me.id)) fail("Du spielst in dieser Runde nicht mit.");
  return g;
}

function slfCat(g, v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n >= g.categories.length) fail("Unbekannte Kategorie.");
  return n;
}

Object.assign(handlers, {
  slfSettings(ws, msg, lobby, me) {
    requireHost(lobby, me);
    if (lobby.game && lobby.game.phase !== "over") fail("Während des Spiels können die Einstellungen nicht geändert werden.");
    lobby.slfSettings = slfSanitizeSettings(msg.settings || {}, lobby.slfSettings);
    return lobby;
  },

  // Zwischenstand beim Tippen, damit beim Ablauf des Timers nichts verloren geht
  slfDraft(ws, msg, lobby, me) {
    const g = slfRequire(lobby, "write", me);
    if (g.done.has(me.id) || !Array.isArray(msg.answers)) return null;
    g.answers[me.id] = g.categories.map((_, i) => slfClean(msg.answers[i]));
    return null; // keine Übertragung an alle nötig
  },

  slfDone(ws, msg, lobby, me) {
    const g = slfRequire(lobby, "write", me);
    const answers = g.categories.map((_, i) => slfClean((msg.answers || [])[i]));
    if (!answers.every(slfFilled)) fail("Fülle jedes Feld mit mindestens 2 Zeichen aus.");
    g.answers[me.id] = answers;
    g.done.add(me.id);
    if (slfActive(lobby, g).every((id) => g.done.has(id))) slfToReview(lobby, "Alle sind fertig.");
    return lobby;
  },

  slfUndone(ws, msg, lobby, me) {
    const g = slfRequire(lobby, "write", me);
    g.done.delete(me.id);
    return lobby;
  },

  // Host beendet das Schreiben vorzeitig
  slfStop(ws, msg, lobby, me) {
    requireHost(lobby, me);
    requireGame(lobby, "write", "slf");
    slfToReview(lobby, "Der Host hat die Runde beendet.");
    return lobby;
  },

  slfVote(ws, msg, lobby, me) {
    const g = slfRequire(lobby, "review", me);
    const cat = slfCat(g, msg.cat);
    if (!g.ids.includes(msg.id) || !g.answers[msg.id][cat]) fail("Diese Antwort gibt es nicht.");
    if (msg.id === me.id) fail("Über deine eigene Antwort stimmst du nicht ab.");
    const key = `${cat}|${msg.id}`;
    const v = g.votes[key] || (g.votes[key] = new Map());
    if (msg.valid === true || msg.valid === false) v.set(me.id, msg.valid);
    else v.delete(me.id);
    return lobby;
  },

  // Host setzt mehrere Antworten einer Kategorie gleich
  slfMerge(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "review", "slf");
    const cat = slfCat(g, msg.cat);
    const ids = [...new Set(Array.isArray(msg.ids) ? msg.ids : [])].filter((id) => g.ids.includes(id) && g.answers[id][cat]);
    if (ids.length < 2) fail("Wähle mindestens zwei Antworten aus.");
    for (const id of ids) g.splits[cat].delete(id);
    for (let i = 1; i < ids.length; i++) g.merges[cat].push([ids[0], ids[i]]);
    return lobby;
  },

  // Host trennt eine Antwort wieder von den anderen
  slfSplit(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "review", "slf");
    const cat = slfCat(g, msg.cat);
    if (!g.ids.includes(msg.id)) fail("Diese Antwort gibt es nicht.");
    g.merges[cat] = g.merges[cat].filter(([a, b]) => a !== msg.id && b !== msg.id);
    g.splits[cat].add(msg.id);
    return lobby;
  },

  slfFinishReview(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = requireGame(lobby, "review", "slf");
    const pts = slfPoints(g);
    g.roundPoints = pts;
    const sums = Object.fromEntries(g.ids.map((id) => [id, pts[id].reduce((a, b) => a + b, 0)]));
    for (const id of g.ids) g.total[id] += sums[id];
    g.history.push({ round: g.round, letter: g.letter, points: sums });
    g.phase = g.round >= g.rounds ? "over" : "scores";
    return lobby;
  },

  slfNext(ws, msg, lobby, me) {
    requireHost(lobby, me);
    requireGame(lobby, "scores", "slf");
    slfNewRound(lobby);
    return lobby;
  }
});

/* =========================================================
   Kritzeln – Zeichnen & Raten (nur online, 2 bis 20 Spieler)
   - Reihum zeichnet jeder einmal pro Runde. Der Zeichner wählt eines von
     3 Wörtern, die anderen raten im Chat.
   - Die Striche kommen in kleinen Paketen vom Zeichner und werden sofort
     an alle anderen weitergeleitet. Der Server merkt sich alle Striche
     der aktuellen Zeichnung, damit Nachzügler und neu Verbundene sie
     vollständig bekommen.
   - Punkte: Wer richtig rät, bekommt 50 bis 200 Punkte – je schneller,
     desto mehr. Der Zeichner bekommt 50 Punkte pro richtigem Rater.
   ========================================================= */
const DR_DEFAULTS = { rounds: 3, time: 80, hints: "mittel", levels: ["mittel"] };
// Anteil der Buchstaben, die als Tipp aufgedeckt werden
const DR_HINT_SHARE = { keine: 0, wenig: 0.15, mittel: 0.3, viel: 0.45 };

// Anzahl der Tipps abhängig von der Wortlänge: mindestens 1 (außer bei „keine“),
// höchstens die Hälfte der Buchstaben – ein Wort mit 2 Buchstaben bekommt also
// auch bei „viel“ nur einen Tipp, ein Wort mit 20 Buchstaben entsprechend mehr.
function drHintCount(letters, setting) {
  const share = DR_HINT_SHARE[setting] || 0;
  if (!share || letters < 2) return 0;
  return Math.min(Math.floor(letters / 2), Math.max(1, Math.round(letters * share)));
}
const DR_TIMES = [60, 80, 100, 120, 150];
const DR_CHOOSE_MS = 15000; // Zeit zum Wort-Aussuchen
const DR_TURN_END_MS = 6000; // Anzeige des Wortes nach einem Zug
const DR_MAX_POINTS = 60000; // Schutz vor riesigen Zeichnungen
const DR_COLOR = /^#[0-9a-f]{6}$/i;

const drActive = (lobby, g) => g.ids.filter((id) => lobby.players.some((p) => p.id === id));
const drGuessers = (lobby, g) => drActive(lobby, g).filter((id) => id !== g.drawer);

function drStart(lobby) {
  const st = lobby.drawSettings;
  lobby.game = {
    type: "draw",
    phase: "choose", // choose → draw → turnEnd → … → over
    ids: lobby.players.map((p) => p.id),
    names: Object.fromEntries(lobby.players.map((p) => [p.id, p.name])),
    rounds: st.rounds,
    time: st.time,
    hints: st.hints,
    levels: [...st.levels],
    round: 1,
    turnIdx: -1,
    turnNo: 0,
    score: Object.fromEntries(lobby.players.map((p) => [p.id, 0])),
    usedWords: new Set(),
    chat: [],
    ops: [],
    points: 0
  };
  drNextTurn(lobby);
}

function drChat(g, entry) {
  g.chat.push({ n: g.chatNo = (g.chatNo || 0) + 1, ...entry });
  if (g.chat.length > 120) g.chat.splice(0, g.chat.length - 120);
}

function drNextTurn(lobby) {
  const g = lobby.game;
  const active = drActive(lobby, g);
  if (active.length < 2) return drOver(lobby, "Zu wenige Spieler übrig.");
  // Nächster Zeichner in Sitzreihenfolge, der noch in der Lobby ist
  do {
    g.turnIdx++;
    if (g.turnIdx >= g.ids.length) {
      g.turnIdx = 0;
      g.round++;
    }
    if (g.round > g.rounds) return drOver(lobby);
  } while (!active.includes(g.ids[g.turnIdx]));

  g.turnNo++;
  g.drawer = g.ids[g.turnIdx];
  g.phase = "choose";
  g.word = null;
  g.revealed = [];
  g.guessed = new Map(); // ID → Punkte in diesem Zug
  g.turnPoints = null;
  g.ops = [];
  g.points = 0;
  g.choices = drPickChoices(g);
  g.endsAt = Date.now() + DR_CHOOSE_MS;
  drChat(g, { kind: "system", text: `${g.names[g.drawer]} ist dran und sucht ein Wort aus.` });
  drSchedule(lobby, DR_CHOOSE_MS, () => drChoose(lobby, 0));
}

// Timer, der nur greift, wenn der Zug inzwischen nicht weitergegangen ist
function drSchedule(lobby, ms, fn) {
  const g = lobby.game;
  const turn = g.turnNo;
  const phase = g.phase;
  setTimeout(() => {
    if (lobby.game !== g || g.turnNo !== turn || g.phase !== phase || !lobbies.has(lobby.code)) return;
    fn();
    broadcastState(lobby);
  }, ms);
}

// Drei Vorschläge: Für jeden wird zuerst eine der gewählten Stufen ausgelost
// (alle gleich wahrscheinlich – egal wie viele Begriffe eine Stufe hat),
// danach ein noch nicht benutzter Begriff aus dieser Stufe.
function drPickChoices(g) {
  const choices = [];
  const levels = [];
  for (let k = 0; k < 3; k++) {
    const level = pick(g.levels);
    const all = DRAW_POOLS[level];
    let pool = all.filter((w) => !g.usedWords.has(w) && !choices.includes(w));
    if (!pool.length) pool = all.filter((w) => !choices.includes(w)); // Stufe aufgebraucht → wieder von vorn
    choices.push(pick(pool));
    levels.push(level);
  }
  g.choiceLevels = levels;
  return choices;
}

function drChoose(lobby, index) {
  const g = lobby.game;
  g.word = g.choices[index] || g.choices[0];
  g.usedWords.add(g.word);
  g.phase = "draw";
  g.startedAt = Date.now();
  g.endsAt = g.startedAt + g.time * 1000;
  // Tipps: nach und nach einzelne Buchstaben aufdecken, gleichmäßig verteilt
  // zwischen 30 % und 90 % der Zeichenzeit
  const letters = [...g.word].map((c, i) => (/[a-zäöüßàáâéèêíóúñ]/i.test(c) ? i : -1)).filter((i) => i >= 0);
  const hints = drHintCount(letters.length, g.hints);
  const order = shuffle(letters).slice(0, hints);
  g.hintTotal = hints;
  order.forEach((idx, k) => {
    const f = 0.3 + 0.6 * (k + 1) / (hints + 1);
    drSchedule(lobby, g.time * 1000 * f, () => { g.revealed.push(idx); });
  });
  drSchedule(lobby, g.time * 1000, () => drEndTurn(lobby, "Die Zeit ist um!"));
}

function drEndTurn(lobby, reason) {
  const g = lobby.game;
  if (g.phase !== "draw" && g.phase !== "choose") return;
  const guessers = g.guessed.size;
  const drawerPts = g.phase === "draw" ? guessers * 50 : 0;
  g.turnPoints = Object.fromEntries(g.ids.map((id) => [id, g.guessed.get(id) || 0]));
  g.turnPoints[g.drawer] = drawerPts;
  g.score[g.drawer] += drawerPts;
  g.phase = "turnEnd";
  g.endsAt = Date.now() + DR_TURN_END_MS;
  g.turnReason = reason;
  if (g.word) drChat(g, { kind: "system", text: `Das Wort war „${g.word}“.` });
  drSchedule(lobby, DR_TURN_END_MS, () => drNextTurn(lobby));
}

function drOver(lobby, reason) {
  const g = lobby.game;
  g.phase = "over";
  g.endsAt = null;
  g.overReason = reason || "";
}

// Maskiertes Wort für Rater: Unterstriche, aufgedeckte Hinweise, Leer- und Bindestriche bleiben sichtbar
function drMask(g) {
  return [...g.word].map((c, i) => (/[\s-]/.test(c) ? c : g.revealed.includes(i) ? c : "_")).join("");
}

function drView(lobby, g, me) {
  const isDrawer = me.id === g.drawer;
  const knows = isDrawer || g.guessed.has(me.id) || g.phase === "turnEnd" || g.phase === "over";
  return {
    type: "draw",
    phase: g.phase,
    inGame: g.ids.includes(me.id),
    round: g.round,
    rounds: g.rounds,
    time: g.time,
    turnKey: `${g.turnNo}`,
    drawer: g.drawer,
    endsAt: g.endsAt,
    now: Date.now(),
    choices: isDrawer && g.phase === "choose" ? g.choices : null,
    levels: g.levels,
    levelName: g.levels.length === DR_LEVELS.length ? "alle Stufen" : g.levels.map((l) => DR_LEVEL_NAMES[l]).join(", "),
    hintsShown: g.revealed ? g.revealed.length : 0,
    hintTotal: g.phase === "draw" ? g.hintTotal || 0 : 0,
    word: g.word ? (knows ? g.word : null) : null,
    mask: g.word ? drMask(g) : null,
    wordLength: g.word ? [...g.word].length : 0,
    guessed: [...g.guessed.keys()],
    turnPoints: g.turnPoints,
    turnReason: g.phase === "turnEnd" ? g.turnReason : null,
    overReason: g.overReason || "",
    players: g.ids.map((id) => {
      const p = lobby.players.find((x) => x.id === id);
      return { id, name: g.names[id], connected: !!(p && p.connected), left: !p, score: g.score[id] };
    }),
    // Jeder sieht nur die Chatnachrichten, die für ihn bestimmt sind
    chat: g.chat.filter((m) => !m.to || m.to.includes(me.id)).slice(-60).map(({ to, ...m }) => m)
  };
}

function drDrop(lobby, id) {
  const g = lobby.game;
  if (g.phase === "over") return;
  drChat(g, { kind: "system", text: `${g.names[id]} hat das Spiel verlassen.` });
  if (drActive(lobby, g).length < 2) return drOver(lobby, "Zu wenige Spieler übrig.");
  if (id === g.drawer && (g.phase === "choose" || g.phase === "draw")) return drEndTurn(lobby, "Der Zeichner hat das Spiel verlassen.");
  if (g.phase === "draw" && drGuessers(lobby, g).every((x) => g.guessed.has(x))) drEndTurn(lobby, "Alle haben das Wort erraten!");
}

function drRequireDrawer(lobby, me, phase) {
  const g = requireGame(lobby, phase, "draw");
  if (g.drawer !== me.id) fail("Du zeichnest gerade nicht.");
  return g;
}

// Zeichnungs-Ereignis an alle außer den Zeichner weitergeben
function drRelay(lobby, g, op) {
  for (const p of lobby.players) if (p.ws && p.id !== g.drawer) send(p.ws, { type: "drawOp", key: `${g.turnNo}`, op });
}

const drNum = (v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 10000) / 10000;

Object.assign(handlers, {
  drSettings(ws, msg, lobby, me) {
    requireHost(lobby, me);
    if (lobby.game && lobby.game.phase !== "over") fail("Während des Spiels können die Einstellungen nicht geändert werden.");
    const st = { ...lobby.drawSettings };
    const s = msg.settings || {};
    if (s.rounds !== undefined) {
      const r = Number(s.rounds);
      if (!Number.isInteger(r) || r < 1 || r > 10) fail("Die Rundenzahl muss zwischen 1 und 10 liegen.");
      st.rounds = r;
    }
    if (s.time !== undefined) {
      if (!DR_TIMES.includes(Number(s.time))) fail("Ungültige Zeichenzeit.");
      st.time = Number(s.time);
    }
    if (s.hints !== undefined) {
      if (!(s.hints in DR_HINT_SHARE)) fail("Ungültige Tipp-Einstellung.");
      st.hints = s.hints;
    }
    if (s.levels !== undefined) {
      const levels = DR_LEVELS.filter((l) => Array.isArray(s.levels) && s.levels.includes(l));
      if (!levels.length) fail("Wähle mindestens eine Schwierigkeit.");
      st.levels = levels;
    }
    lobby.drawSettings = st;
    return lobby;
  },

  drChoose(ws, msg, lobby, me) {
    drRequireDrawer(lobby, me, "choose");
    const i = Number(msg.index);
    if (![0, 1, 2].includes(i)) fail("Ungültige Auswahl.");
    drChoose(lobby, i);
    return lobby;
  },

  // Strich-Paket, Füllung, Rückgängig oder Leeren – nur vom Zeichner
  drOp(ws, msg, lobby, me) {
    const g = drRequireDrawer(lobby, me, "draw");
    const op = msg.op || {};
    if (op.k === "s") {
      const id = String(op.id || "").slice(0, 24);
      const pts = (Array.isArray(op.pts) ? op.pts : []).slice(0, 400)
        .map((q) => [drNum(q[0]), drNum(q[1]), drNum(q[2] === undefined ? 0.5 : q[2])]);
      if (!id || !pts.length) return null;
      if (g.points + pts.length > DR_MAX_POINTS) fail("Die Zeichnung ist zu groß – bitte leeren.");
      g.points += pts.length;
      let stroke = g.ops.find((o) => o.k === "s" && o.id === id);
      if (!stroke) {
        const color = DR_COLOR.test(op.c) ? op.c : "#111111";
        const size = Math.min(0.08, Math.max(0.001, Number(op.w) || 0.01));
        stroke = { k: "s", id, c: color, w: size, t: op.t === "eraser" ? "eraser" : "pen", pts: [] };
        g.ops.push(stroke);
      }
      stroke.pts.push(...pts);
      drRelay(lobby, g, { k: "s", id, c: stroke.c, w: stroke.w, t: stroke.t, pts });
    } else if (op.k === "f") {
      if (!DR_COLOR.test(op.c)) fail("Ungültige Farbe.");
      const fill = { k: "f", id: String(op.id || "").slice(0, 24), x: drNum(op.x), y: drNum(op.y), c: op.c };
      g.ops.push(fill);
      drRelay(lobby, g, fill);
    } else if (op.k === "undo") {
      const id = String(op.id || "");
      const idx = g.ops.findIndex((o) => o.id === id);
      if (idx >= 0) {
        if (g.ops[idx].pts) g.points -= g.ops[idx].pts.length;
        g.ops.splice(idx, 1);
        drRelay(lobby, g, { k: "undo", id });
      }
    } else if (op.k === "clear") {
      g.ops = [];
      g.points = 0;
      drRelay(lobby, g, { k: "clear" });
    }
    return null; // kein komplettes Status-Update nötig
  },

  // Vollständige Zeichnung für einen Spieler (nach Neuladen oder Verbindungsabbruch)
  drSync(ws, msg, lobby, me) {
    const g = lobby.game;
    if (!g || g.type !== "draw") return null;
    send(ws, { type: "drawSync", key: `${g.turnNo}`, ops: g.ops });
    return null;
  },

  drGuess(ws, msg, lobby, me) {
    const g = requireGame(lobby, lobby.game && lobby.game.phase, "draw");
    const text = String(msg.text || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!text) return null;
    const isDrawer = me.id === g.drawer;
    const knows = isDrawer || g.guessed.has(me.id);

    if (g.phase === "draw" && !knows) {
      const a = normalize(text);
      const b = normalize(g.word);
      if (a === b) {
        const left = Math.max(0, g.endsAt - Date.now());
        const pts = 50 + Math.round(150 * left / (g.time * 1000));
        g.guessed.set(me.id, pts);
        g.score[me.id] += pts;
        drChat(g, { kind: "correct", text: `${me.name} hat das Wort erraten!` });
        if (drGuessers(lobby, g).every((x) => g.guessed.has(x))) drEndTurn(lobby, "Alle haben das Wort erraten!");
        return lobby;
      }
      if (b.length >= 4 && levenshtein(a, b) <= 1) {
        drChat(g, { kind: "close", text: `„${text}“ ist knapp daneben!`, to: [me.id] });
        return lobby;
      }
      drChat(g, { kind: "msg", name: me.name, id: me.id, text });
      return lobby;
    }

    // Wer das Wort kennt, schreibt während des Zeichnens nur für andere Wissende
    if (g.phase === "draw" && knows) {
      if (isDrawer) fail("Der Zeichner kann während des Zeichnens nicht schreiben.");
      drChat(g, { kind: "msg", name: me.name, id: me.id, text, to: [g.drawer, ...g.guessed.keys()] });
      return lobby;
    }
    drChat(g, { kind: "msg", name: me.name, id: me.id, text });
    return lobby;
  },

  drSkip(ws, msg, lobby, me) {
    requireHost(lobby, me);
    const g = lobby.game;
    if (!g || g.type !== "draw" || !["choose", "draw"].includes(g.phase)) fail("Das geht gerade nicht.");
    drEndTurn(lobby, "Der Host hat den Zug übersprungen.");
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
