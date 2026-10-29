// Event-driven excitable graph: activation, refractoriness with restitution, decremental AV nodal conduction,
// concealed conduction, automaticity with overdrive suppression, and pacing capture (strength-duration).
// Pure logic, deterministic, no DOM. Times in ms.
import { REGIONS, TISSUE, SUBSTRATES, buildEdges } from './regions.js';

const LOGGED = new Set(['avn', 'his', 'bb', 'ap', 'sa']); // blocks worth showing in the ground-truth log

/** Pacing threshold (mA) at a pulse width (ms): Lapicque/Weiss strength-duration, rheobase * (1 + chronaxie / PW). */
export const threshold = (rheobase, chronaxie, pw) => rheobase * (1 + chronaxie / pw);

export class Heart {
  /** @param {string} substrate key of SUBSTRATES */
  constructor(substrate = 'normal') {
    const sub = SUBSTRATES[substrate];
    if (!sub) throw new Error(`unknown substrate ${substrate}`);
    this.substrate = substrate;
    this.nodes = {};
    for (const r of REGIONS) {
      // every heart starts from the normal one (e.g. a slow pathway that does not support reentry), then its own patch
      const patch = { ...SUBSTRATES.normal.patch[r.id], ...sub.patch[r.id] };
      this.nodes[r.id] = {
        ...TISSUE[r.tissue], ...r, suppress: r.tissue === 'sa' ? 350 : 0, ...patch,
        lastAct: -Infinity, lastExit: -Infinity, prevDI: 1000, refr: 0, gen: 0, driven: 0, from: null,
        hist: [], // recent activations { t, tt, refr, src } for the signal layer
      };
    }
    this.adj = buildEdges(REGIONS);
    this.q = [];        // pending events, sorted by t
    this.log = [];      // ground truth: { t, id, kind: act|block|conceal|stim|capture|nocapture, src }
    this.t = 0;
    for (const n of Object.values(this.nodes)) if (n.auto && !n.off) this.scheduleFire(n, 0, n.id === 'sa' ? 0 : n.auto);
  }

  push(ev) {
    let i = this.q.length;
    while (i > 0 && this.q[i - 1].t > ev.t) i--;
    this.q.splice(i, 0, ev);
  }

  scheduleFire(n, t, delay = n.auto) { n.gen++; this.push({ t: t + delay, kind: 'fire', id: n.id, gen: n.gen }); }

  /** Advance the simulation to time tEnd (ms), processing every event up to it. */
  step(tEnd) {
    while (this.q.length && this.q[0].t <= tEnd) {
      const ev = this.q.shift();
      this.t = ev.t;
      if (ev.kind === 'fire') { const n = this.nodes[ev.id]; if (ev.gen === n.gen) this.excite(n, ev.t, 'auto'); }
      else if (ev.kind === 'arrive') this.excite(this.nodes[ev.id], ev.t, ev.from);
      else if (ev.kind === 'stim') this.applyStim(ev);
    }
    this.t = Math.max(this.t, tEnd);
  }

  /** Recovery state of a region at time t. */
  recovery(n, t) {
    const rp = t - (n.fromExit ? n.lastExit : n.lastAct);
    return { rp, refr: n.refr, di: rp - n.refr };
  }

  /** A wave (or the region's own automaticity, src 'auto', or a captured stimulus, src 'stim') reaches region n at t. */
  excite(n, t, src) {
    if (n.off) return false;
    if (n.blockFrom?.includes(src)) return false; // unidirectional block (e.g. a retrograde-only pathway)
    const { rp, di } = this.recovery(n, t);
    if (di < 0) {
      // still refractory. In the AV node a late-arriving impulse penetrates partway and resets recovery (concealed conduction)
      if (n.tissue === 'avn' && rp > 0.6 * n.refr) { n.lastExit = t; this.log.push({ t, id: n.id, kind: 'conceal', src }); }
      else if (LOGGED.has(n.tissue) && rp > 30) this.log.push({ t, id: n.id, kind: 'block', src });
      return false;
    }
    // activation
    const slow = 1 + n.decA * Math.exp(-di / n.decTau);
    const tt = n.tt * slow;
    n.prevDI = Math.min(di, 2000);
    n.refr = n.erp0 * (1 - n.erpA * Math.exp(-n.prevDI / n.erpTau));
    n.lastAct = t; n.lastExit = t + tt; n.from = src;
    this.log.push({ t, id: n.id, kind: 'act', src, tt, refr: n.refr });
    n.hist.push({ t, tt, refr: n.refr, src }); if (n.hist.length > 8) n.hist.shift();
    for (const e of this.adj[n.id]) if (e.to !== src) this.push({ t: t + tt + e.ms, kind: 'arrive', id: e.to, from: n.id });
    if (n.auto) {
      // automatic regions are reset by any activation; being driven faster than their own rate suppresses them (overdrive suppression)
      n.driven = src !== 'auto' && rp < n.auto ? Math.min(n.driven + 1, 30) : 0;
      const extra = n.driven >= 3 ? n.suppress * Math.min(1, n.driven / 30) : 0;
      this.scheduleFire(n, t, n.auto + extra);
    }
    return true;
  }

  /**
   * Deliver a pacing stimulus to region id at time t. Captures if the region is recovered and the output
   * exceeds the threshold, which rises steeply near the end of refractoriness.
   */
  stim(t, id, { mA = 2, pw = 2, pos = null } = {}) { this.push({ t, kind: 'stim', id, mA, pw, pos }); }

  applyStim({ t, id, mA, pw, pos }) {
    const n = this.nodes[id];
    this.log.push({ t, id, kind: 'stim', mA, pw, pos });
    if (!n || n.off) { this.log.push({ t, id, kind: 'nocapture', why: 'no excitable tissue' }); return; }
    const { di } = this.recovery(n, t);
    const thr = threshold(n.thr, n.chronaxie, pw) * (di > 0 ? 1 + 4 * Math.exp(-di / 15) : Infinity);
    if (mA >= thr && this.excite(n, t, 'stim')) this.log.push({ t, id, kind: 'capture', thr });
    else this.log.push({ t, id, kind: 'nocapture', why: di <= 0 ? 'refractory' : 'below threshold', thr });
  }

  /** Activation times of one region (ascending). */
  acts(id, since = -Infinity) { return this.log.filter((e) => e.kind === 'act' && e.id === id && e.t >= since).map((e) => e.t); }

  /** Drop log entries older than t (ms) to keep long sessions light. */
  trim(t) { if (this.log.length > 4000) this.log = this.log.filter((e) => e.t >= t); }
}
