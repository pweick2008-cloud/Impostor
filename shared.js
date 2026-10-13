// Gemeinsame Spiellogik für Browser (Pass & Play) und Server (Online).
"use strict";

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

// Wählt einen Begriff aus Kategorie + Schwierigkeit und meidet kürzlich gespielte Begriffe.
function pickWord(categories, categoryId, difficulty, usedWords) {
  const catId = categoryId === "zufall" || !categories[categoryId] ? pick(Object.keys(categories)) : categoryId;
  const category = categories[catId];
  const pool = difficulty === "gemischt" || !category.words[difficulty]
    ? [...category.words.leicht, ...category.words.mittel, ...category.words.schwer]
    : category.words[difficulty];
  const used = new Set(usedWords || []);
  const fresh = pool.filter((w) => !used.has(w));
  return { catId, category, entry: pick(fresh.length ? fresh : pool) };
}

if (typeof module !== "undefined") {
  module.exports = { shuffle, pick, normalize, levenshtein, isCorrectGuess, displayWord, pickWord };
}
