"use strict";

/* =========================================================
   Zeichenfeld für „Kritzeln“
   - Koordinaten werden normalisiert (0–1) gespeichert, damit die Zeichnung
     auf jedem Gerät gleich aussieht – egal wie groß der Bildschirm ist.
   - Scharf auf Retina-Displays (devicePixelRatio), weiche Kurven durch
     Mittelpunkt-Glättung, Strichstärke folgt dem Druck des Apple Pencil.
   - Handballen-Erkennung: Es wird immer nur EIN Strich gleichzeitig
     gezeichnet. Sobald ein Stift erkannt wurde, werden Finger/Handballen
     ignoriert. Setzt der Handballen vor dem Stift auf, wird dieser Strich
     beim Aufsetzen des Stifts wieder entfernt.
   - Zoom-Sperre für den Zeichner: setzt den Zoom zurück und blockiert
     Zwei-Finger- und Doppeltipp-Zoom, solange gezeichnet wird.
   ========================================================= */
class DrawCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.ops = []; // Striche ({k:"s"}) und Füllungen ({k:"f"}) in Reihenfolge
    this.drawn = new Map(); // Strich-ID → Anzahl bereits gezeichneter Punkte
    this.input = null; // Callbacks, wenn dieses Gerät zeichnen darf
    this.tool = "pen";
    this.color = "#111111";
    this.size = 0.012; // relativ zur Breite
    this.penSeen = false; // Stift erkannt → Finger werden ignoriert
    this.active = null; // laufender Strich
    this.pending = []; // noch nicht gesendete Punkte
    this.mine = []; // eigene Op-IDs (für Rückgängig)

    this.resize = this.resize.bind(this);
    new ResizeObserver(this.resize).observe(canvas);
    this.resize();

    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
    // Kein Scrollen, keine Lupe, kein Kontextmenü auf dem Zeichenfeld
    const stop = (e) => { if (this.input) e.preventDefault(); };
    canvas.addEventListener("touchstart", stop, { passive: false });
    canvas.addEventListener("touchmove", stop, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ---------- Darstellung ---------- */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h || (w === this.canvas.width && h === this.canvas.height)) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.redraw();
  }

  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }

  clearCanvas() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.ctx.restore();
  }

  redraw() {
    this.clearCanvas();
    this.drawn.clear();
    for (const op of this.ops) this.paint(op);
  }

  paint(op) {
    if (op.k === "s") this.paintStroke(op);
    else if (op.k === "f") this.floodFill(op.x, op.y, op.c);
  }

  // Strichbreite in Pixeln, abhängig vom Druck (0–1)
  width(op, p) {
    const base = op.w * this.W;
    return Math.max(1, base * (0.35 + 1.3 * p));
  }

  // Zeichnet die noch fehlenden Teile eines Strichs (für Live-Übertragung)
  paintStroke(op) {
    const ctx = this.ctx;
    const pts = op.pts;
    const n = pts.length;
    if (!n) return;
    const from = this.drawn.get(op.id) || 0;
    ctx.strokeStyle = ctx.fillStyle = op.t === "eraser" ? "#ffffff" : op.c;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const X = (q) => q[0] * this.W;
    const Y = (q) => q[1] * this.H;

    if (n === 1) {
      ctx.beginPath();
      ctx.arc(X(pts[0]), Y(pts[0]), this.width(op, pts[0][2]) / 2, 0, Math.PI * 2);
      ctx.fill();
      this.drawn.set(op.id, 1);
      return;
    }
    // Glättung: Kurve von Mitte zu Mitte, der Punkt dazwischen ist der Kontrollpunkt
    const start = Math.max(1, from - 1);
    for (let i = start; i < n; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mx = (X(a) + X(b)) / 2;
      const my = (Y(a) + Y(b)) / 2;
      ctx.beginPath();
      if (i === 1) {
        ctx.moveTo(X(a), Y(a));
      } else {
        const z = pts[i - 2];
        ctx.moveTo((X(z) + X(a)) / 2, (Y(z) + Y(a)) / 2);
      }
      ctx.quadraticCurveTo(X(a), Y(a), mx, my);
      ctx.lineWidth = this.width(op, (a[2] + b[2]) / 2);
      ctx.stroke();
    }
    // Ende des Strichs bis zum letzten Punkt
    const a = pts[n - 2];
    const b = pts[n - 1];
    ctx.beginPath();
    ctx.moveTo((X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2);
    ctx.lineTo(X(b), Y(b));
    ctx.lineWidth = this.width(op, b[2]);
    ctx.stroke();
    this.drawn.set(op.id, n);
  }

  // Füllen mit Toleranz, damit auch kantengeglättete Ränder mitgefüllt werden
  floodFill(nx, ny, color) {
    const W = this.W;
    const H = this.H;
    const x0 = Math.min(W - 1, Math.max(0, Math.round(nx * W)));
    const y0 = Math.min(H - 1, Math.max(0, Math.round(ny * H)));
    const img = this.ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const i0 = (y0 * W + x0) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const fr = parseInt(color.slice(1, 3), 16), fg = parseInt(color.slice(3, 5), 16), fb = parseInt(color.slice(5, 7), 16);
    if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return;
    const TOL = 110;
    const match = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= TOL;
    const seen = new Uint8Array(W * H);
    const filled = [];
    const stack = [x0, y0];
    while (stack.length) {
      const y = stack.pop();
      let x = stack.pop();
      while (x >= 0 && !seen[y * W + x] && match((y * W + x) * 4)) x--;
      x++;
      let up = false;
      let down = false;
      while (x < W && !seen[y * W + x] && match((y * W + x) * 4)) {
        const p = y * W + x;
        seen[p] = 1;
        filled.push(p);
        if (y > 0) {
          const q = p - W;
          if (!seen[q] && match(q * 4)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false;
        }
        if (y < H - 1) {
          const q = p + W;
          if (!seen[q] && match(q * 4)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false;
        }
        x++;
      }
    }
    // Ein Pixel über den Rand hinaus füllen, damit keine hellen Säume bleiben
    for (const p of filled) {
      const x = p % W;
      for (const q of [p, p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H) continue;
        if (q !== p && Math.abs((q % W) - x) > 1) continue;
        const i = q * 4;
        d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /* ---------- Zeichnung von außen setzen / ergänzen ---------- */
  setOps(ops) {
    this.ops = ops.map((o) => (o.k === "s" ? { ...o, pts: o.pts.slice() } : { ...o }));
    this.mine = this.ops.map((o) => o.id).filter(Boolean);
    this.redraw();
  }

  reset() {
    this.cancelActive(false);
    this.ops = [];
    this.mine = [];
    this.redraw();
  }

  // Ereignis vom Server (Live-Übertragung des Zeichners)
  applyOp(op) {
    if (op.k === "s") {
      let s = this.ops.find((o) => o.k === "s" && o.id === op.id);
      if (!s) {
        s = { k: "s", id: op.id, c: op.c, w: op.w, t: op.t, pts: [] };
        this.ops.push(s);
      }
      s.pts.push(...op.pts);
      // Liegt nach diesem Strich schon eine Füllung, muss neu gezeichnet werden
      if (this.ops[this.ops.length - 1] === s) this.paintStroke(s);
      else this.redraw();
    } else if (op.k === "f") {
      this.ops.push(op);
      this.paint(op);
    } else if (op.k === "undo") {
      this.ops = this.ops.filter((o) => o.id !== op.id);
      this.redraw();
    } else if (op.k === "clear") {
      this.ops = [];
      this.redraw();
    }
  }

  /* ---------- Eingabe (nur für den Zeichner) ---------- */
  enable(callbacks) {
    this.input = callbacks;
    this.canvas.classList.add("drawing-enabled");
  }

  disable() {
    this.cancelActive(false);
    this.input = null;
    this.canvas.classList.remove("drawing-enabled");
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    // Nur der Stift liefert echten Druck; Maus und Finger bekommen einen mittleren Wert
    const p = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000, Math.round(p * 100) / 100];
  }

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  down(e) {
    if (!this.input) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "pen") this.penSeen = true;
    // Handballen: Sobald ein Stift benutzt wurde, zählen Finger nicht mehr
    if (e.pointerType === "touch" && this.penSeen) return;
    if (this.active) {
      // Hat der Handballen zuerst aufgesetzt, verwirft der Stift diesen Strich
      if (e.pointerType === "pen" && this.active.pointerType === "touch") this.cancelActive(true);
      else return; // immer nur ein Strich gleichzeitig
    }
    e.preventDefault();
    const p = this.pos(e);

    if (this.tool === "fill") {
      const op = { k: "f", id: this.newId(), x: p[0], y: p[1], c: this.color };
      this.ops.push(op);
      this.mine.push(op.id);
      this.paint(op);
      this.input.send(op);
      return;
    }

    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    const op = { k: "s", id: this.newId(), c: this.color, w: this.size, t: this.tool === "eraser" ? "eraser" : "pen", pts: [p] };
    this.ops.push(op);
    this.mine.push(op.id);
    this.active = { pointerId: e.pointerId, pointerType: e.pointerType, op, sent: 0 };
    this.paintStroke(op);
    this.flushTimer = setInterval(() => this.flush(), 40);
  }

  move(e) {
    const a = this.active;
    if (!a || e.pointerId !== a.pointerId) return;
    e.preventDefault();
    // Alle Zwischenpunkte nutzen (Apple Pencil liefert bis zu 240 pro Sekunde)
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = this.pos(ev);
      const last = a.op.pts[a.op.pts.length - 1];
      const dx = (p[0] - last[0]) * this.W;
      const dy = (p[1] - last[1]) * this.H;
      if (dx * dx + dy * dy < 1.5) continue; // winzige Bewegungen überspringen
      a.op.pts.push(p);
    }
    this.paintStroke(a.op);
  }

  up(e, cancelled) {
    const a = this.active;
    if (!a || e.pointerId !== a.pointerId) return;
    // Ein abgebrochener Finger-Strich (z. B. Systemgeste) wird verworfen
    if (cancelled && a.pointerType === "touch") return this.cancelActive(true);
    this.flush();
    clearInterval(this.flushTimer);
    this.active = null;
  }

  // Neue Punkte des laufenden Strichs senden
  flush() {
    const a = this.active;
    if (!a || !this.input) return;
    const pts = a.op.pts.slice(a.sent);
    if (!pts.length) return;
    a.sent = a.op.pts.length;
    this.input.send({ k: "s", id: a.op.id, c: a.op.c, w: a.op.w, t: a.op.t, pts });
  }

  cancelActive(notify) {
    const a = this.active;
    if (!a) return;
    clearInterval(this.flushTimer);
    this.active = null;
    this.ops = this.ops.filter((o) => o !== a.op);
    this.mine = this.mine.filter((id) => id !== a.op.id);
    if (notify && this.input && a.sent > 0) this.input.send({ k: "undo", id: a.op.id });
    this.redraw();
  }

  undo() {
    if (!this.input || this.active) return;
    const id = this.mine.pop();
    if (!id) return;
    this.ops = this.ops.filter((o) => o.id !== id);
    this.redraw();
    this.input.send({ k: "undo", id });
  }

  clearAll() {
    if (!this.input) return;
    this.cancelActive(false);
    this.ops = [];
    this.mine = [];
    this.redraw();
    this.input.send({ k: "clear" });
  }

  /* ---------- Zoom-Sperre für den Zeichner ---------- */
  static lockZoom() {
    if (DrawCanvas.locked) return;
    DrawCanvas.locked = true;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      DrawCanvas.viewport = meta.getAttribute("content");
      // maximum-scale=1 setzt einen bestehenden Zoom auf iOS/Android zurück
      meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    }
    document.documentElement.classList.add("zoom-locked");
    document.addEventListener("gesturestart", DrawCanvas.block, { passive: false });
    document.addEventListener("gesturechange", DrawCanvas.block, { passive: false });
    document.addEventListener("touchmove", DrawCanvas.blockPinch, { passive: false });
    document.addEventListener("dblclick", DrawCanvas.block, { passive: false });
  }

  static unlockZoom() {
    if (!DrawCanvas.locked) return;
    DrawCanvas.locked = false;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && DrawCanvas.viewport) meta.setAttribute("content", DrawCanvas.viewport);
    document.documentElement.classList.remove("zoom-locked");
    document.removeEventListener("gesturestart", DrawCanvas.block);
    document.removeEventListener("gesturechange", DrawCanvas.block);
    document.removeEventListener("touchmove", DrawCanvas.blockPinch);
    document.removeEventListener("dblclick", DrawCanvas.block);
  }

  static block(e) { e.preventDefault(); }
  static blockPinch(e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }
}
DrawCanvas.locked = false;
DrawCanvas.viewport = null;
