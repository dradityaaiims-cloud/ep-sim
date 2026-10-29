// Schematic recordings computed from the heart's activation state. Pure, no DOM.
// Surface ECG: each region is a step of "depolarised" state from activation to repolarisation, weighted by its
// position along the lead axis (a crude equivalent-source model; no torso). Intracardiac bipoles: a sharp
// biphasic deflection at each nearby region's local activation, decaying with distance, plus a small broad
// far-field from distant ventricle. Both are teaching approximations and are labelled so in the app.
import { REGIONS, TISSUE } from './regions.js';
import { Heart } from './heart.js';

// lead axes in the patient frame (x left, y superior, z anterior)
export const LEADS = {
  I: [1, 0, 0],
  II: [0.5, -0.866, 0],
  aVF: [0, -1, 0],
  V1: [-0.55, 0, 0.83],
  V6: [0.95, -0.2, -0.25],
};
const ATRIAL = new Set(['sa', 'atrium']), VENTR = new Set(['vent']);
const sig = (x) => 1 / (1 + Math.exp(-x));
const massOf = (r) => r.mass ?? TISSUE[r.tissue].mass;
const centroid = (set) => {
  const rs = REGIONS.filter((r) => set.has(r.tissue)), c = [0, 0, 0];
  const M = rs.reduce((s, r) => s + massOf(r), 0);
  for (const r of rs) for (let i = 0; i < 3; i++) c[i] += (r.pos[i] * massOf(r)) / M;
  return c;
};
const CA = centroid(ATRIAL), CV = centroid(VENTR);

// repolarisation: regions activated late repolarise early (APD-activation time coupling), which makes the
// normal T wave concordant. The offsets are set once from a normal sinus beat.
const APD_OFF = (() => {
  const h = new Heart('normal'); h.step(1000);
  const v = REGIONS.filter((r) => r.tissue === 'vent').map((r) => [r.id, h.nodes[r.id].hist[0].t]);
  const mean = v.reduce((s, [, t]) => s + t, 0) / v.length;
  return Object.fromEntries(v.map(([id, t]) => [id, -1.25 * (t - mean)]));
})();

/** Each region's contribution to the heart vector (x, y, z) per unit of depolarised state. */
const W3 = REGIONS.map((r) => {
  const m = massOf(r);
  if (!m) return null;
  const c = ATRIAL.has(r.tissue) ? CA : CV, g = ATRIAL.has(r.tissue) ? 0.3 : 1;
  return [0, 1, 2].map((i) => -g * m * (r.pos[i] - c[i]));
});

/** Depolarised state (0..1) of a region at time t from its last activation before t. */
function state(n, t) {
  const a = n.hist.findLast((e) => e.t <= t + 40);
  if (!a) return 0;
  const vent = n.tissue === 'vent';
  const up = vent ? 7 : 9, down = vent ? 28 : 60;
  const r = a.t + a.refr + (vent ? 20 + (APD_OFF[n.id] ?? 0) : 0);
  return sig((t - a.t - a.tt / 2) / up) - sig((t - r) / down);
}

/** Heart vector (arbitrary units) at time t. */
function dipole(heart, t, only) {
  const d = [0, 0, 0];
  for (let i = 0; i < REGIONS.length; i++) {
    const w = W3[i];
    if (!w || (only && !only.has(REGIONS[i].tissue))) continue;
    const v = state(heart.nodes[REGIONS[i].id], t);
    if (v) { d[0] += w[0] * v; d[1] += w[1] * v; d[2] += w[2] * v; }
  }
  return d;
}

