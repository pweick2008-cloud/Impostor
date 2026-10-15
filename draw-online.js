"use strict";

/* =========================================================
   Kritzeln – Online (2 bis 20 Spieler)
   Reihum zeichnet einer, die anderen raten im Chat.
   ========================================================= */
const DrawOnline = (() => {
  const COLORS = [
    "#111111", "#7a7a7a", "#c8c8c8", "#ffffff", "#e53935", "#f06292", "#fb8c00", "#fdd835", "#ffcc80",
    "#6d4c41", "#43a047", "#9ccc65", "#00897b", "#1e88e5", "#81d4fa", "#3949ab", "#8e24aa", "#b39ddb"
  ];
  const SIZES = [0.004, 0.009, 0.016, 0.03];
  const TIMES = [60, 80, 100, 120, 150];

  let state = null;
  let canvas = null;
  let currentKey = null;
  let clockTimer = null;
  let clockOffset = 0;
  let chatCount = 0;

  const g = () => state.game;
  const isHost = () => Online.isHost();
  const name = (id) => (g().players.find((p) => p.id === id) || {}).name || "";

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = new DrawCanvas($("draw-canvas"));
    buildToolbar();
    return canvas;
  }

  /* ---------- Lobby-Einstellungen ---------- */
  function renderLobbySettings(s) {
    state = s;
    const host = isHost();
    const st = s.drawSettings;
    $("draw-host-pill").textContent = host ? "Du bist Host" : "Nur der Host kann ändern";
    const times = $("draw-times");
    times.innerHTML = "";
    for (const t of TIMES) times.appendChild(makeChip(`${t} s`, st.time === t, host ? () => sendSettings({ time: t }) : null));
    times.classList.toggle("static", !host);
    $("draw-rounds").textContent = st.rounds;
    $("draw-rounds-stepper").classList.toggle("disabled", !host);
  }

  function sendSettings(settings) {
    Online.send({ type: "drSettings", settings });
  }

  /* ---------- Werkzeugleiste ---------- */
  function buildToolbar() {
    const colors = $("draw-colors");
    colors.innerHTML = "";
    for (const c of COLORS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "draw-color";
      b.style.background = c;
      b.dataset.color = c;
      b.setAttribute("aria-label", `Farbe ${c}`);
      b.addEventListener("click", () => {
        canvas.color = c;
        if (canvas.tool === "eraser") canvas.tool = "pen";
        updateToolbar();
      });
      colors.appendChild(b);
    }
    const sizes = $("draw-sizes");
    sizes.innerHTML = "";
    SIZES.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "draw-size";
      b.dataset.size = s;
      b.setAttribute("aria-label", `Strichstärke ${i + 1}`);
      b.innerHTML = `<span style="width:${6 + i * 6}px;height:${6 + i * 6}px"></span>`;
      b.addEventListener("click", () => { canvas.size = s; updateToolbar(); });
      sizes.appendChild(b);
    });
    canvas.size = SIZES[1];
    document.querySelectorAll("[data-tool]").forEach((b) =>
      b.addEventListener("click", () => { canvas.tool = b.dataset.tool; updateToolbar(); }));
    $("draw-undo").addEventListener("click", () => canvas.undo());
    $("draw-clear").addEventListener("click", async () => {
      const ok = await showModal({ emoji: "", title: "Alles löschen?", text: "Die ganze Zeichnung wird geleert.", ok: "Leeren", cancel: "Abbrechen" });
      if (ok) canvas.clearAll();
    });
    updateToolbar();
  }

  function updateToolbar() {
    document.querySelectorAll(".draw-color").forEach((b) => b.classList.toggle("selected", b.dataset.color === canvas.color && canvas.tool !== "eraser"));
    document.querySelectorAll(".draw-size").forEach((b) => b.classList.toggle("selected", Number(b.dataset.size) === canvas.size));
    document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("selected", b.dataset.tool === canvas.tool));
    $("draw-size-dot").style.background = canvas.tool === "eraser" ? "#ffffff" : canvas.color;
  }

  /* ---------- Spiel ---------- */
  function render(s) {
    state = s;
    ensureCanvas();
    const game = g();
    const me = state.you;
    const drawer = game.drawer === me;
    const over = game.phase === "over";

    // Neuer Zug → Zeichenfläche leeren und vollständigen Stand holen
    if (game.turnKey !== currentKey) {
      currentKey = game.turnKey;
      canvas.reset();
      Online.send({ type: "drSync" });
    }

    // Nur der Zeichner zeichnet – und nur bei ihm wird der Zoom gesperrt
    const canDraw = drawer && game.phase === "draw";
    if (canDraw) {
      if (!canvas.input) canvas.enable({ send: (op) => Online.send({ type: "drOp", op }) });
      DrawCanvas.lockZoom();
    } else {
      canvas.disable();
      DrawCanvas.unlockZoom();
    }
    $("screen-draw-game").classList.toggle("is-drawer", canDraw);
    $("screen-draw-game").classList.toggle("over", over);
    $("draw-tools").hidden = !canDraw;

    // Kopfzeile: Runde, Wort, Zeit
    $("draw-round").textContent = over ? "Ende" : `Runde ${game.round}/${game.rounds}`;
    const word = $("draw-word");
    word.classList.remove("mask");
    if (game.phase === "choose") {
      word.textContent = drawer ? "Wähle ein Wort" : `${name(game.drawer)} wählt …`;
    } else if (game.phase === "draw" || game.phase === "turnEnd") {
      if (game.word) {
        word.textContent = game.word;
      } else {
        word.textContent = game.mask;
        word.classList.add("mask");
      }
    } else {
      word.textContent = "Spiel vorbei";
    }
    $("draw-word-info").textContent = game.phase === "draw" && !game.word ? `${game.wordLength} Buchstaben` : drawer && game.phase === "draw" ? "Du zeichnest" : "";

    clockOffset = game.now - Date.now();
    if (game.endsAt && !over) startClock();
    else stopClock();

    renderPlayers();
    renderOverlay();
    renderChat();

    // Raten / Chat
    const input = $("draw-guess");
    const drawerWriting = drawer && game.phase === "draw";
    input.disabled = drawerWriting || over;
    input.placeholder = drawerWriting
      ? "Du zeichnest – raten tun die anderen"
      : game.phase === "draw" && !game.word ? "Rate hier das Wort …" : "Nachricht schreiben …";

    $("draw-skip").hidden = !isHost() || !(game.phase === "draw" || game.phase === "choose");
    $("draw-result").hidden = !over;
    if (over) renderFinal();
    return "draw-game";
  }

  function renderPlayers() {
    const game = g();
    const list = $("draw-players");
    list.innerHTML = "";
    const ranked = game.players.filter((p) => !p.left).slice().sort((a, b) => b.score - a.score);
    for (const p of ranked) {
      const li = document.createElement("li");
      const guessed = game.guessed.includes(p.id);
      li.className = "draw-player" + (p.id === game.drawer ? " drawer" : "") + (guessed ? " guessed" : "") + (p.id === state.you ? " me" : "") + (p.connected ? "" : " offline");
      li.innerHTML = `<span class="draw-player-name"></span><span class="draw-player-score">${p.score}</span>`;
      li.querySelector(".draw-player-name").textContent = p.name + (p.id === game.drawer ? " · zeichnet" : guessed ? " · erraten" : "");
      list.appendChild(li);
    }
  }

  function renderOverlay() {
    const game = g();
    const box = $("draw-overlay");
    const drawer = game.drawer === state.you;
    box.innerHTML = "";
    box.hidden = true;

    if (game.phase === "choose") {
      box.hidden = false;
      if (drawer && game.choices) {
        box.innerHTML = `<span class="role-label">Du bist dran</span><h2>Was willst du zeichnen?</h2><div class="draw-choices"></div><span class="muted small">Nach 15 Sekunden wird automatisch gewählt.</span>`;
        const wrap = box.querySelector(".draw-choices");
        game.choices.forEach((w, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn primary";
          b.textContent = w;
          b.addEventListener("click", () => Online.send({ type: "drChoose", index: i }));
          wrap.appendChild(b);
        });
      } else {
        box.innerHTML = `<span class="role-label">Gleich geht's los</span><h2></h2><span class="muted small">Gleich wird gezeichnet – mach dich bereit zum Raten.</span>`;
        box.querySelector("h2").textContent = `${name(game.drawer)} sucht ein Wort aus …`;
      }
    } else if (game.phase === "turnEnd") {
      box.hidden = false;
      const pts = game.turnPoints || {};
      const rows = game.players
        .filter((p) => !p.left)
        .sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0))
        .map((p) => `<li><span>${escapeHtml(p.name)}${p.id === game.drawer ? " (Zeichner)" : ""}</span><strong>+${pts[p.id] || 0}</strong></li>`)
        .join("");
      box.innerHTML = `<span class="role-label"></span><h2></h2><ul class="draw-turn-points">${rows}</ul>`;
      box.querySelector(".role-label").textContent = game.turnReason || "Zug vorbei";
      box.querySelector("h2").textContent = game.word ? `Das Wort war „${game.word}“` : "Kein Wort gewählt";
    }
  }

  function renderChat() {
    const game = g();
    const log = $("draw-chat");
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.innerHTML = "";
    for (const m of game.chat) {
      const li = document.createElement("li");
      li.className = `chat-${m.kind}`;
      if (m.kind === "msg") {
        const b = document.createElement("strong");
        b.textContent = m.name + ": ";
        li.appendChild(b);
        li.appendChild(document.createTextNode(m.text));
      } else {
        li.textContent = m.text;
      }
      log.appendChild(li);
    }
    if (atBottom || game.chat.length !== chatCount) log.scrollTop = log.scrollHeight;
    chatCount = game.chat.length;
  }

  function renderFinal() {
    const game = g();
    const ranked = game.players.slice().sort((a, b) => b.score - a.score);
    const list = $("draw-final");
    list.innerHTML = "";
    let place = 0;
    let prev = null;
    ranked.forEach((p, i) => {
      if (p.score !== prev) place = i + 1;
      prev = p.score;
      const li = document.createElement("li");
      li.className = "slf-rank" + (p.id === state.you ? " me" : "") + (place === 1 ? " first" : "");
      li.innerHTML = `<span class="slf-place">${place}.</span><span class="slf-rank-name"></span><span></span><span class="slf-total">${p.score}</span>`;
      li.querySelector(".slf-rank-name").textContent = p.name + (p.id === state.you ? " (Du)" : "");
      list.appendChild(li);
    });
    $("draw-over-reason").textContent = game.overReason || "";
    $("draw-again").hidden = !isHost();
    $("draw-to-lobby").hidden = !isHost();
    $("draw-wait-host").hidden = isHost();
  }

  function startClock() {
    stopClock();
    const tick = () => {
      const left = Math.max(0, Math.ceil((g().endsAt - (Date.now() + clockOffset)) / 1000));
      $("draw-timer").textContent = left;
      $("draw-timer").classList.toggle("urgent", g().phase === "draw" && left <= 10);
    };
    tick();
    clockTimer = setInterval(tick, 250);
  }

  function stopClock() {
    clearInterval(clockTimer);
    $("draw-timer").textContent = "";
  }

  /* ---------- Nachrichten vom Server ---------- */
  function handleMessage(msg) {
    if (!canvas) return;
    if (msg.type === "drawOp" && msg.key === currentKey) canvas.applyOp(msg.op);
    if (msg.type === "drawSync" && msg.key === currentKey) canvas.setOps(msg.ops);
  }

  // Nach einem Verbindungsabbruch die Zeichnung neu holen
  function onReconnect() {
    currentKey = null;
  }

  // Beim Verlassen des Spiels Zoom wieder freigeben
  function release() {
    if (canvas) canvas.disable();
    DrawCanvas.unlockZoom();
    stopClock();
  }

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("draw-rounds-stepper").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dir]");
      if (!b || !isHost()) return;
      sendSettings({ rounds: Math.min(10, Math.max(1, state.drawSettings.rounds + Number(b.dataset.dir))) });
    });
    $("draw-chat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("draw-guess");
      const text = input.value.trim();
      if (!text) return;
      Online.send({ type: "drGuess", text });
      input.value = "";
    });
    $("draw-skip").addEventListener("click", () =>
      Online.confirmHost("Zug überspringen?", "Der aktuelle Zug endet sofort.", "drSkip"));
    $("draw-again").addEventListener("click", () => Online.send({ type: "start" }));
    $("draw-to-lobby").addEventListener("click", () => Online.send({ type: "endGame" }));
    $("draw-leave").addEventListener("click", () => Online.leaveLobby());
  });

  return { render, renderLobbySettings, handleMessage, onReconnect, release };
})();
