"use strict";

/* =========================================================
   Einstellungen & Konstanten
   ========================================================= */
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const STORAGE_KEY = "imposter-settings-v1";
const USED_KEY = "imposter-used-words-v1";

const DIFFICULTIES = [
  { id: "leicht", name: "Leicht" },
  { id: "mittel", name: "Mittel" },
  { id: "schwer", name: "Schwer" }
];

const settings = {
  names: ["", "", "", ""],
  impostors: 1,
  categories: ["laender"],
  difficulties: ["leicht"],
  hint: true,
  wordHint: false
};

let game = null;

const $ = (id) => document.getElementById(id);

/* =========================================================
   Hilfsfunktionen
   ========================================================= */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.names)) Object.assign(settings, saved);
  } catch (e) { /* ohne Speicher geht's auch */ }
  // Ältere Speicherstände haben noch eine einzelne "category"/"difficulty"
  settings.categories = resolveCategories(settings.category !== undefined ? settings.category : settings.categories);
  settings.difficulties = resolveDifficulties(settings.difficulty !== undefined ? settings.difficulty : settings.difficulties);
  delete settings.category;
  delete settings.difficulty;
  settings.names = settings.names.slice(0, MAX_PLAYERS);
  while (settings.names.length < MIN_PLAYERS) settings.names.push("");
  clampImpostors();
}

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* egal */ }
}

function getUsedWords() {
  try { return JSON.parse(localStorage.getItem(USED_KEY)) || []; } catch (e) { return []; }
}

function rememberWord(entry) {
  try {
    const used = getUsedWords().filter((w) => w !== entry);
    used.push(entry);
    localStorage.setItem(USED_KEY, JSON.stringify(used.slice(-150)));
  } catch (e) { /* egal */ }
}

function clampImpostors() {
  const max = Math.max(1, settings.names.length - 1);
  settings.impostors = Math.min(Math.max(1, settings.impostors), max);
}

