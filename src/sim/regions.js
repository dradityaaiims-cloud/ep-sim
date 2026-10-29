// The heart as a graph of named regions. Pure data, no rendering.
// Frame (same as the RHC sim's HRA heart): cm, x patient-left, y superior, z anterior, heart centre at 0.
// Every number here is a teaching value chosen to land in textbook ranges, not a measured human parameter.

/**
 * Tissue classes. Refractoriness after an activation = erp0 * (1 - erpA * exp(-prevDI / erpTau)) ms.
 * Traversal time out of a region = tt * (1 + decA * exp(-DI / decTau)) ms (conduction slows when the tissue is
 * not fully recovered; strongest in the AV node, which gives decremental conduction and the AH jump).
 * fromExit: recovery is timed from when the wave left the region (AV node: the "H-to-A" recovery time of
 * functional nodal models), not from when it entered.
 * thr: pacing threshold at long pulse width (rheobase, mA); chronaxie in ms.
 */
export const TISSUE = {
  sa:     { erp0: 300, erpA: 0.1, erpTau: 200, decA: 0.2, decTau: 80, thr: 2.0, chronaxie: 0.5, mass: 0.2 },
  atrium: { erp0: 230, erpA: 0.25, erpTau: 120, decA: 0.4, decTau: 25, thr: 0.6, chronaxie: 0.4, mass: 1 },
  avn:    { erp0: 250, erpA: 0, erpTau: 1, decA: 2.4, decTau: 70, thr: 3.0, chronaxie: 0.6, mass: 0, fromExit: true },
  his:    { erp0: 330, erpA: 0.2, erpTau: 150, decA: 0.2, decTau: 30, thr: 1.5, chronaxie: 0.4, mass: 0 },
  bb:     { erp0: 360, erpA: 0.2, erpTau: 150, decA: 0.2, decTau: 30, thr: 1.5, chronaxie: 0.4, mass: 0 },
  vent:   { erp0: 270, erpA: 0.3, erpTau: 100, decA: 0.4, decTau: 25, thr: 0.5, chronaxie: 0.4, mass: 1 },
  ap:     { erp0: 270, erpA: 0.1, erpTau: 100, decA: 0, decTau: 1, thr: 9, chronaxie: 0.4, mass: 0 },
};

// id, name, tissue, position (cm), traversal time (ms), extra
const R = (id, name, tissue, pos, tt, extra = {}) => ({ id, name, tissue, pos, tt, ...extra });
export const REGIONS = [
  // atria
  R('sa', 'Sinus node', 'sa', [-3.0, 2.5, -1.0], 5, { auto: 800 }),
  R('hra', 'High lateral RA', 'atrium', [-3.6, 1.8, 0.1], 8),
  R('mra', 'Mid lateral RA', 'atrium', [-3.9, 0.1, 0.7], 8),
  R('lra', 'Low lateral RA', 'atrium', [-3.2, -1.7, 0.5], 8),
  R('sra', 'Septal RA (His region)', 'atrium', [-1.2, -0.7, -0.3], 6),
  R('cti', 'Cavotricuspid isthmus', 'atrium', [-2.4, -2.3, 0.2], 8),
  R('csos', 'CS ostium (CS 9-10)', 'atrium', [-1.5, -2.3, -1.6], 6),
  R('cs78', 'Proximal CS (CS 7-8)', 'atrium', [-0.1, -2.1, -2.6], 6),
  R('cs56', 'Mid CS (CS 5-6)', 'atrium', [1.3, -1.4, -3.1], 6),
  R('cs34', 'Mid-distal CS (CS 3-4)', 'atrium', [2.6, -0.6, -2.9], 6),
  R('cs12', 'Distal CS (CS 1-2)', 'atrium', [3.6, 0.2, -2.2], 6),
  R('las', 'LA septum', 'atrium', [-0.4, 1.2, -2.1], 8),
  R('lar', 'LA roof (Bachmann)', 'atrium', [0.6, 2.6, -2.5], 8),
  R('lal', 'LA lateral', 'atrium', [2.6, 1.6, -3.2], 8),
  // AV node: fast (superior) and slow (inferior, near the CS ostium) pathways meet at the compact node
  R('f1', 'AVN fast pathway (atrial end)', 'avn', [-1.0, -0.5, -0.2], 20, { decA: 0.6 }),
  R('f2', 'AVN fast pathway (nodal end)', 'avn', [-0.8, -0.8, 0.2], 20, { decA: 0.6 }),
  R('s1', 'AVN slow pathway (atrial end)', 'avn', [-1.4, -2.0, -1.1], 50, { slow: true }),
  R('s2', 'AVN slow pathway (mid)', 'avn', [-1.1, -1.6, -0.6], 50, { slow: true }),
  R('s3', 'AVN slow pathway (nodal end)', 'avn', [-0.8, -1.2, -0.1], 50, { slow: true }),
  R('cn', 'Compact AV node', 'avn', [-0.6, -1.0, 0.3], 30),
  // His-Purkinje
  R('his', 'His bundle', 'his', [-0.4, -1.1, 0.6], 12, { auto: 1500 }),
  R('rbb', 'Right bundle branch', 'bb', [0.9, -2.2, 1.9], 28),
  R('lbb', 'Left bundle branch', 'bb', [1.3, -1.4, 0.8], 25),
  // ventricles (mass: weight in the surface ECG; the LV wall is about three times thicker than the RV)
  R('lvs', 'LV septum', 'vent', [2.4, -1.5, 1.0], 10, { mass: 2.5 }),
  R('rvs', 'RV septum', 'vent', [2.0, -2.1, 1.9], 10, { mass: 0.6 }),
  R('rva', 'RV apex', 'vent', [3.0, -4.1, 2.7], 10, { auto: 2400, mass: 0.6 }),
  R('rvf', 'RV free wall', 'vent', [0.4, -2.9, 2.6], 12, { mass: 0.6 }),
  R('rvot', 'RV outflow tract', 'vent', [1.5, 1.4, 1.8], 12, { mass: 0.4 }),
  R('lva', 'LV apex', 'vent', [4.4, -4.0, 1.3], 10, { mass: 2.5 }),
  R('lvan', 'LV anterior wall', 'vent', [4.1, -0.6, 1.8], 12, { mass: 2.5 }),
  R('lvi', 'LV inferior wall', 'vent', [3.4, -3.0, -1.0], 12, { mass: 2.5 }),
  R('lvl', 'LV lateral wall', 'vent', [5.6, -1.6, -0.6], 12, { mass: 3 }),
  R('lvb', 'LV basal lateral (mitral annulus)', 'vent', [4.4, 0.2, -1.5], 12, { mass: 1 }),
  // accessory pathway (off unless the substrate turns it on): left lateral, distal CS to basal lateral LV
  R('ap', 'Accessory pathway (left lateral)', 'ap', [3.9, 0.3, -1.9], 4, { off: true }),
];

