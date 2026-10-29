// EP recording system display: surface leads and intracardiac bipoles scrolling right to left, stimulus marks,
// optional ground-truth annotations, and a two-line caliper. Draws only; samples come from sim/signals.js.
const BG = '#04070a', GRID = '#0f1a24', TXT = '#8da0b6';
const COLORS = { ecg: '#e8eef6', hra: '#7fd3ff', his: '#ffe066', cs: '#ff9ad5', rva: '#9dff8a' };
const DT = 2; // ms per sample
const MARK = { AP: '#ff6b6b', VP: '#ff6b6b', SP: '#ffb02e', AS: '#36e2b4', VS: '#36e2b4', AR: '#8da0b6', VR: '#8da0b6' };

export class Recorder {
  /** channels: [{ id, kind, cath? }]; sample(ch, t) -> mV */
  constructor(canvas, channels, sample) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.channels = channels; this.sample = sample;
    this.window = 2500;    // ms visible (sweep speed)
    this.buf = channels.map(() => []);
    this.t0 = null;        // time of the first sample in the buffers
    this.tLast = null;     // time of the last sample
    this.marks = [];       // { t, text, color }
    this.caliper = null;   // { a, b } in ms, or null
    this.gain = { ecg: 1, egm: 1 };
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.drag = null;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => { this.drag = null; });
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = this.c.getBoundingClientRect();
    this.c.width = Math.max(1, r.width * dpr); this.c.height = Math.max(1, r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = r.width; this.h = r.height;
  }

  clear() { this.buf = this.channels.map(() => []); this.t0 = this.tLast = null; this.marks = []; }
  setChannels(channels) { this.channels = channels; this.clear(); }

  /** Add samples up to time t (ms). */
  advance(t) {
    if (this.tLast == null) { this.t0 = this.tLast = Math.floor(t / DT) * DT; }
    const keep = Math.ceil((this.window + 500) / DT);
    while (this.tLast + DT <= t) {
      this.tLast += DT;
      this.channels.forEach((ch, i) => { this.buf[i].push(ch.kind === 'marker' ? 0 : this.sample(ch, this.tLast)); });
    }
    const n = this.buf[0].length;
    if (n > keep) { const drop = n - keep; this.buf.forEach((b) => b.splice(0, drop)); this.t0 += drop * DT; }
    this.marks = this.marks.filter((m) => m.t > this.tLast - this.window - 500);
  }

  mark(t, text, color = '#ff6b6b') { this.marks.push({ t, text, color }); }

  // layout: a label column, then the traces; time runs left to right ending at tLast
  get left() { return 64; }
  xOf(t) { return this.left + ((t - (this.tLast - this.window)) / this.window) * (this.w - this.left - 8); }
  tOf(x) { return this.tLast - this.window + ((x - this.left) / (this.w - this.left - 8)) * this.window; }

  onDown(e) {
    if (!this.caliper || this.tLast == null) return;
    const r = this.c.getBoundingClientRect(), t = this.tOf(e.clientX - r.left);
    this.drag = Math.abs(t - this.caliper.a) < Math.abs(t - this.caliper.b) ? 'a' : 'b';
    this.caliper[this.drag] = t;
  }
  onMove(e) {
    if (!this.drag) return;
    const r = this.c.getBoundingClientRect();
    this.caliper[this.drag] = this.tOf(e.clientX - r.left);
  }
  toggleCaliper() {
    if (this.caliper) this.caliper = null;
    else { const m = this.tLast - this.window / 2; this.caliper = { a: m - 150, b: m + 150 }; }
    return !!this.caliper;
  }

  /** Marker channel: the pacemaker's annotations (paced, sensed, refractory sensed). */
  drawMarkers(y0, rowH, tA) {
    const { ctx } = this, log = this.markerSource?.() ?? [];
    ctx.fillStyle = TXT; ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.fillText('Markers', 8, y0 + 4);
    ctx.font = '700 11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center';
    for (const e of log) {
      if (e.t < tA || e.t > this.tLast) continue;
      const x = this.xOf(e.t), up = e.m[0] === 'A';
      ctx.fillStyle = MARK[e.m] ?? TXT;
      ctx.fillRect(x - 0.75, up ? y0 - rowH * 0.32 : y0, 1.5, rowH * 0.32);
      ctx.fillText(e.m, x, up ? y0 - rowH * 0.36 : y0 + rowH * 0.32 + 10);
    }
    ctx.textAlign = 'start';
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    if (this.tLast == null) return;
    const n = this.channels.length, top = 18, rowH = (h - top - 6) / n;
    // time grid: 100 ms lines, 500 ms stronger, with a time scale at the top
    const tA = this.tLast - this.window;
    for (let t = Math.ceil(tA / 100) * 100; t <= this.tLast; t += 100) {
      const x = this.xOf(t);
      ctx.strokeStyle = t % 500 === 0 ? '#1a2a3a' : GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.fillStyle = TXT; ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(`${this.window / 1000} s window · grid 100 ms`, this.left, 12);
    // stimulus and annotation marks
    for (const m of this.marks) {
      const x = this.xOf(m.t);
      if (x < this.left) continue;
      ctx.strokeStyle = m.color; ctx.globalAlpha = 0.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = m.color; ctx.fillText(m.text, x + 3, top + 10);
    }
    // traces
    this.channels.forEach((ch, i) => {
      const y0 = top + rowH * (i + 0.5), b = this.buf[i];
      if (ch.kind === 'marker') return this.drawMarkers(y0, rowH, tA);
      const k = (ch.kind === 'ecg' ? 0.5 : 0.42) * rowH * (ch.kind === 'ecg' ? this.gain.ecg : this.gain.egm);
      ctx.fillStyle = ch.kind === 'ecg' ? COLORS.ecg : COLORS[ch.cath]; ctx.font = '600 12px Inter, system-ui, sans-serif';
      const scale = ch.kind === 'lead' ? 0.25 : 1; // lead electrograms are in device mV (larger)
      ctx.fillText(ch.id, 8, y0 + 4);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.3; ctx.beginPath();
      const start = Math.max(0, Math.floor((tA - this.t0) / DT));
      for (let j = start; j < b.length; j++) {
        const x = this.xOf(this.t0 + j * DT), y = y0 - Math.max(-1.4, Math.min(1.4, b[j] * scale)) * k;
        j === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    // caliper
    if (this.caliper) {
      const { a, b } = this.caliper;
      ctx.strokeStyle = '#36e2b4'; ctx.lineWidth = 1.5;
      for (const t of [a, b]) { const x = this.xOf(t); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h); ctx.stroke(); }
      const xa = this.xOf(Math.min(a, b)), xb = this.xOf(Math.max(a, b));
      ctx.fillStyle = '#36e2b4'; ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillText(`${Math.round(Math.abs(b - a))} ms`, (xa + xb) / 2 - 18, top + 24);
    }
  }
}