/* ---------- Bildschirm-Übergänge ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let transitioning = Promise.resolve();

let currentGame = "verraeter"; // "verraeter" oder "werbinich"
let currentMode = "local"; // "local" (Pass & Play) oder "online"

const GAMES = {
  verraeter: { icon: "", svg: "mask", name: "Verräter", sub: "Einer kennt den Begriff nicht. Findet ihn!" },
  werbinich: { icon: "", svg: "note", name: "Wer bin ich?", sub: "Alle kennen deine Person – nur du nicht." },
  luegen: { icon: "", svg: "joker", name: "SPIEGEL", sub: "Karten, Aussagen, Lügen und Fallen – zu zweit." },
  slf: { icon: "", svg: "map", name: "Stadt Land Fluss", sub: "Ein Buchstabe, eigene Kategorien, Zeitdruck.", onlineOnly: true },
  draw: { icon: "", svg: "pencil", name: "Kritzeln", sub: "Einer zeichnet, alle anderen raten.", onlineOnly: true }
};

// Phasen-Anzeige je Spiel und Modus
const STEP_PLANS = {
  "verraeter-local": [["setup", "Start"], ["reveal", "Rollen"], ["game", "Spiel"]],
  "verraeter-online": [["setup", "Lobby"], ["reveal", "Rollen"], ["game", "Spiel"]],
  "werbinich-local": [["setup", "Start"], ["assign", "Personen"], ["show", "Zeigen"], ["game", "Spiel"]],
  "werbinich-online": [["setup", "Lobby"], ["assign", "Personen"], ["game", "Spiel"]],
  "luegen-local": [["setup", "Start"], ["trap", "Fallen"], ["game", "Duell"]],
  "luegen-online": [["setup", "Lobby"], ["trap", "Fallen"], ["game", "Duell"]],
  "slf-local": [["setup", "Lobby"], ["write", "Schreiben"], ["review", "Auswertung"], ["scores", "Punkte"]],
  "slf-online": [["setup", "Lobby"], ["write", "Schreiben"], ["review", "Auswertung"], ["scores", "Punkte"]],
  "draw-local": [["setup", "Lobby"], ["game", "Spiel"]],
  "draw-online": [["setup", "Lobby"], ["game", "Spiel"]]
};

function updateSteps(phase) {
  const nav = $("steps");
  const key = `${currentGame}-${currentMode}`;
  const plan = STEP_PLANS[key];
  if (nav.dataset.plan !== key) {
    nav.dataset.plan = key;
    nav.innerHTML = plan.map(([id, label], i) =>
      (i ? '<div class="step-line"></div>' : "") +
      `<div class="step" data-phase="${id}"><span class="dot">${i + 1}</span><span class="label">${label}</span></div>`
    ).join("");
  }
  const order = plan.map(([id]) => id);
  const idx = order.indexOf(phase);
  nav.hidden = idx < 0; // in den Menüs keine Phasen-Anzeige
  nav.querySelectorAll(".step").forEach((el) => {
    const i = order.indexOf(el.dataset.phase);
    el.classList.toggle("done", i < idx);
    el.classList.toggle("current", i === idx);
  });
  nav.querySelectorAll(".step-line").forEach((el, i) => el.classList.toggle("done", i < idx));
}

// Moduswahl für das gewählte Spiel anzeigen
function openGameMenu(gameId) {
  currentGame = gameId;
  const g = GAMES[gameId];
  $("menu-logo").innerHTML = `<svg class="ico"><use href="#ico-${g.svg}"/></svg>`;
  $("menu-title").textContent = g.name;
  $("menu-title").dataset.text = g.name;
  $("menu-sub").textContent = g.sub;
  $("menu-online-note").hidden = true;
  $("menu-local").hidden = !!g.onlineOnly;
  $("menu-only-online").hidden = !g.onlineOnly;
  $("menu-only-online").textContent = `${g.name} gibt es nur online – jeder spielt auf seinem eigenen Gerät.`;
  showScreen("menu");
}

// Blendet den aktuellen Bildschirm aus und den neuen animiert ein.
// "phase" bestimmt, welcher Schritt oben in der Phasen-Anzeige leuchtet.
function showScreen(name, phase = name) {
  transitioning = transitioning.then(async () => {
    const current = document.querySelector(".screen.active");
    const next = $("screen-" + name);
    if (current && current !== next) {
      current.classList.remove("active");
      current.classList.add("leaving");
      await wait(280);
      current.classList.remove("leaving");
    }
    updateSteps(phase);
    document.documentElement.dataset.theme = name === "hub" || window.inviteMode ? "hub" : currentGame;
    next.classList.remove("active");
    void next.offsetWidth; // Animation neu starten
    next.classList.add("active");
    window.scrollTo(0, 0);
  });
  return transitioning;
}

// Zwischenbildschirm zwischen zwei Phasen. Wird durch Antippen beendet.
function showPhase({ num, icon, title, text, button, phase, suspense = false }) {
  $("phase-num").textContent = num ? `Phase ${num}` : "";
  $("phase-icon").textContent = icon;
  $("phase-title").textContent = title;
  $("phase-text").textContent = text;
  $("phase-btn").textContent = button;
  const card = $("phase-card");
  card.classList.toggle("suspense", suspense);
  return showScreen("phase", phase).then(() => new Promise((resolve) => {
    const readyAt = Date.now() + 700; // erst nach dem Einblenden antippbar
    card.onclick = () => {
      if (Date.now() < readyAt) return;
      card.onclick = null;
      resolve();
    };
  }));
}

// Spielt eine Karten-Animation ab und tauscht in der Mitte den Inhalt.
async function animateCard(kind, swap) {
  const card = $("reveal-card");
  card.classList.add(kind + "-out");
  await wait(kind === "flip" ? 220 : 280);
  swap();
  card.classList.remove(kind + "-out");
  card.classList.add(kind + "-in");
  await wait(kind === "flip" ? 250 : 350);
  card.classList.remove(kind + "-in");
}

/* ---------- Kurzer Hinweis unten am Bildschirm ---------- */
let toastTimer = null;
function showToast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("toast-in");
  void el.offsetWidth;
  el.classList.add("toast-in");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/* ---------- Dialog ---------- */
