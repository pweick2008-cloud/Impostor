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
  { id: "schwer", name: "Schwer" },
  { id: "gemischt", name: "Gemischt" }
];

const settings = {
  names: ["", "", "", ""],
  impostors: 1,
  category: "laender",
  difficulty: "leicht",
  hint: true
};

let game = null;

const $ = (id) => document.getElementById(id);

/* =========================================================
   Hilfsfunktionen
   ========================================================= */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Vereinheitlicht Eingaben: Groß/Klein, Umlaute, Akzente, Leer- und Sonderzeichen.
function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Prüft, ob der geratene Begriff passt (inkl. Alternativen und kleinen Tippfehlern).
function isCorrectGuess(guess, entry, isPerson) {
  const g = normalize(guess);
  if (!g) return false;

  const targets = new Set();
  for (const alias of entry.split("|")) {
    targets.add(normalize(alias));
    // Bei Personen reicht der Nachname, z. B. "Einstein" für "Albert Einstein".
    const parts = alias.trim().split(/\s+/);
    if (isPerson && parts.length === 2 && normalize(parts[1]).length >= 4) {
      targets.add(normalize(parts[1]));
    }
  }

  for (const t of targets) {
    if (g === t) return true;
    const tolerance = t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0;
    if (tolerance && levenshtein(g, t) <= tolerance) return true;
  }
  return false;
}