// Calibration (a teaching shortcut, stated on the Model page): the coarse region graph gets the activation
// sequence right but not the exact body-surface geometry, so the ventricular frontal plane is rotated once so
// that the normal sinus mean QRS axis is +60 degrees, and the atrial and ventricular parts are scaled so that the
// normal P wave and R wave in lead II are about 0.15 and 1.2 mV.
const CAL = (() => {
  const h = new Heart('normal'); h.step(1200);
  const v0 = Math.min(...REGIONS.filter((r) => r.tissue === 'vent').map((r) => h.nodes[r.id].hist[0].t));
  const M = [0, 0, 0];
  for (let t = v0 - 10; t < v0 + 120; t++) { const d = dipole(h, t, VENTR); for (let i = 0; i < 3; i++) M[i] += d[i]; }
  const rot = (60 * Math.PI) / 180 - Math.atan2(-M[1], M[0]);
  const cal = { c: Math.cos(rot), s: Math.sin(rot), kv: 1, ka: 1 };
  let r = 0, p = 0;
  for (let t = v0 - 10; t < v0 + 120; t++) r = Math.max(r, project(dipole(h, t, VENTR), LEADS.II, cal, true));
  for (let t = 0; t < v0; t++) p = Math.max(p, project(dipole(h, t, ATRIAL), LEADS.II, cal, false));
  cal.kv = 1.2 / r; cal.ka = 0.15 / p;
  return cal;
})();
/** Project a heart vector on a lead; the ventricular part has its frontal plane (x, y) rotated by the calibration. */
function project(d, L, cal, vent) {
  let [x, y] = d;
  if (vent) [x, y] = [cal.c * d[0] + cal.s * d[1], -cal.s * d[0] + cal.c * d[1]];
  return (vent ? cal.kv : cal.ka) * (x * L[0] + y * L[1] + d[2] * L[2]);
}

/** Surface lead voltage (mV) at time t. */
export function ecg(heart, lead, t) {
  const L = LEADS[lead];
  return project(dipole(heart, t, ATRIAL), L, CAL, false) + project(dipole(heart, t, VENTR), L, CAL, true) + stimArtifact(heart, t, 0.6);
}

// how strongly a bipole sees each tissue's local activation
const EGM_GAIN = { sa: 0.2, atrium: 1, avn: 0, his: 1.1, bb: 0.3, vent: 1.4, ap: 0.25 };
const NEAR = 0.9, FAR = 3.5; // cm decay lengths

/** Bipolar electrogram (mV) at electrode midpoint `pos` (cm) at time t. */
export function egm(heart, pos, t) {
  let v = 0;
  for (const r of REGIONS) {
    const n = heart.nodes[r.id], gain = EGM_GAIN[r.tissue];
    if (!gain || n.off) continue;
    const d = Math.hypot(pos[0] - r.pos[0], pos[1] - r.pos[1], pos[2] - r.pos[2]);
    const near = gain * Math.exp(-d / NEAR), far = r.tissue === 'vent' ? 0.12 * Math.exp(-d / FAR) : 0;
    if (near < 0.01 && far < 0.01) continue;
    for (let k = n.hist.length - 1; k >= 0; k--) {
      const a = n.hist[k], x = t - a.t - a.tt / 2;
      if (x < -60) continue;
      if (x > 120) break;
      const s = r.tissue === 'his' || r.tissue === 'bb' ? 2.5 : 4;
      v += near * (x / s) * Math.exp(0.5 - (x * x) / (2 * s * s)) * 1.6;      // sharp biphasic local deflection
      if (far) v += far * Math.exp(-((x - 15) ** 2) / (2 * 22 * 22)) * 1.6;   // broad far-field
    }
  }
  return v + stimArtifact(heart, t, 3, pos);
}

/** Pacing spikes: large on the pacing bipole, small elsewhere; about 2 ms wide. */
function stimArtifact(heart, t, amp, pos) {
  let v = 0;
  for (let i = heart.log.length - 1; i >= 0; i--) {
    const e = heart.log[i];
    if (e.t < t - 10) break; // the log is in time order
    if (e.kind !== 'stim' || e.t > t + 2) continue;
    const near = pos && e.pos ? Math.exp(-Math.hypot(pos[0] - e.pos[0], pos[1] - e.pos[1], pos[2] - e.pos[2]) / 0.8) : 0.1;
    const x = t - e.t;
    v += amp * (0.3 + near * 3) * (x >= 0 && x < 1.5 ? 1 : x >= 1.5 && x < 6 ? -0.25 * Math.exp(-(x - 1.5) / 2) : 0);
  }
  return v;
}