function showModal({ emoji = "", title = "", text = "", ok = "OK", cancel = null }) {
  return new Promise((resolve) => {
    $("modal-emoji").textContent = emoji;
    $("modal-title").textContent = title;
    $("modal-text").textContent = text;
    $("modal-ok").textContent = ok;
    $("modal-cancel").hidden = !cancel;
    if (cancel) $("modal-cancel").textContent = cancel;
    $("modal").hidden = false;

    const close = (result) => {
      $("modal").hidden = true;
      $("modal-ok").onclick = null;
      $("modal-cancel").onclick = null;
      resolve(result);
    };
    $("modal-ok").onclick = () => close(true);
    $("modal-cancel").onclick = () => close(false);
  });
}

/* =========================================================
   Setup-Bildschirm
   ========================================================= */
function renderSetup() {
  while (settings.names.length < MIN_PLAYERS) settings.names.push("");
  clampImpostors();
  // Spielerliste
  const list = $("player-list");
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
  $("player-count").textContent = settings.names.length;
  $("impostor-count").textContent = settings.impostors;

  // Kategorien und Schwierigkeit (mehrere gleichzeitig möglich)
  const update = (key, list) => { settings[key] = list; saveSettings(); renderSetup(); };
  renderMultiChips($("category-list"), categoryOptions(), settings.categories, "Kategorie", (l) => update("categories", l));
  renderMultiChips($("difficulty-list"), DIFFICULTIES, settings.difficulties, "Schwierigkeit", (l) => update("difficulties", l));

  $("opt-hint").checked = settings.hint;
  $("opt-wordhint").checked = settings.wordHint;
  $("setup-error").hidden = true;
}

function categoryOptions() {
  return Object.entries(CATEGORIES).map(([id, c]) => ({ id, name: `${c.icon} ${c.name}`.trim() }));
}

// Chips zum An- und Abwählen; mindestens einer bleibt immer ausgewählt.
// onChange = null: nur anzeigen (z. B. für Nicht-Hosts in der Lobby)
function renderMultiChips(box, options, selected, what, onChange) {
  box.innerHTML = "";
  const all = options.map((o) => o.id);
  const ordered = (list) => all.filter((id) => list.includes(id));
  for (const opt of options) {
    const on = selected.includes(opt.id);
    box.appendChild(makeChip(opt.name, on, onChange ? () => {
      if (on && selected.length === 1) return showToast(`Mindestens eine ${what} muss ausgewählt bleiben.`);
      onChange(ordered(on ? selected.filter((id) => id !== opt.id) : [...selected, opt.id]));
    } : null));
  }
  if (options.length > 3) {
    const allOn = selected.length === all.length;
    box.appendChild(makeChip("Alle", allOn, onChange ? () => onChange(allOn ? [all[0]] : all) : null));
  }
}

function makeChip(label, selected, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip" + (selected ? " selected" : "");
  b.textContent = label;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function onStep(e) {
  const btn = e.target.closest("[data-step]");
  if (!btn) return;
  const dir = Number(btn.dataset.dir);
  if (btn.dataset.step === "players") {
    if (dir > 0 && settings.names.length < MAX_PLAYERS) settings.names.push("");
    if (dir < 0 && settings.names.length > MIN_PLAYERS) settings.names.pop();
  } else {
    settings.impostors += dir;
  }
  clampImpostors();
  saveSettings();
  renderSetup();
}

let hintsLoading = null;
function loadVerraeterHints() {
  if (typeof VERRAETER_HINTS !== "undefined") return Promise.resolve();
  if (!hintsLoading) {
    hintsLoading = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "verraeter-hints.js";
      el.onload = resolve;
      el.onerror = () => { hintsLoading = null; reject(new Error("Hinweise nicht geladen")); };
      document.head.appendChild(el);
    });
  }
  return hintsLoading;
}

function setupError(msg) {
  $("setup-error").textContent = msg;
  $("setup-error").hidden = false;
}

