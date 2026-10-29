// Standard diagnostic catheters: their route for drawing, electrode pairs for recording, and which region a
// pacing bipole touches. Pure. Units cm, same frame as regions.js.
import { REGIONS, region } from './regions.js';

const P = (id, d = [0, 0, 0]) => region(id).pos.map((v, i) => +(v + d[i]).toFixed(2));
const SVC = [[-3.2, 9, -1.3], [-3.1, 4.5, -1.6], [-3.1, 2.8, -1.4]];
const IVC = [[-2.6, -12, -4.2], [-2.5, -5.0, -3.3], [-2.5, -2.9, -2.1]];

/** Each bipole: { label, pos (midpoint of the pair), pace: true if it can be used to pace } */
export const CATHETERS = {
  hra: {
    name: 'HRA', color: 0x7fd3ff, route: [...SVC, P('hra', [0.1, 0.1, 0])],
    bipoles: [{ label: 'HRA', pos: P('hra', [0.15, 0.1, 0]), pace: true }],
  },
  his: {
    name: 'His', color: 0xffe066, route: [...IVC, [-1.8, -1.6, -0.6], P('sra', [0.2, -0.3, 0.3]), P('his', [0.15, -0.2, 0.2])],
    bipoles: [
      { label: 'His d', pos: P('his', [0.2, -0.25, 0.2]), pace: true },
      { label: 'His p', pos: P('sra', [0.25, -0.2, 0.3]) },
    ],
  },
  cs: {
    name: 'CS', color: 0xff9ad5, route: [...IVC, [-2.0, -2.6, -1.8], P('csos', [0, -0.15, -0.15]), P('cs78', [0, -0.15, -0.2]), P('cs56', [0, -0.15, -0.2]), P('cs34', [0, -0.15, -0.2]), P('cs12', [0, -0.15, -0.2])],
    bipoles: [
      { label: 'CS 9-10', pos: P('csos', [0, -0.15, -0.15]), pace: true },
      { label: 'CS 7-8', pos: P('cs78', [0, -0.15, -0.2]) },
      { label: 'CS 5-6', pos: P('cs56', [0, -0.15, -0.2]) },
      { label: 'CS 3-4', pos: P('cs34', [0, -0.15, -0.2]) },
      { label: 'CS 1-2', pos: P('cs12', [0, -0.15, -0.2]), pace: true },
    ],
  },
  rva: {
    name: 'RVA', color: 0x9dff8a, route: [...IVC, [-1.4, -2.2, 0.4], [0.6, -3.2, 2.2], P('rva', [-0.2, -0.1, 0])],
    bipoles: [{ label: 'RVA', pos: P('rva', [-0.15, -0.1, 0]), pace: true }],
  },
  // pacemaker leads, from the left subclavian vein: right atrial appendage (high RA) and RV apex
  pmA: {
    name: 'RA lead', color: 0x7fd3ff, pacer: true, route: [[4, 11, 2], [0, 8.5, 0.5], [-3.0, 6, -1.2], [-3.1, 2.8, -1.2], P('hra', [0.2, 0.15, 0.25])],
    bipoles: [{ label: 'RA lead', pos: P('hra', [0.2, 0.15, 0.25]) }],
  },
  pmV: {
    name: 'RV lead', color: 0x9dff8a, pacer: true, route: [[4, 11, 2], [0, 8.5, 0.5], [-3.0, 6, -1.2], [-2.9, 2.6, -1.0], [-1.6, -1.6, 0.6], [0.6, -3.2, 2.2], P('rva', [-0.2, 0.05, 0])],
    bipoles: [{ label: 'RV lead', pos: P('rva', [-0.2, 0.05, 0]) }],
  },
};

/** Pacing sites offered by the stimulator: [catheter, bipole label]. */
export const PACE_SITES = Object.entries(CATHETERS).filter(([, k]) => !k.pacer).flatMap(([c, k]) => k.bipoles.filter((b) => b.pace).map((b) => ({ id: b.label, cath: c, pos: b.pos })));

const CONTACT_CM = 0.8; // a bipole paces the region it touches; the AV node itself is not paceable from the endocardium
/** Region a bipole at pos can capture, or null if nothing excitable is in contact. */
export function contactRegion(pos) {
  let best = null, bd = CONTACT_CM;
  for (const r of REGIONS) {
    if (r.tissue === 'avn' || r.tissue === 'ap') continue;
    const d = Math.hypot(pos[0] - r.pos[0], pos[1] - r.pos[1], pos[2] - r.pos[2]);
    if (d < bd) { bd = d; best = r.id; }
  }
  return best;
}

/** Recording channels in the usual EP lab order (surface leads first, then catheters top to bottom). */
export const CHANNELS = [
  { id: 'I', kind: 'ecg' }, { id: 'II', kind: 'ecg' }, { id: 'aVF', kind: 'ecg' }, { id: 'V1', kind: 'ecg' },
  ...['hra', 'his', 'cs', 'rva'].flatMap((c) => CATHETERS[c].bipoles.map((b) => ({ id: b.label, kind: 'egm', pos: b.pos, cath: c }))),
];

/** Pacemaker lab channels: surface leads, the two lead electrograms as the device sees them, and the marker channel. */
export const PM_CHANNELS = [
  { id: 'I', kind: 'ecg' }, { id: 'II', kind: 'ecg' }, { id: 'V1', kind: 'ecg' },
  { id: 'RA lead', kind: 'lead', ch: 'A', cath: 'hra' }, { id: 'RV lead', kind: 'lead', ch: 'V', cath: 'rva' },
  { id: 'Markers', kind: 'marker' },
];
