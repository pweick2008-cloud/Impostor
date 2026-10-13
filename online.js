"use strict";

/* =========================================================
   Online-Modus
   Der Server verwaltet Lobby, Rollen und Spielstand. Dieses Skript zeigt nur
   an, was der Server diesem Spieler schickt, und sendet seine Aktionen.
   ========================================================= */
(() => {
  const ONLINE_AVAILABLE = !window.IMPOSTER_OFFLINE_ONLY && /^https?:$/.test(location.protocol);
  const SESSION_KEY = "imposter-online-session";
  const TOKEN_KEY = "imposter-online-token";
  const NAME_KEY = "imposter-online-name";

  let ws = null;
  let state = null;
  let pending = null; // Nachricht, die nach dem Verbinden gesendet wird
  let resuming = false; // Wiederverbinden mit gespeicherter Sitzung läuft
  let retry = 0;
  let reconnectTimer = null;
  let lastScreen = null;
  let roleShown = false; // Rollenkarte aufgedeckt?
  let myRoleShown = false; // Rollen-Erinnerung in der Spielrunde aufgedeckt?

  /* ---------- Speicher ---------- */
  const store = {
    get(area, key) {
      try { return window[area].getItem(key); } catch (e) { return null; }
    },
    set(area, key, value) {
      try {
        if (value === null) window[area].removeItem(key);
        else window[area].setItem(key, value);
      } catch (e) { /* egal */ }
    }
  };

  function randomToken() {
    const bytes = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.random() * 256; });
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Ein Token pro Tab: so kann man nach Neuladen weiterspielen
  let token = store.get("sessionStorage", TOKEN_KEY);
  if (!token) {
    token = randomToken();
    store.set("sessionStorage", TOKEN_KEY, token);
  }

  function getSession() {
    try { return JSON.parse(store.get("sessionStorage", SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(s) {
    store.set("sessionStorage", SESSION_KEY, s ? JSON.stringify(s) : null);
  }

  /* ---------- Verbindung ---------- */
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(reconnectTimer);
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
    ws = new WebSocket(url);

    ws.onopen = () => {
      retry = 0;
      $("conn-banner").hidden = true;
      if (pending) {
        ws.send(JSON.stringify(pending));
        pending = null;
      } else {
        const s = getSession();
        if (s) {
          resuming = true;
          ws.send(JSON.stringify({ type: "join", code: s.code, name: s.name, token }));
        }
      }
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      handle(msg);
    };

    ws.onclose = () => {
      ws = null;
      if (getSession()) {
        $("conn-banner").hidden = false;
        retry = Math.min(retry + 1, 6);
        reconnectTimer = setTimeout(connect, 500 * 2 ** retry);
      } else if (pending) {
        pending = null;
        showError("Keine Verbindung zum Server. Bitte versuche es noch einmal.");
      }
    };
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else {
      pending = msg;
      connect();
    }
  }

  function handle(msg) {
    switch (msg.type) {
      case "state": {
        resuming = false;
        state = msg;
        const me = state.players.find((p) => p.id === state.you);
        setSession({ code: state.code, name: me ? me.name : "" });
        render();
        break;
      }
      case "error":
        if (resuming) {
          // Gespeicherte Lobby gibt es nicht mehr
          resuming = false;
          setSession(null);
          state = null;
          openOnlineHome(msg.message);
        } else if (!state) {
          showError(msg.message);
        } else {
          showModal({ emoji: "⚠️", title: "Geht gerade nicht", text: msg.message });
        }
        break;
      case "event":
        if (msg.toast) {
          showToast(msg.text);
          break;
        }
        if (msg.silent) {
          if (navigator.vibrate) navigator.vibrate(200);
          break;
        }
        showModal({
          emoji: msg.emoji,
          title: msg.title,
          text: msg.text + (msg.tally && msg.tally.length ? "\n\n" + msg.tally.join("\n") : "")
        });
        break;
      case "kicked":
        setSession(null);
        state = null;
        openOnlineHome();
        showModal({ emoji: "👋", title: "Lobby verlassen", text: msg.message });
        break;
      case "left":
        break;
    }
  }

  /* ---------- Bildschirme ---------- */
  function showError(text) {
    $("on-error").textContent = text;
    $("on-error").hidden = !text;
  }

  function openOnlineHome(error = "", invited = false) {
    currentMode = "online";
    lastScreen = "online";
    showError(error);
    $("on-create-card").hidden = invited;
    $("online-sub").textContent = invited
      ? "Du wurdest eingeladen – gib deinen Namen ein."
      : `${GAMES[currentGame].name} · Jeder auf seinem eigenen Gerät`;
    $("on-name").value = store.get("localStorage", NAME_KEY) || $("on-name").value;
    showScreen("online", "setup");
  }

  function goto(screen) {
    if (screen === lastScreen) return;
    if (screen === "o-reveal") roleShown = false;
    if (screen === "o-game") myRoleShown = false;
    lastScreen = screen;
    const phase = { lobby: "setup", "o-reveal": "reveal", "o-game": "game", "wo-assign": "assign", "wo-game": "game" }[screen];
    showScreen(screen, phase);
  }

  const isHost = () => state && state.hostId === state.you;

  function render() {
    currentMode = "online";
    currentGame = state.gameType;
    const g = state.game;
    if (g && g.inGame && g.type === "werbinich") {
      goto(WBIOnline.render(state));
    } else if (!g || !g.inGame) {
      renderLobby();
      goto("lobby");
    } else if (g.phase === "reveal") {
      renderReveal();
      goto("o-reveal");
    } else {
      renderGame();
      goto("o-game");
    }
  }

  /* ---------- Lobby ---------- */
  function renderLobby() {
    const host = isHost();
    $("lobby-code").textContent = state.code;
    $("lobby-count").textContent = `${state.players.length}/20`;

    const list = $("lobby-players");
    list.innerHTML = "";
    for (const p of state.players) {
      const li = document.createElement("li");
      li.className = "lobby-player" + (p.connected ? "" : " offline");
      li.innerHTML = `
        <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(p.name)}${p.id === state.you ? " (Du)" : ""}</span>
        ${p.id === state.hostId ? `<span class="badge host">👑 Host</span>` : ""}
        ${p.connected ? "" : `<span class="badge">offline</span>`}`;
      if (host && p.id !== state.you) {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "kick";
        kick.setAttribute("aria-label", `${p.name} entfernen`);
        kick.textContent = "✕";
        kick.addEventListener("click", async () => {
          const ok = await showModal({ emoji: "👋", title: `${p.name} entfernen?`, text: "Der Spieler wird aus der Lobby geworfen.", ok: "Entfernen", cancel: "Abbrechen" });
          if (ok) send({ type: "kick", playerId: p.id });
        });
        li.appendChild(kick);
      }
      list.appendChild(li);
    }

    // Einstellungen (nur der Host darf ändern)
    const s = state.settings;
    $("lobby-host-pill").textContent = host ? "Du bist Host" : "Nur der Host kann ändern";
    $("lobby-impostors").textContent = s.impostors;
    $("lobby-imp-stepper").classList.toggle("disabled", !host);

    const cats = $("lobby-categories");
    cats.innerHTML = "";
    const catOptions = Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: `${c.icon} ${c.name}` }));
    catOptions.push({ id: "zufall", label: "🎲 Zufällig" });
    for (const opt of catOptions) {
      cats.appendChild(makeChip(opt.label, s.category === opt.id, host ? () => updateSettings({ category: opt.id }) : null));
    }
    cats.classList.toggle("static", !host);

    const diffs = $("lobby-difficulties");
    diffs.innerHTML = "";
    for (const d of DIFFICULTIES) {
      diffs.appendChild(makeChip(d.name, s.difficulty === d.id, host ? () => updateSettings({ difficulty: d.id }) : null));
    }
    diffs.classList.toggle("static", !host);

    $("lobby-hint").checked = s.hint;
    $("lobby-hint").disabled = !host;

    $("lobby-game").textContent = `${GAMES[state.gameType].icon} ${GAMES[state.gameType].name} · Code zum Beitreten`;
    $("lobby-settings").hidden = state.gameType !== "verraeter";
    const enough = state.players.length >= state.minPlayers;
    $("lobby-start").hidden = !host;
    $("lobby-start").disabled = !enough;
    $("lobby-start").textContent = enough
      ? (state.game ? "Neue Runde starten" : "Spiel starten")
      : `Mindestens ${state.minPlayers} Spieler nötig`;
    $("lobby-wait").hidden = host;
  }

  function updateSettings(patch) {
    if (!isHost()) return;
    send({ type: "settings", settings: patch });
  }

  async function shareLink() {
    const url = `${location.origin}${location.pathname}?lobby=${state.code}`;
    const note = $("lobby-share-note");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Verräter", text: `Spiel mit! Lobby-Code: ${state.code}`, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      note.textContent = "Link kopiert!";
    } catch (e) {
      note.textContent = url;
    }
    note.hidden = false;
  }

  /* ---------- Eigene Rolle ---------- */
  function roleHtml(me, compact = false) {
    if (me.impostor) {
      return `
        <span class="hand">🕵️</span>
        <span class="role-label">Du bist</span>
        <span class="role-impostor">VERRÄTER</span>
        ${me.category ? `<span class="small muted">Kategorie: ${escapeHtml(me.category)}</span>` : ""}
        ${compact ? "" : `<span class="small muted">Lass dir nichts anmerken und finde den Begriff heraus!</span>`}`;
    }
    return `
      <span class="hand">✅</span>
      <span class="role-label">Dein Begriff</span>
      <span class="role-word">${escapeHtml(me.word)}</span>
      <span class="small muted">Kategorie: ${escapeHtml(me.category)}</span>`;
  }

  function renderReveal() {
    const g = state.game;
    const me = state.players.find((p) => p.id === state.you);
    const readyCount = g.players.filter((p) => p.ready && !p.out).length;
    const total = g.players.filter((p) => !p.out).length;
    const iAmReady = g.players.some((p) => p.id === state.you && p.ready);

    $("o-reveal-progress").textContent = `${readyCount} von ${total} bereit`;
    $("o-reveal-name").textContent = me ? me.name : "";

    const card = $("o-reveal-card");
    card.classList.remove("crew", "impostor");
    if (roleShown) {
      card.classList.add(g.me.impostor ? "impostor" : "crew");
      $("o-reveal-back").innerHTML = roleHtml(g.me) + `<span class="next-hint">Tippe erneut, um die Karte zu verdecken</span>`;
    }
    $("o-reveal-front").hidden = roleShown;
    $("o-reveal-back").hidden = !roleShown;

    const btn = $("o-ready");
    btn.disabled = iAmReady;
    btn.textContent = iAmReady ? `Warte auf die anderen … (${readyCount}/${total})` : "Ich habe meine Rolle gesehen – bereit";
    $("o-force").hidden = !isHost();
  }

  async function toggleRoleCard() {
    const card = $("o-reveal-card");
    if (card.dataset.busy) return;
    card.dataset.busy = "1";
    card.classList.add("flip-out");
    await wait(220);
    roleShown = !roleShown;
    renderReveal();
    card.classList.remove("flip-out");
    card.classList.add("flip-in");
    await wait(250);
    card.classList.remove("flip-in");
    delete card.dataset.busy;
  }

  /* ---------- Spielrunde ---------- */
  function renderGame() {
    const g = state.game;
    const host = isHost();
    const over = g.phase === "over";
    const screen = $("screen-o-game");
    const active = g.players.filter((p) => !p.out);
    const iAmActive = !g.me.out;

    screen.classList.toggle("over", over);
    $("o-sub").textContent = over ? "Das Spiel ist vorbei." : `${active.length} im Spiel · ${g.impostorsLeft} Verräter übrig`;
    $("o-status").textContent = `${active.length}/${g.players.length} aktiv`;

    // Ergebnis
    const banner = $("o-result");
    if (over) {
      const r = g.result;
      const meWon = g.me.impostor ? r.winner === "impostor" : r.winner === "crew";
      banner.classList.remove("crew", "impostor");
      banner.classList.add(r.winner);
      $("o-end-emoji").textContent = r.winner === "crew" ? "🎉" : "🕵️";
      $("o-end-title").textContent = r.winner === "crew" ? "Die Spieler gewinnen!" : "Die Verräter gewinnen!";
      $("o-end-reason").textContent = `${r.reason} ${meWon ? "Du hast gewonnen!" : "Du hast verloren."}`;
      $("o-end-word").textContent = r.word;
      $("o-end-category").textContent = r.category;
      $("o-again").hidden = !host;
      $("o-to-lobby").hidden = !host;
      $("o-wait-host").hidden = host;
      if (banner.hidden) {
        banner.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      banner.hidden = true;
    }

    // Eigene Rolle (zum Nachschauen)
    const myrole = $("o-myrole");
    myrole.classList.toggle("shown", myRoleShown);
    myrole.classList.toggle("impostor", myRoleShown && g.me.impostor);
    myrole.innerHTML = myRoleShown
      ? (g.me.impostor
        ? `<span>🕵️ Du bist <strong>Verräter</strong>${g.me.category ? ` · ${escapeHtml(g.me.category)}` : ""}</span>`
        : `<span>✅ Dein Begriff: <strong>${escapeHtml(g.me.word)}</strong></span>`) + `<span class="muted small">verdecken</span>`
      : `<span>🔒 Deine Rolle</span><span class="muted small">antippen zum Anzeigen</span>`;

    // Wer ist dran?
    const vote = g.vote;
    const turnPlayer = g.players.find((p) => p.id === g.turnId);
    const myTurn = g.turnId === state.you;
    $("o-turn-label").textContent = myTurn ? "Du bist dran!" : "Am Zug";
    $("o-turn-name").textContent = myTurn ? "Gib deinen Tipp ab" : (turnPlayer ? turnPlayer.name : "");
    $("o-tip-form").classList.toggle("mine", myTurn);
    $("o-tip-input").hidden = !myTurn || !!vote;
    $("o-tip-btn").hidden = !myTurn || !!vote;
    $("o-skip").hidden = !host || myTurn || !!vote || !turnPlayer;
    if (turnPlayer) $("o-skip").textContent = `${turnPlayer.name} überspringen (Host)`;

    // Abstimmung
    const vc = $("o-vote-card");
    vc.hidden = !g.voteUnlocked && !vote;
    const opts = $("o-vote-options");
    opts.innerHTML = "";
    opts.hidden = true;
    $("o-vote-host").hidden = !(host && vote);

    if (vote) {
      const canVote = vote.voters.includes(state.you);
      vc.classList.add("ready");
      $("o-vote-status").textContent = `läuft · ${vote.voted.length}/${vote.voters.length}`;
      $("o-vote-btn").hidden = true;
      if (canVote && !vote.myBallot) {
        $("o-vote-hint").textContent = "Wen wählst du raus? Deine Stimme ist geheim.";
        opts.hidden = false;
        for (const p of active) {
          if (p.id === state.you) continue;
          opts.appendChild(voteButton(p.name, p.id));
        }
        const ab = voteButton("Enthalten", null);
        ab.classList.add("ghost", "abstain");
        opts.appendChild(ab);
      } else if (canVote) {
        const target = g.players.find((p) => p.id === vote.myBallot);
        $("o-vote-hint").textContent = `Du hast ${target ? `für ${target.name} gestimmt` : "dich enthalten"}. Warte auf die anderen …`;
      } else {
        $("o-vote-hint").textContent = "Die anderen stimmen gerade ab …";
      }
    } else {
      vc.classList.toggle("ready", g.voteReady);
      $("o-vote-status").textContent = g.voteReady ? "bereit" : "gesperrt";
      $("o-vote-btn").hidden = !g.voteReady || !iAmActive;
      $("o-vote-hint").textContent = g.voteReady
        ? "Alle haben einen Tipp abgegeben. Ihr könnt jetzt abstimmen – oder weiter Tipps geben."
        : `Nächster Vote möglich nach ${g.tipsUntilVote} weiteren ${g.tipsUntilVote === 1 ? "Tipp" : "Tipps"}.`;
    }

    // Profile
    const wrap = $("o-profiles");
    wrap.innerHTML = "";
    for (const p of g.players) {
      const el = document.createElement("div");
      el.className = "profile";
      let badge = "";
      if (over) {
        el.classList.add(p.role === "impostor" ? "role-imp" : "role-crew");
        if (p.out) el.classList.add("out");
        badge = p.role === "impostor" ? "Verräter" : "Spieler";
      } else if (p.out) {
        el.classList.add("out");
        badge = "Raus";
      } else if (vote) {
        badge = vote.voted.includes(p.id) ? "✓ gestimmt" : "stimmt ab …";
        if (vote.voted.includes(p.id)) el.classList.add("tipped");
      } else if (p.id === g.turnId) {
        el.classList.add("current");
        badge = "Am Zug";
      } else if (p.tipped) {
        el.classList.add("tipped");
        badge = "✓ Tipp";
      }
      if (p.id === state.you) el.classList.add("me");
      const tips = p.tips.length
        ? `<ol class="tips">${p.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol>`
        : `<p class="tips-empty">Noch kein Tipp</p>`;
      const note = over && p.result ? `<p class="profile-note">${escapeHtml(p.result)}</p>` : "";
      el.innerHTML = `
        <div class="profile-head">
          <span class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
          <span class="profile-name">${escapeHtml(p.name)}${p.id === state.you ? " (Du)" : ""}</span>
          ${p.connected ? "" : `<span class="dot-offline" title="offline"></span>`}
          ${badge ? `<span class="badge">${badge}</span>` : ""}
        </div>
        ${tips}${note}`;
      wrap.appendChild(el);
    }

    // Begriff raten: nur für aktive Verräter sichtbar
    $("o-guess").hidden = over || !g.me.impostor || g.me.out;
    if ($("o-guess").hidden) $("o-guess-panel").hidden = true;

    // Verlauf
    const logEl = $("o-log");
    logEl.innerHTML = "";
    for (const entry of g.log) {
      const li = document.createElement("li");
      li.textContent = entry;
      logEl.appendChild(li);
    }
    $("o-log-card").hidden = g.log.length === 0;
    $("o-end").hidden = !host || over;
  }

  function voteButton(label, target) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn vote-option";
    b.textContent = label;
    b.addEventListener("click", async () => {
      const ok = await showModal({
        emoji: "🗳️",
        title: target ? `Für ${label} stimmen?` : "Enthalten?",
        text: "Deine Stimme kann danach nicht mehr geändert werden.",
        ok: "Ja",
        cancel: "Abbrechen"
      });
      if (ok) send({ type: "ballot", target });
    });
    return b;
  }

  async function confirmHost(title, text, type) {
    const ok = await showModal({ emoji: "👑", title, text, ok: "Ja", cancel: "Abbrechen" });
    if (ok) send({ type });
  }

  async function leaveLobby() {
    const inGame = state && state.game && state.game.phase !== "over" && state.game.inGame;
    const ok = await showModal({
      emoji: "🚪",
      title: "Lobby verlassen?",
      text: inGame ? "Du scheidest aus dem laufenden Spiel aus." : "Du kannst mit dem Code wieder beitreten.",
      ok: "Verlassen",
      cancel: "Bleiben"
    });
    if (!ok) return;
    setSession(null);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "leave" }));
    state = null;
    lastScreen = "menu";
    $("conn-banner").hidden = true;
    showScreen("menu");
  }

  /* ---------- Start ---------- */
  function startOnline(action) {
    const name = $("on-name").value.trim();
    if (!normalize(name)) {
      showError("Bitte gib zuerst deinen Namen ein.");
      $("on-name").focus();
      return;
    }
    store.set("localStorage", NAME_KEY, name);
    showError("");
    send({ ...action, name, token });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!ONLINE_AVAILABLE) {
      $("menu-online").classList.add("disabled");
      $("menu-online-note").textContent = "Online spielen geht nur, wenn die Seite über den Spiele-Server geöffnet wird (siehe Anleitung im README).";
    }

    $("menu-online").addEventListener("click", () => {
      if (!ONLINE_AVAILABLE) {
        $("menu-online-note").hidden = false;
        return;
      }
      if (getSession()) {
        currentMode = "online";
        connect();
      } else {
        openOnlineHome();
      }
    });

    $("on-create").addEventListener("click", () => startOnline({ type: "create", gameType: currentGame, settings: { ...settings } }));
    $("on-join-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const code = $("on-code").value.trim().toUpperCase();
      if (code.length !== 4) {
        showError("Der Lobby-Code hat 4 Buchstaben.");
        return;
      }
      startOnline({ type: "join", code });
    });
    $("on-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

    // Lobby
    $("lobby-share").addEventListener("click", shareLink);
    $("lobby-imp-stepper").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dir]");
      if (!btn || !isHost()) return;
      updateSettings({ impostors: state.settings.impostors + Number(btn.dataset.dir) });
    });
    $("lobby-hint").addEventListener("change", (e) => updateSettings({ hint: e.target.checked }));
    $("lobby-start").addEventListener("click", () => send({ type: "start" }));
    $("lobby-leave").addEventListener("click", leaveLobby);

    // Rolle
    $("o-reveal-card").addEventListener("click", toggleRoleCard);
    $("o-ready").addEventListener("click", () => send({ type: "ready" }));
    $("o-force").addEventListener("click", () => confirmHost("Spiel starten?", "Es wird nicht mehr gewartet, bis alle bereit sind.", "forcePlay"));

    // Spielrunde
    $("o-myrole").addEventListener("click", () => { myRoleShown = !myRoleShown; renderGame(); });
    $("o-tip-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("o-tip-input");
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      send({ type: "tip", text });
      input.value = "";
    });
    $("o-skip").addEventListener("click", () => confirmHost("Spieler überspringen?", "Der Spieler am Zug gibt in dieser Runde keinen Tipp ab.", "skipTurn"));
    $("o-vote-btn").addEventListener("click", () => send({ type: "startVote" }));
    $("o-vote-finish").addEventListener("click", () => confirmHost("Jetzt auswerten?", "Wer noch nicht abgestimmt hat, zählt als Enthaltung.", "finishVote"));
    $("o-vote-cancel").addEventListener("click", () => confirmHost("Abstimmung abbrechen?", "Der Vote wird nicht gezählt und kann neu gestartet werden.", "cancelVote"));
    $("o-guess").addEventListener("click", () => {
      $("o-guess-word").value = "";
      $("o-guess-panel").hidden = false;
      $("o-guess-word").focus();
    });
    $("o-guess-cancel").addEventListener("click", () => { $("o-guess-panel").hidden = true; });
    $("o-guess-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const word = $("o-guess-word").value.trim();
      if (!word) return;
      const ok = await showModal({ emoji: "🕵️", title: `„${word}“ raten?`, text: "Danach bist du in jedem Fall ausgeschieden.", ok: "Raten", cancel: "Abbrechen" });
      if (!ok) return;
      $("o-guess-panel").hidden = true;
      $("o-guess-word").value = "";
      send({ type: "guess", word });
    });
    $("o-end").addEventListener("click", () => confirmHost("Spiel beenden?", "Alle kehren in die Lobby zurück.", "endGame"));
    $("o-again").addEventListener("click", () => send({ type: "start" }));
    $("o-to-lobby").addEventListener("click", () => send({ type: "endGame" }));
    $("o-leave").addEventListener("click", leaveLobby);

    if (!ONLINE_AVAILABLE) return;

    // Einladungslink (?lobby=CODE) oder laufende Sitzung nach Neuladen
    const params = new URLSearchParams(location.search);
    const invite = (params.get("lobby") || "").toUpperCase().slice(0, 4);
    if (getSession()) {
      currentMode = "online";
      connect();
    } else if (invite) {
      openOnlineHome("", true);
      $("on-code").value = invite;
    }
  });
  // Für Wer bin ich? (wbi-online.js)
  window.Online = { send, isHost, leaveLobby, confirmHost, getState: () => state };
})();