function startGame() {
  const names = settings.names.map((n) => n.trim());

  if (names.some((n) => !n)) return setupError("Bitte gib allen Spielern einen Namen.");
  const normed = names.map(normalize);
  if (normed.some((n) => !n)) return setupError("Namen müssen mindestens einen Buchstaben oder eine Zahl enthalten.");
  if (new Set(normed).size !== normed.length) return setupError("Jeder Name darf nur einmal vorkommen.");
  if (settings.impostors >= names.length) return setupError("Es muss mindestens einen normalen Spieler geben.");

  // Begriff auswählen
  const { catId, category, entry } = pickWord(CATEGORIES, settings.categories, settings.difficulties, getUsedWords());
  rememberWord(entry);

  // Rollen verteilen
  const impostorIdx = new Set(shuffle(names.map((_, i) => i)).slice(0, settings.impostors));
  const players = names.map((name, i) => ({
    name,
    key: normalize(name),
    impostor: impostorIdx.has(i),
    out: false,
    result: null, // Text zum Ausscheiden
    tips: []
  }));

  game = {
    players,
    entry,
    word: displayWord(entry),
    hint: null,
    categoryId: catId,
    category,
    order: shuffle(players), // zufällige Reihenfolge beim Aufdecken
    revealIndex: 0,
    revealed: false,
    animating: false,
    log: [],
    over: false
  };

  // Hinweisliste erst jetzt nachladen – vorher braucht sie niemand
  const hintReady = !settings.wordHint ? Promise.resolve() : loadVerraeterHints()
    .then(() => { game.hint = verraeterHint(wordSource(catId, entry), game.word); })
    .catch(() => { /* ohne Hinweis spielen */ });

  showPhase({
    num: 2,
    icon: "",
    title: "Rollen verteilen",
    text: `Das Gerät wandert jetzt reihum.\nJeder schaut sich seine Rolle allein an – ${game.players.length} Spieler, ${settings.impostors} Verräter.`,
    button: "Los geht's",
    phase: "reveal"
  }).then(() => hintReady).then(() => {
    renderReveal();
    showScreen("reveal");
  });
}

/* =========================================================
   Rollen aufdecken (ein Gerät, reihum)
   ========================================================= */
function renderReveal() {
  const p = game.order[game.revealIndex];
  const card = $("reveal-card");
  $("reveal-progress").textContent = `Spieler ${game.revealIndex + 1} von ${game.order.length}`;
  card.classList.remove("crew", "impostor");

  if (!game.revealed) {
    $("reveal-name").textContent = p.name;
    $("reveal-front").hidden = false;
    $("reveal-back").hidden = true;
    return;
  }

  const back = $("reveal-back");
  const isLast = game.revealIndex === game.order.length - 1;
  const nextText = isLast ? "Tippe erneut – dann geht's los!" : "Tippe erneut und gib das Gerät weiter";

  if (p.impostor) {
    card.classList.add("impostor");
    back.innerHTML = `
      <span class="hand"></span>
      <span class="role-label">${escapeHtml(p.name)}, du bist</span>
      <span class="role-impostor">VERRÄTER</span>
      ${settings.hint ? `<span class="small muted">Kategorie: ${escapeHtml(game.category.icon + " " + game.category.name)}</span>` : ""}
      ${game.hint ? `<span class="role-hint">Hinweis: ${escapeHtml(game.hint)}</span>` : ""}
      <span class="small muted">Lass dir nichts anmerken und finde den Begriff heraus!</span>
      <span class="next-hint">${nextText}</span>`;
  } else {
    card.classList.add("crew");
    back.innerHTML = `
      <span class="hand"></span>
      <span class="role-label">${escapeHtml(p.name)}, dein Begriff</span>
      <span class="role-word">${escapeHtml(game.word)}</span>
      <span class="small muted">Kategorie: ${escapeHtml(game.category.icon + " " + game.category.name)}</span>
      <span class="next-hint">${nextText}</span>`;
  }
  $("reveal-front").hidden = true;
  back.hidden = false;
}