function displayWord(entry) {
  return entry.split("|")[0];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.names)) Object.assign(settings, saved);
  } catch (e) { /* ohne Speicher geht's auch */ }
  if (!CATEGORIES[settings.category] && settings.category !== "zufall") settings.category = "laender";
  if (!DIFFICULTIES.some((d) => d.id === settings.difficulty)) settings.difficulty = "leicht";
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

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  window.scrollTo(0, 0);
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

  // Kategorien
  const cats = $("category-list");
  cats.innerHTML = "";
  const catOptions = Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: `${c.icon} ${c.name}` }));
  catOptions.push({ id: "zufall", label: "🎲 Zufällig" });
  for (const opt of catOptions) {
    cats.appendChild(makeChip(opt.label, settings.category === opt.id, () => {
      settings.category = opt.id;
      saveSettings();
      renderSetup();
    }));
  }

  // Schwierigkeit
  const diffs = $("difficulty-list");
  diffs.innerHTML = "";
  for (const d of DIFFICULTIES) {
    diffs.appendChild(makeChip(d.name, settings.difficulty === d.id, () => {
      settings.difficulty = d.id;
      saveSettings();
      renderSetup();
    }));
  }

  $("opt-hint").checked = settings.hint;
  $("setup-error").hidden = true;
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
  const catId = settings.category === "zufall" ? pick(Object.keys(CATEGORIES)) : settings.category;
  const category = CATEGORIES[catId];
  const pool = settings.difficulty === "gemischt"
    ? [...category.words.leicht, ...category.words.mittel, ...category.words.schwer]
    : category.words[settings.difficulty];
  const used = new Set(getUsedWords());
  const fresh = pool.filter((w) => !used.has(w));
  const entry = pick(fresh.length ? fresh : pool);
  rememberWord(entry);

  // Rollen verteilen
  const impostorIdx = new Set(shuffle(names.map((_, i) => i)).slice(0, settings.impostors));
  const players = names.map((name, i) => ({
    name,
    key: normalize(name),
    impostor: impostorIdx.has(i),
    out: false,
    result: null // Text zum Ausscheiden
  }));

  game = {
    players,
    entry,
    word: displayWord(entry),
    categoryId: catId,
    category,
    order: shuffle(players), // zufällige Reihenfolge beim Aufdecken
    revealIndex: 0,
    revealed: false,
    lockUntil: 0,
    log: [],
    over: false
  };

  showScreen("reveal");
  renderReveal();
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
      <span class="hand">🕵️</span>
      <span class="role-label">${escapeHtml(p.name)}, du bist</span>
      <span class="role-impostor">IMPOSTER</span>
      ${settings.hint ? `<span class="small muted">Kategorie: ${escapeHtml(game.category.icon + " " + game.category.name)}</span>` : ""}
      <span class="small muted">Lass dir nichts anmerken und finde den Begriff heraus!</span>
      <span class="next-hint">${nextText}</span>`;
  } else {
    card.classList.add("crew");
    back.innerHTML = `
      <span class="hand">✅</span>
      <span class="role-label">${escapeHtml(p.name)}, dein Begriff</span>
      <span class="role-word">${escapeHtml(game.word)}</span>
      <span class="small muted">Kategorie: ${escapeHtml(game.category.icon + " " + game.category.name)}</span>
      <span class="next-hint">${nextText}</span>`;
  }
  $("reveal-front").hidden = true;
  back.hidden = false;
}

function onRevealTap() {
  // Kurze Sperre, damit ein Doppeltipp nicht versehentlich weiterschaltet
  const now = Date.now();
  if (now < game.lockUntil) return;
  game.lockUntil = now + 450;

  if (!game.revealed) {
    game.revealed = true;
  } else {
    game.revealed = false;
    game.revealIndex++;
    if (game.revealIndex >= game.order.length) {
      startDiscussion();
      return;
    }
  }
  renderReveal();
}

/* =========================================================
   Diskussion / Abstimmung
   ========================================================= */
function startDiscussion() {
  $("reveal-back").innerHTML = ""; // Rolle nicht im DOM stehen lassen
  const starter = pick(game.players);
  $("game-starter").textContent = `${starter.name} beginnt mit dem ersten Hinweis.`;
  showScreen("game");
  renderGame();
}

const activePlayers = () => game.players.filter((p) => !p.out);
const activeImpostors = () => game.players.filter((p) => !p.out && p.impostor);

function findActive(name) {
  const key = normalize(name);
  return game.players.find((p) => p.key === key && !p.out) || null;
}

function addLog(text) {
  game.log.push(text);
}

function renderGame() {
  const wrap = $("game-players");
  wrap.innerHTML = "";
  for (const p of game.players) {
    const chip = makeChip(p.name, false, null);
    if (p.out) chip.classList.add("out");
    wrap.appendChild(chip);
  }

  const dl = $("active-players");
  dl.innerHTML = "";
  for (const p of activePlayers()) {
    const o = document.createElement("option");
    o.value = p.name;
    dl.appendChild(o);
  }

  $("game-status").textContent = `${activePlayers().length} im Spiel · ${activeImpostors().length} Imposter übrig`;

  const logEl = $("game-log");
  logEl.innerHTML = "";
  for (const entry of game.log) {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.appendChild(li);
  }
  $("log-card").hidden = game.log.length === 0;
}

async function onVote(e) {
  e.preventDefault();
  const input = $("vote-name");
  const name = input.value.trim();
  if (!name) return;

  const p = findActive(name);
  if (!p) {
    await showModal({ emoji: "❓", title: "Unbekannter Name", text: `„${name}“ ist kein aktiver Spieler.` });
    return;
  }

  const ok = await showModal({
    emoji: "🗳️",
    title: `${p.name} rauswählen?`,
    text: "Seid ihr euch sicher?",
    ok: "Ja, raus!",
    cancel: "Abbrechen"
  });
  if (!ok) return;

  input.value = "";
  p.out = true;

  if (!p.impostor) {
    p.result = "rausgewählt (war unschuldig)";
    addLog(`${p.name} wurde rausgewählt – war KEIN Imposter.`);
    endGame("impostor", `${p.name} war unschuldig und wurde rausgewählt.`);
    return;
  }

  p.result = "rausgewählt";
  addLog(`${p.name} wurde rausgewählt – war ein Imposter!`);

  if (activeImpostors().length === 0) {
    endGame("crew", "Alle Imposter wurden enttarnt.");
    return;
  }

  renderGame();
  await showModal({
    emoji: "🎯",
    title: `${p.name} war ein Imposter!`,
    text: `Es sind noch ${activeImpostors().length} Imposter im Spiel. Weiter geht's!`
  });
}

