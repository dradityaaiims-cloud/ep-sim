// "Place the catheters": each catheter slides along a track; the learner advances or withdraws it until its
// electrograms look right. Electrode positions come from the track, so the recordings change as it moves. Pure.
import { region, REGIONS } from '../sim/regions.js';
import { CATHETERS } from '../sim/catheters.js';

const P = (id, d = [0, 0, 0]) => region(id).pos.map((v, i) => v + d[i]);
// track points (cm); offsets: each bipole's distance behind the tip in track units; target: which bipole, which region
export const TRACKS = {
  hra: { points: [[-3.1, 3.2, -1.4], P('hra', [0.15, 0.1, 0]), P('mra', [0.15, 0, 0]), P('lra', [0.15, 0, 0])], offsets: [0], target: { bipole: 0, region: 'hra' },
    hint: 'Advance from the SVC into the high lateral RA, near the sinus node: the HRA signal should be the earliest atrial signal in sinus rhythm.' },
  his: { points: [P('csos', [0.3, 0.2, 0.4]), P('sra', [0.25, -0.2, 0.3]), P('his', [0.2, -0.25, 0.2]), P('rvs', [-0.6, 0.1, -0.2])], offsets: [0, 1], target: { bipole: 0, region: 'his' },
    hint: 'Cross the septal tricuspid annulus. Too atrial: a big A and no H. Too ventricular: a big V and no A. In the right place: A and V of similar size with a sharp H between them.' },
  cs: { points: [[-2.0, -2.6, -1.8], P('csos', [0, -0.15, -0.15]), P('cs78', [0, -0.15, -0.2]), P('cs56', [0, -0.15, -0.2]), P('cs34', [0, -0.15, -0.2]), P('cs12', [0, -0.15, -0.2])], offsets: [4, 3, 2, 1, 0], target: { bipole: 4, region: 'cs12' },
    hint: 'Advance into the coronary sinus until the proximal pair (CS 9-10) sits at the ostium; then the distal pair lies on the lateral mitral annulus.' },
  rva: { points: [[-1.4, -2.2, 0.4], [0.6, -3.2, 2.2], P('rva', [-0.15, -0.1, 0]), P('rva', [0.3, -0.4, 0.1])], offsets: [0], target: { bipole: 0, region: 'rva' },
    hint: 'Cross the tricuspid valve and advance to the RV apex: a large, sharp ventricular signal and no atrial signal.' },
};
export const TOL_CM = 0.6;

/** Position on a track at parameter u (0 = first point). */
export function along(points, u) {
  const k = Math.max(0, Math.min(points.length - 1.0001, u)), i = Math.floor(k), f = k - i;
  const a = points[i], b = points[Math.min(points.length - 1, i + 1)];
  return a.map((v, j) => +(v + (b[j] - v) * f).toFixed(3));
}

/** Bipole midpoints for catheter id at tip parameter u. */
export const bipoles = (id, u) => TRACKS[id].offsets.map((o) => along(TRACKS[id].points, u - o));

/** u at which the target bipole sits on its target (the "right answer"). */
export function targetU(id) {
  const t = TRACKS[id], goal = region(t.target.region).pos;
  let best = 0, bd = Infinity;
  for (let u = 0; u <= t.points.length - 1; u += 0.01) {
    const p = along(t.points, u - t.offsets[t.target.bipole]), d = Math.hypot(...p.map((v, i) => v - goal[i]));
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/** Name of the region nearest a point (for the live "where am I" readout). */
export function nearest(pos) {
  let best = null, bd = Infinity;
  for (const r of REGIONS) {
    if (r.off || r.tissue === 'avn' || r.tissue === 'ap') continue; // not seen on an electrogram
    const d = Math.hypot(...pos.map((v, i) => v - r.pos[i]));
    if (d < bd) { bd = d; best = r; }
  }
  return { region: best, cm: bd };
}

/** Score the placement: 25 points per catheter, with a note on which way to move. us: { hra, his, cs, rva } */
export function scorePlacement(us) {
  const items = Object.keys(TRACKS).map((id) => {
    const t = TRACKS[id], p = bipoles(id, us[id])[t.target.bipole], goal = region(t.target.region).pos;
    const d = Math.hypot(...p.map((v, i) => v - goal[i])), ok = d <= TOL_CM, dir = us[id] < targetU(id) ? 'advance it' : 'withdraw it';
    return { label: CATHETERS[id].name, pts: ok ? 25 : 0, max: 25, note: ok ? `In place (${d.toFixed(1)} cm from the ${region(t.target.region).name.toLowerCase()}).` : `${d.toFixed(1)} cm off: ${dir}. ${t.hint}` };
  });
  return { score: items.reduce((s, i) => s + i.pts, 0), items };
}