async function onRevealTap() {
  // Sperre während der Animation, damit ein Doppeltipp nicht versehentlich weiterschaltet
  if (!game || game.animating) return;
  game.animating = true;

  if (!game.revealed) {
    // Karte umdrehen → Rolle sehen
    await animateCard("flip", () => { game.revealed = true; renderReveal(); });
  } else if (game.revealIndex < game.order.length - 1) {
    // Karte wegwischen → nächster Spieler
    await animateCard("slide", () => {
      game.revealed = false;
      game.revealIndex++;
      renderReveal();
    });
  } else {
    // Letzter Spieler fertig → nächste Phase
    await animateCard("flip", () => { game.revealed = false; $("reveal-back").innerHTML = ""; renderReveal(); });
    game.animating = false;
    startDiscussion();
    return;
  }
  game.animating = false;
}

/* =========================================================
   Spielrunde: Tipps reihum, Votes, Verräter-Raten, Ergebnis
   ========================================================= */
const activePlayers = () => game.players.filter((p) => !p.out);
const activeImpostors = () => game.players.filter((p) => !p.out && p.impostor);

// Nächster aktiver Spieler in Sitzreihenfolge nach Index idx
function nextActiveFrom(idx) {
  const n = game.players.length;
  for (let i = 1; i <= n; i++) {
    const j = (idx + i) % n;
    if (!game.players[j].out) return j;
  }
  return idx;
}

// Ist der Spieler am Zug ausgeschieden, geht der Zug an den nächsten.
function fixTurn() {
  if (game.players[game.turn].out) game.turn = nextActiveFrom(game.turn);
}

// Ein Vote ist möglich, sobald seit dem letzten Vote (bzw. Spielstart)
// jeder aktive Spieler einen Tipp abgegeben hat.
const voteReady = () => activePlayers().every((p) => game.sinceVote.has(p.key));
const tipsUntilVote = () => activePlayers().filter((p) => !game.sinceVote.has(p.key)).length;

function addLog(text) {
  game.log.push(text);
}

async function startDiscussion() {
  $("reveal-back").innerHTML = ""; // Rolle nicht im DOM stehen lassen
  game.turn = Math.floor(Math.random() * game.players.length);
  game.sinceVote = new Set();
  game.voteUnlocked = false; // wird nach der ersten vollen Runde true
  game.vote = null;
  const starter = game.players[game.turn];

  $("screen-game").classList.remove("over");
  $("result").hidden = true;
  renderGame();
  await showPhase({
    num: 3,
    icon: "",
    title: "Spielrunde",
    text: `Alle Rollen sind verteilt!\nReihum gibt jeder einen Tipp zum Begriff ab – ohne ihn zu verraten.\nNach jeder vollen Runde könnt ihr einen Vote starten.\n\n${starter.name} beginnt.`,
    button: "Los geht's",
    phase: "game"
  });
  showScreen("game");
}

function renderGame() {
  const active = activePlayers();
  $("game-sub").textContent = game.over
    ? "Das Spiel ist vorbei."
    : `${active.length} im Spiel · ${activeImpostors().length} Verräter übrig`;
  $("game-status").textContent = `${active.length}/${game.players.length} aktiv`;

  if (!game.over) {
    // Wer ist dran?
    const current = game.players[game.turn];
    $("turn-name").textContent = current.name;
    $("tip-input").placeholder = `${current.name}, dein Tipp zum Begriff`;

    // Vote-Bereich
    const ready = voteReady();
    $("vote-card").hidden = !game.voteUnlocked;
    $("btn-vote").hidden = !ready;
    $("vote-card").classList.toggle("ready", ready);
    $("vote-status").textContent = ready ? "bereit" : "gesperrt";
    const left = tipsUntilVote();
    $("vote-hint").textContent = ready
      ? "Alle haben einen Tipp abgegeben. Ihr könnt jetzt abstimmen – oder weiter Tipps geben."
      : `Nächster Vote möglich nach ${left} weiteren ${left === 1 ? "Tipp" : "Tipps"}.`;
  }

  // Profile
  const wrap = $("profiles");
  wrap.innerHTML = "";
  game.players.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "profile";
    let badge = "";
    if (game.over) {
      el.classList.add(p.impostor ? "role-imp" : "role-crew");
      if (p.out) el.classList.add("out");
      badge = p.impostor ? "Verräter" : "Spieler";
    } else if (p.out) {
      el.classList.add("out");
      badge = "Raus";
    } else if (i === game.turn) {
      el.classList.add("current");
      badge = "Am Zug";
    } else if (game.sinceVote.has(p.key)) {
      el.classList.add("tipped");
      badge = "✓ Tipp";
    }
    const tips = p.tips.length
      ? `<ol class="tips">${p.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol>`
      : `<p class="tips-empty">Noch kein Tipp</p>`;
    const note = game.over && p.result ? `<p class="profile-note">${escapeHtml(p.result)}</p>` : "";
    el.innerHTML = `
      <div class="profile-head">
        <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(p.name)}</span>
        ${badge ? `<span class="badge">${badge}</span>` : ""}
      </div>
      ${tips}${note}`;
    wrap.appendChild(el);
  });

  // Verlauf
  const logEl = $("game-log");
  logEl.innerHTML = "";
  for (const entry of game.log) {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.appendChild(li);
  }
  $("log-card").hidden = game.log.length === 0;
}

