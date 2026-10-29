// Intervals measured from the ground-truth activation log, the way they are read off the His catheter. Pure.
import { region } from './regions.js';
export const VENT = ['lvs', 'rvs', 'rva', 'rvf', 'rvot', 'lva', 'lvan', 'lvi', 'lvl', 'lvb'];
export const ATRIA = ['sa', 'hra', 'mra', 'lra', 'cti', 'sra', 'csos', 'cs78', 'cs56', 'cs34', 'cs12', 'las', 'lar', 'lal'];
const VSET = new Set(VENT), ASET = new Set(ATRIA);

/**
 * Beats in [t0, t1): one entry per atrial or ventricular activation wave.
 * Each His activation gives { a, h, v, ah, hv } (a = septal RA, the His-catheter A; v = earliest ventricle).
 * @param {{ log: object[] }} heart
 */
export function hisBeats(heart, t0, t1) {
  const acts = heart.log.filter((e) => e.kind === 'act' && e.t >= t0 - 700 && e.t < t1 + 200);
  const his = acts.filter((e) => e.id === 'his' && e.t >= t0 && e.t < t1);
  return his.map(({ t: h }) => {
    const a = acts.filter((e) => e.id === 'sra' && e.t <= h && e.t > h - 600).at(-1)?.t ?? null;
    const v = acts.find((e) => VSET.has(e.id) && e.t >= h - 30 && e.t < h + 150)?.t ?? null;
    return { a, h, v, ah: a == null ? null : h - a, hv: v == null ? null : v - h };
  });
}

/** Earliest activation of each region group in a window: the sequence a catheter sees. */
export function sequence(heart, ids, t0, t1) {
  const out = {};
  for (const e of heart.log) if (e.kind === 'act' && e.t >= t0 && e.t < t1 && ids.includes(e.id) && out[e.id] == null) out[e.id] = e.t;
  return out;
}

/** Atrial and ventricular wave onsets in a window (separated by > 150 ms). */
export function waves(heart, t0, t1) {
  const pick = (set) => {
    const ts = heart.log.filter((e) => e.kind === 'act' && set.has(e.id) && e.t >= t0 && e.t < t1).map((e) => e.t).sort((x, y) => x - y);
    return ts.filter((t, i) => i === 0 || t - ts[i - 1] > 150);
  };
  return { a: pick(ASET), v: pick(VSET) };
}

/** Mean cycle length of a sorted list of times. */
export const meanCL = (ts) => ts.length < 2 ? null : (ts.at(-1) - ts[0]) / (ts.length - 1);

/** One ground-truth log entry in plain words, for the Truth list. */
export function describe(e) {
  const name = e.id ? region(e.id)?.name ?? e.id : 'No contact';
  switch (e.kind) {
    case 'block': return `${name}: blocked (still refractory)`;
    case 'conceal': return `${name}: concealed conduction (penetrated, did not conduct, recovery reset)`;
    case 'capture': return `${name}: captured (threshold ${e.thr.toFixed(1)} mA)`;
    case 'nocapture': return `${name}: no capture (${e.why})`;
    case 'act': return `${name}: conducted`;
    default: return `${name}: ${e.kind}`;
  }
}