// Conduction speeds for edges without a fixed delay (ms per cm): atrial ~1 m/s, ventricular myocardium ~0.7 m/s.
const MS_PER_CM = { atrium: 10, vent: 14 };
// [a, b, ms?, msBack?]: bidirectional connections; ms omitted = distance x tissue speed; msBack = b to a if different
const LINKS = [
  ['sa', 'hra', 15],
  ['hra', 'mra'], ['mra', 'lra'], ['hra', 'sra'], ['mra', 'sra'], ['lra', 'cti'], ['cti', 'csos'], ['sra', 'csos'],
  ['hra', 'lar', 30], ['sra', 'las', 18], ['las', 'lar'], ['lar', 'lal'], ['las', 'cs78'],
  ['csos', 'cs78'], ['cs78', 'cs56'], ['cs56', 'cs34'], ['cs34', 'cs12'], ['cs12', 'lal'], ['cs56', 'lal'],
  // AV node inputs and outputs
  ['sra', 'f1', 5], ['f1', 'f2', 0], ['f2', 'cn', 0],
  ['csos', 's1', 5], ['s1', 's2', 0], ['s2', 's3', 0], ['s3', 'cn', 0],
  ['cn', 'his', 0, 35], // retrograde entry from the His into the node is slower than antegrade exit
  // His-Purkinje to myocardium
  ['his', 'rbb', 0], ['his', 'lbb', 0],
  ['lbb', 'lvs', 2], ['lbb', 'lva', 26], ['lbb', 'lvan', 26], ['lbb', 'lvi', 28],
  ['rbb', 'rva', 12], ['rbb', 'rvs', 6],
  // ventricular myocardium
  ['lvs', 'rvs'], ['rvs', 'rva'], ['rva', 'rvf'], ['rvf', 'rvot'], ['rvs', 'rvot'], ['rva', 'lva'],
  ['lvs', 'lvan'], ['lva', 'lvan'], ['lva', 'lvi'], ['lvi', 'lvl'], ['lvan', 'lvl'], ['lvl', 'lvb'], ['lvi', 'lvb'], ['lvan', 'lvb'],
  // accessory pathway
  ['cs12', 'ap', 2], ['ap', 'lvb', 2],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const byId = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const region = (id) => byId[id];

/** Adjacency: id -> [{ to, ms }] */
export function buildEdges(regions = REGIONS) {
  const by = Object.fromEntries(regions.map((r) => [r.id, r]));
  const adj = Object.fromEntries(regions.map((r) => [r.id, []]));
  for (const [a, b, fixed, back] of LINKS) {
    const A = by[a], B = by[b];
    if (!A || !B) throw new Error(`bad link ${a}-${b}`);
    const ms = fixed ?? Math.round(dist(A.pos, B.pos) * (MS_PER_CM[A.tissue] ?? MS_PER_CM[B.tissue] ?? 10));
    adj[a].push({ to: b, ms }); adj[b].push({ to: a, ms: back ?? ms });
  }
  return adj;
}

/**
 * Substrates: patches on top of the normal heart. Each patch maps a region id to overrides.
 * Overrides are tissue parameters (erp0, tt, decA...), `off`, `auto` or `blockFrom` (sources it will not accept).
 * `pacer: true` = also offered as a patient in the pacemaker lab.
 */
export const SUBSTRATES = {
  normal: {
    pacer: true,
    name: 'Normal conduction',
    blurb: 'Normal sinus node, AV node, His-Purkinje system and ventricles. The slow pathway is present but its ERP is no shorter than the fast pathway, so there is no jump.',
    patch: { s1: { erp0: 330 }, s2: { erp0: 330 }, s3: { erp0: 330 } },
  },
  dual: {
    name: 'Dual AV nodal pathways (AVNRT substrate)',
    blurb: 'A fast pathway with a long ERP and a slow pathway with a short ERP. A premature beat that blocks in the fast pathway conducts down the slow one (AH jump) and can return up the fast pathway: typical slow-fast AVNRT.',
    patch: { f1: { erp0: 340 }, f2: { erp0: 340 }, s1: { erp0: 230, tt: 55 }, s2: { erp0: 230, tt: 55 }, s3: { erp0: 230, tt: 55 } },
  },
  wpw: {
    name: 'Manifest left lateral accessory pathway (WPW)',
    blurb: 'A left lateral pathway conducts both ways without decrement. Sinus beats are pre-excited (short PR, delta wave). The earliest ventricular and retrograde atrial activation is at the distal CS.',
    patch: { ap: { off: false } },
  },
  concealed: {
    name: 'Concealed left lateral accessory pathway',
    blurb: 'The pathway conducts only retrograde (ventricle to atrium), so sinus rhythm looks normal. It is the circuit for orthodromic AVRT, with eccentric (distal CS first) retrograde atrial activation.',
    patch: { ap: { off: false, blockFrom: ['cs12'] } },
  },
  avb1: {
    name: 'First-degree AV block (AV nodal)',
    blurb: 'Slow AV nodal conduction: a long AH with a normal HV. Wenckebach appears at a longer pacing cycle length than normal.',
    patch: { f1: { tt: 70, erp0: 320 }, f2: { tt: 70, erp0: 320 }, s1: { erp0: 380 }, s2: { erp0: 380 }, s3: { erp0: 380 } },
  },
  infrahis: {
    name: 'Infra-Hisian conduction disease',
    blurb: 'A long HV interval with bundle branch disease (left bundle block). Fast atrial pacing produces block below the His (A and H without V) instead of AV nodal Wenckebach.',
    patch: { lbb: { off: true }, rbb: { tt: 45, erp0: 520, erpA: 0 } },
  },
  chb: {
    pacer: true,
    name: 'Complete heart block',
    blurb: 'No atrial impulse reaches the ventricles. A junctional escape rhythm from the His region drives the ventricles, independent of the atria (AV dissociation).',
    patch: { cn: { off: true }, his: { auto: 1600 } },
  },
  chbva: {
    name: 'Complete heart block with retrograde (VA) conduction',
    blurb: 'No atrial impulse reaches the ventricles, but the AV node still conducts backwards: a ventricular beat can reach the atria. This is the substrate for pacemaker-mediated tachycardia.',
    patch: { cn: { blockFrom: ['f2', 's3'] }, his: { auto: 1600 } },
    pacer: true,
  },
  flutter: {
    name: 'Atrial flutter substrate (cavotricuspid isthmus)',
    blurb: 'Slow conduction and a longer refractory period in the cavotricuspid isthmus, and shorter atrial refractoriness. Burst pacing near the isthmus (CS 9-10) can block in the isthmus in one direction and start typical flutter: a loop around the tricuspid annulus with 2:1 AV conduction.',
    patch: {
      cti: { tt: 70, erp0: 250, decA: 0.8, decTau: 60 },
      ...Object.fromEntries(['hra', 'mra', 'lra', 'sra', 'csos', 'cs78', 'cs56', 'cs34', 'cs12', 'las', 'lar', 'lal'].map((id) => [id, { erp0: 170 }])),
    },
  },
  snd: {
    name: 'Sinus node dysfunction',
    blurb: 'A slow sinus rate and marked overdrive suppression: after atrial pacing stops, the sinus node takes far longer than normal to recover (prolonged SNRT).',
    patch: { sa: { auto: 1150, suppress: 1700 } },
    pacer: true,
  },
};