/* ---------- Tipp abgeben ---------- */
function onTip(e) {
  e.preventDefault();
  if (game.over) return;
  const input = $("tip-input");
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  const p = game.players[game.turn];
  const wasReady = voteReady();
  p.tips.push(text);
  game.sinceVote.add(p.key);
  game.turn = nextActiveFrom(game.turn);
  input.value = "";

  if (!wasReady && voteReady()) {
    game.voteUnlocked = true;
    addLog("Runde komplett – ein Vote ist jetzt möglich.");
  }
  renderGame();
}

/* ---------- Vote ---------- */
function startVote() {
  if (game.over || !voteReady()) return;
  // Abgestimmt wird in Sitzreihenfolge, beginnend beim Spieler am Zug
  const voters = [];
  let i = game.turn;
  do {
    if (!game.players[i].out) voters.push(game.players[i]);
    i = (i + 1) % game.players.length;
  } while (i !== game.turn);
  game.vote = { voters, index: 0, ballots: new Map(), done: false };
  $("vote-cancel").hidden = false;
  $("vote-panel").hidden = false;
  showVoteStep("handoff");
}

function showVoteStep(step) {
  const v = game.vote;
  ["handoff", "choose", "result"].forEach((s) => { $("vote-" + s).hidden = s !== step; });
  $("vote-progress").textContent = step === "result" ? "Auswertung" : `Stimme ${v.index + 1} von ${v.voters.length}`;

  if (step === "handoff") {
    const voter = v.voters[v.index];
    $("vote-voter").textContent = voter.name;
    $("vote-ready").textContent = `Ich bin ${voter.name} – abstimmen`;
  }

  if (step === "choose") {
    const voter = v.voters[v.index];
    $("vote-question").textContent = `${voter.name}, wen wählst du raus?`;
    const opts = $("vote-options");
    opts.innerHTML = "";
    for (const p of activePlayers()) {
      if (p === voter) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn vote-option";
      b.textContent = p.name;
      b.addEventListener("click", () => castBallot(p));
      opts.appendChild(b);
    }
    const abstain = document.createElement("button");
    abstain.type = "button";
    abstain.className = "btn ghost vote-option abstain";
    abstain.textContent = "Enthalten";
    abstain.addEventListener("click", () => castBallot(null));
    opts.appendChild(abstain);
  }
  $("vote-panel").querySelector(".overlay-box").scrollTop = 0;
}

function castBallot(target) {
  const v = game.vote;
  v.ballots.set(v.voters[v.index].key, target);
  v.index++;
  if (v.index < v.voters.length) showVoteStep("handoff");
  else finishVote();
}