async function onGuess(e) {
  e.preventDefault();
  const nameInput = $("guess-name");
  const wordInput = $("guess-word");
  const name = nameInput.value.trim();
  const guess = wordInput.value.trim();

  if (!name || !guess) {
    await showModal({ emoji: "✍️", title: "Fehlende Angaben", text: "Bitte Spielernamen UND Begriff eingeben." });
    return;
  }

  const p = findActive(name);
  if (!p) {
    await showModal({ emoji: "❓", title: "Unbekannter Name", text: `„${name}“ ist kein aktiver Spieler.` });
    return;
  }
  if (!p.impostor) {
    wordInput.value = "";
    await showModal({ emoji: "🚫", title: "Nicht erlaubt", text: "Nur Imposter dürfen den Begriff raten." });
    return;
  }

  // Eingaben sofort löschen, damit niemand den geratenen Begriff sieht
  nameInput.value = "";
  wordInput.value = "";
  wordInput.type = "password";

  const correct = isCorrectGuess(guess, game.entry, !!game.category.person);
  const wasLast = activeImpostors().length === 1;
  p.out = true;
  p.result = correct ? "hat den Begriff erraten 🏆" : "hat falsch geraten";
  p.guessedRight = correct;

  if (wasLast) {
    // Einziger (verbleibender) Imposter: entscheidet das ganze Spiel
    if (correct) {
      addLog(`${p.name} hat den Begriff richtig erraten.`);
      endGame("impostor", `${p.name} hat den Begriff erraten!`);
    } else {
      addLog(`${p.name} hat falsch geraten und ist ausgeschieden.`);
      endGame("crew", `${p.name} hat den Begriff falsch geraten.`);
    }
    return;
  }

  // Mehrere Imposter: persönlicher Sieg/Niederlage, Spiel läuft weiter, Begriff bleibt geheim
  addLog(`${p.name} hat ${correct ? "richtig" : "falsch"} geraten und ist ausgeschieden.`);
  renderGame();
  await showModal({
    emoji: correct ? "🏆" : "💥",
    title: correct ? `${p.name} hat richtig geraten!` : `${p.name} lag falsch!`,
    text: (correct ? `${p.name} gewinnt persönlich` : `${p.name} hat verloren`) +
      ` und ist ausgeschieden.\nDer Begriff bleibt geheim – es sind noch ${activeImpostors().length} Imposter im Spiel.`
  });
}

/* =========================================================
   Spielende
   ========================================================= */
function endGame(winner, reason) {
  game.over = true;
  const banner = $("end-banner");
  banner.classList.remove("crew", "impostor");
  banner.classList.add(winner);
  $("end-emoji").textContent = winner === "crew" ? "🎉" : "🕵️";
  $("end-title").textContent = winner === "crew" ? "Die Spieler gewinnen!" : "Die Imposter gewinnen!";
  $("end-reason").textContent = reason;
  $("end-word").textContent = game.word;
  $("end-category").textContent = `${game.category.icon} ${game.category.name}`;

  const list = $("end-impostors");
  list.innerHTML = "";
  for (const p of game.players.filter((x) => x.impostor)) {
    const li = document.createElement("li");
    li.textContent = `${p.name} – ${p.result || "nicht enttarnt"}`;
    list.appendChild(li);
  }

  showScreen("end");
}

async function abortGame() {
  const ok = await showModal({
    emoji: "⚠️",
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
  renderSetup();

  document.querySelectorAll(".stepper").forEach((s) => s.addEventListener("click", onStep));
  $("opt-hint").addEventListener("change", (e) => { settings.hint = e.target.checked; saveSettings(); });
  $("btn-start").addEventListener("click", startGame);
  $("reveal-card").addEventListener("click", onRevealTap);
  $("form-vote").addEventListener("submit", onVote);
  $("form-guess").addEventListener("submit", onGuess);
  $("toggle-secret").addEventListener("click", () => {
    const w = $("guess-word");
    w.type = w.type === "password" ? "text" : "password";
  });
  $("btn-abort").addEventListener("click", abortGame);
  $("btn-again").addEventListener("click", startGame);
  $("btn-setup").addEventListener("click", () => { renderSetup(); showScreen("setup"); });
});
