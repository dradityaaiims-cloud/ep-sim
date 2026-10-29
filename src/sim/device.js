// Couples the pacemaker to the heart: every millisecond the device reads its lead signals and may pace.
// The heart is stepped in lockstep, so the device only ever sees the past. Pure, no DOM.
import { egm } from './signals.js';
import { CATHETERS, contactRegion } from './catheters.js';

export const LEADS = { A: CATHETERS.pmA.bipoles[0].pos, V: CATHETERS.pmV.bipoles[0].pos };
const GAIN = { A: 2.5, V: 5 };   // lead electrogram scale, so P waves are a few mV and R waves about 10 mV
export const OHMS = 500;          // lead impedance: output current (mA) = volts / 0.5 kOhm
const CONTACT = { A: contactRegion(LEADS.A), V: contactRegion(LEADS.V) };

/** Myopotential noise on the ventricular lead (bursts of skeletal-muscle signal), when switched on. */
export const noise = (t) => (Math.sin((2 * Math.PI * t) / 2300) > 0.3 ? 1.6 * Math.sin((2 * Math.PI * t) / 17) * Math.sin((2 * Math.PI * t) / 53) : 0);

/** What the device sees on a lead at time t (mV). */
export function leadMv(heart, ch, t, { noisy = false } = {}) {
  return GAIN[ch] * egm(heart, LEADS[ch], t) + (ch === 'V' && noisy ? noise(t) : 0);
}

/**
 * Run heart and device together from heart.t to tEnd in 1 ms steps.
 * opts: { noisy, exitBlock: { A, V } threshold multipliers (lead problems) }
 */
export function runPaced(heart, pm, tEnd, opts = {}) {
  for (let t = Math.floor(heart.t) + 1; t <= tEnd; t++) {
    heart.step(t);
    for (const o of pm.step(t, leadMv(heart, 'A', t, opts), leadMv(heart, 'V', t, opts))) {
      const volts = o.ch === 'A' ? pm.s.outA : pm.s.outV, block = opts.exitBlock?.[o.ch] ?? 1;
      heart.stim(t + 0.5, CONTACT[o.ch], { mA: (volts * 1000) / OHMS / block, pw: pm.s.pw, pos: LEADS[o.ch], device: o.ch });
    }
  }
  heart.step(tEnd);
}