function finishVote() {
  const v = game.vote;
  v.done = true;
  $("vote-cancel").hidden = true;

  const counts = new Map();
  let abstentions = 0;
  for (const target of v.ballots.values()) {
    if (!target) abstentions++;
    else counts.set(target, (counts.get(target) || 0) + 1);
  }
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranking.length ? ranking[0][1] : 0;
  const leaders = ranking.filter(([, c]) => c === top);

  // Raus ist, wer allein die meisten Stimmen hat – und mehr Stimmen als Enthaltungen.
  let eliminated = null;
  if (top > 0 && leaders.length === 1 && top > abstentions) eliminated = leaders[0][0];
  v.eliminated = eliminated;

  // Auszählung anzeigen
  const tally = $("vote-tally");
  tally.innerHTML = "";
  for (const [p, c] of ranking) {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${c} ${c === 1 ? "Stimme" : "Stimmen"}`;
    tally.appendChild(li);
  }
  if (abstentions) {
    const li = document.createElement("li");
    li.textContent = `Enthaltungen: ${abstentions}`;
    tally.appendChild(li);
  }

  if (!eliminated) {
    $("vote-result-emoji").textContent = "";
    $("vote-result-title").textContent = "Niemand scheidet aus";
    $("vote-result-text").textContent = top === 0
      ? "Alle haben sich enthalten."
      : leaders.length > 1 ? "Gleichstand – keine Entscheidung." : "Die Enthaltungen überwiegen.";
  } else if (eliminated.impostor) {
    $("vote-result-emoji").textContent = "";
    $("vote-result-title").textContent = `${eliminated.name} war ein Verräter!`;
    $("vote-result-text").textContent = `${eliminated.name} ist raus.`;
  } else {
    $("vote-result-emoji").textContent = "";
    $("vote-result-title").textContent = `${eliminated.name} war unschuldig!`;
    $("vote-result-text").textContent = `${eliminated.name} war kein Verräter.`;
  }
  showVoteStep("result");
}

function closeVote() {
  const v = game.vote;
  $("vote-panel").hidden = true;
  game.vote = null;
  if (!v || !v.done) return; // abgebrochen → Vote nicht verbraucht

  // Nach einem Vote muss erst wieder jeder einen Tipp abgeben
  game.sinceVote = new Set();
  const p = v.eliminated;

  if (!p) {
    addLog("Vote: niemand ist ausgeschieden.");
    renderGame();
    return;
  }

  p.out = true;
  if (!p.impostor) {
    p.result = "rausgewählt (war unschuldig)";
    addLog(`Vote: ${p.name} wurde rausgewählt – war KEIN Verräter.`);
    endGame("impostor", `${p.name} war unschuldig und wurde rausgewählt.`);
    return;
  }

  p.result = "rausgewählt";
  addLog(`Vote: ${p.name} wurde rausgewählt – war ein Verräter!`);
  if (activeImpostors().length === 0) {
    endGame("crew", "Alle Verräter wurden enttarnt.");
    return;
  }
  fixTurn();
  renderGame();
}

/* ---------- Verräter rät den Begriff ---------- */
function openGuess() {
  if (game.over) return;
  const sel = $("guess-name");
  sel.innerHTML = `<option value="">Wer bist du?</option>`;
  for (const p of activePlayers()) {
    const o = document.createElement("option");
    o.value = p.key;
    o.textContent = p.name;
    sel.appendChild(o);
  }
  $("guess-word").value = "";
  $("guess-word").type = "password";
  $("guess-panel").hidden = false;
}

function closeGuess() {
  $("guess-panel").hidden = true;
  $("guess-word").value = "";
  $("guess-name").value = "";
}

async function onGuess(e) {
  e.preventDefault();
  const key = $("guess-name").value;
  const guess = $("guess-word").value.trim();

  if (!key || !guess) {
    await showModal({ emoji: "", title: "Fehlende Angaben", text: "Bitte wähle deinen Namen und gib den Begriff ein." });
    return;
  }
  const p = game.players.find((x) => x.key === key && !x.out);
  if (!p) return;
  if (!p.impostor) {
    $("guess-word").value = "";
    await showModal({ emoji: "", title: "Nicht erlaubt", text: "Nur Verräter dürfen den Begriff raten." });
    return;
  }

  closeGuess(); // Eingabe sofort weg, damit niemand den Begriff sieht

  const correct = isCorrectGuess(guess, game.entry, !!game.category.person);
  const wasLast = activeImpostors().length === 1;
  p.out = true;
  p.result = correct ? "hat den Begriff erraten " : "hat falsch geraten";

  if (wasLast) {
    // Einziger (verbleibender) Verräter: entscheidet das ganze Spiel
    addLog(`${p.name} hat ${correct ? "richtig" : "falsch"} geraten.`);
    endGame(correct ? "impostor" : "crew", correct ? `${p.name} hat den Begriff erraten!` : `${p.name} hat den Begriff falsch geraten.`);
    return;
  }

  // Mehrere Verräter: persönlicher Sieg/Niederlage, Spiel läuft weiter, Begriff bleibt geheim
  addLog(`${p.name} hat ${correct ? "richtig" : "falsch"} geraten und ist ausgeschieden.`);
  fixTurn();
  renderGame();
  await showModal({
    emoji: correct ? "" : "",
    title: correct ? `${p.name} hat richtig geraten!` : `${p.name} lag falsch!`,
    text: (correct ? `${p.name} gewinnt persönlich` : `${p.name} hat verloren`) +
      ` und ist ausgeschieden.\nDer Begriff bleibt geheim – es sind noch ${activeImpostors().length} Verräter im Spiel.`
  });
}

/* ---------- Spielende (auf derselben Seite) ---------- */
function endGame(winner, reason) {
  game.over = true;
  const banner = $("result");
  banner.classList.remove("crew", "impostor");
  banner.classList.add(winner);
  $("end-emoji").textContent = winner === "crew" ? "" : "";
  $("end-title").textContent = winner === "crew" ? "Die Spieler gewinnen!" : "Die Verräter gewinnen!";
  $("end-reason").textContent = reason;
  $("end-word").textContent = game.word;
  $("end-category").textContent = `${game.category.icon} ${game.category.name}`;
  $("end-hint").hidden = !game.hint;
  $("end-hint").textContent = game.hint ? `Hinweis für den Verräter: ${game.hint}` : "";

  $("screen-game").classList.add("over");
  banner.hidden = false;
  renderGame();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function abortGame() {
  const ok = await showModal({
    emoji: "",
    title: "Spiel abbrechen?",
    text: "Die aktuelle Runde geht verloren.",
    ok: "Abbrechen",
    cancel: "Weiterspielen"
  });
  if (ok) {
    game = null;
    renderSetup();
    showScreen("setup");
  }
}

/* =========================================================
   Events
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  updateSteps("hub");
  renderSetup();

  document.querySelectorAll("[data-game]").forEach((b) =>
    b.addEventListener("click", () => openGameMenu(b.dataset.game))
  );
  $("menu-local").addEventListener("click", () => {
    currentMode = "local";
    if (currentGame === "werbinich") {
      WBI.openSetup();
      return;
    }
    if (currentGame === "luegen") {
      LocalSpiegel.openSetup();
      return;
    }
    renderSetup();
    showScreen("setup");
  });
  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => showScreen(b.dataset.back))
  );

  document.querySelectorAll(".stepper").forEach((s) => s.addEventListener("click", onStep));
  $("opt-hint").addEventListener("change", (e) => { settings.hint = e.target.checked; saveSettings(); });
  $("opt-wordhint").addEventListener("change", (e) => { settings.wordHint = e.target.checked; saveSettings(); });
  $("btn-start").addEventListener("click", startGame);
  $("reveal-card").addEventListener("click", onRevealTap);

  $("form-tip").addEventListener("submit", onTip);
  $("btn-vote").addEventListener("click", startVote);
  $("vote-ready").addEventListener("click", () => showVoteStep("choose"));
  $("vote-done").addEventListener("click", closeVote);
  $("vote-cancel").addEventListener("click", closeVote);

  $("btn-guess").addEventListener("click", openGuess);
  $("guess-cancel").addEventListener("click", closeGuess);
  $("form-guess").addEventListener("submit", onGuess);
  $("toggle-secret").addEventListener("click", () => {
    const w = $("guess-word");
    w.type = w.type === "password" ? "text" : "password";
  });

  $("btn-abort").addEventListener("click", abortGame);
  $("btn-again").addEventListener("click", startGame);
  $("btn-setup").addEventListener("click", () => { renderSetup(); showScreen("setup"); });
});
