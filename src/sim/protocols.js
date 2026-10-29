// Programmed stimulation: turns a protocol into a list of stimulus times. Pure.
// Programmed intervals are what the stimulator does; the heart's measured intervals can differ
// (non-capture, decremental conduction), which is why both are logged.

/**
 * @param {object} p
 *   kind: 'drive' (S1 train) | 'extra' (S1 train + S2 [+ S3]) | 'burst' | 'incremental'
 *   s1: drive cycle length (ms); n: number of S1; s2, s3: coupling intervals (ms)
 *   from, to, stepMs, perStep: incremental pacing from CL `from` down to `to`
 *   dur: burst duration (ms)
 * @returns {{ t: number, label: string }[]} times relative to the start of the protocol
 */
export function schedule(p) {
  const out = [];
  if (p.kind === 'drive' || p.kind === 'extra') {
    const n = p.n ?? 8;
    for (let k = 0; k < n; k++) out.push({ t: k * p.s1, label: 'S1' });
    if (p.kind === 'extra') {
      let t = (n - 1) * p.s1 + p.s2; out.push({ t, label: 'S2' });
      if (p.s3) { t += p.s3; out.push({ t, label: 'S3' }); }
    }
  } else if (p.kind === 'burst') {
    for (let t = 0; t < p.dur; t += p.s1) out.push({ t, label: 'S1' });
  } else if (p.kind === 'incremental') {
    let t = 0;
    for (let cl = p.from; cl >= p.to; cl -= p.stepMs) for (let k = 0; k < (p.perStep ?? 8); k++) { out.push({ t, label: `S1 ${cl}` }); t += cl; }
  } else throw new Error(`unknown protocol ${p.kind}`);
  return out;
}

/** Duration of a protocol (time of the last stimulus). */
export const span = (p) => { const s = schedule(p); return s.length ? s[s.length - 1].t : 0; };
