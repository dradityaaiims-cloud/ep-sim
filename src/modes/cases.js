// Graded cases (100 points each) for both labs, with feedback built from what the learner did. Pure.
import { Heart } from '../sim/heart.js';
import { Pacemaker } from '../sim/pacemaker.js';
import { runPaced } from '../sim/device.js';
import { region } from '../sim/regions.js';

// ── EP study cases: an unknown heart; study it, measure, diagnose ──
// key: the manoeuvre that answers the question (checked against what the learner delivered)
export const EP_CASES = [
  { id: 'ep1', sub: 'dual', title: 'Recurrent palpitations, normal resting ECG', answer: 'Dual AV nodal pathways with inducible AVNRT', key: 'extra',
    why: 'Atrial extrastimulus testing shows the AH jump and induces the tachycardia; the short septal VA identifies AVNRT.' },
  { id: 'ep2', sub: 'wpw', title: 'Palpitations, short PR on the ECG', answer: 'Manifest left lateral accessory pathway', key: 'any',
    why: 'Sinus beats are pre-excited and the earliest ventricular electrogram is at CS 1-2. Any pacing manoeuvre confirms the pathway conducts without decrement.' },
  { id: 'ep3', sub: 'concealed', title: 'Narrow-complex tachycardia, normal ECG between attacks', answer: 'Concealed left lateral accessory pathway', key: 'rv',
    why: 'Sinus rhythm is normal, so only ventricular pacing reveals the pathway: retrograde atrial activation is earliest at CS 1-2 (eccentric).' },
  { id: 'ep4', sub: 'infrahis', title: 'Syncope with left bundle branch block', answer: 'Infra-Hisian conduction disease', key: 'none',
    why: 'The HV interval is the measurement that matters: well over 55 ms means disease below the His and a high risk of complete heart block.' },
  { id: 'ep5', sub: 'snd', title: 'Fatigue and a slow pulse', answer: 'Sinus node dysfunction', key: 'snrt',
    why: 'After overdrive pacing of the atrium the sinus node takes far longer than 1500 ms to recover: a prolonged sinus node recovery time.' },
  { id: 'ep6', sub: 'flutter', title: 'Regular palpitations at about 130 /min', answer: 'Typical (isthmus-dependent) atrial flutter', key: 'burst',
    why: 'Atrial burst pacing near the isthmus starts a regular atrial loop at about 230 ms with AV nodal block.' },
];
export const EP_DIAGNOSES = [...EP_CASES.map((c) => c.answer), 'Normal EP study'];
const KEY_TEXT = { extra: 'atrial extrastimulus testing (S1–S2)', any: 'any programmed pacing', rv: 'ventricular pacing from the RVA', none: 'measuring the intervals', snrt: 'overdrive atrial pacing for 10 s or more, then stopping (SNRT)', burst: 'atrial burst pacing' };

/**
 * did: { extra, rv, burst, snrt, deliveries }; measured/truth: { ah, hv } (ms); secs: time taken.
 * Points: diagnosis 50, intervals 20 (10 each, within 15 ms), key manoeuvre 20, time 10 (under 6 min).
 */
export function scoreEP(c, { picked, measured = {}, truth = {}, did = {}, secs = 0 }) {
  const items = [];
  const right = picked === c.answer;
  items.push({ label: 'Diagnosis', pts: right ? 50 : 0, max: 50, note: right ? `Correct: ${c.answer}.` : `You chose "${picked ?? 'nothing'}". It was ${c.answer}. ${c.why}` });
  for (const k of ['ah', 'hv']) {
    const ok = measured[k] != null && truth[k] != null && Math.abs(measured[k] - truth[k]) <= 15;
    items.push({ label: k.toUpperCase(), pts: ok ? 10 : 0, max: 10, note: measured[k] == null ? `Not entered (it was about ${Math.round(truth[k])} ms).` : ok ? `${measured[k]} ms, within 15 ms of ${Math.round(truth[k])}.` : `${measured[k]} ms; the sinus ${k.toUpperCase()} was about ${Math.round(truth[k])} ms. Use the calipers on the His channel.` });
  }
  const keyDone = c.key === 'none' || (c.key === 'any' ? did.deliveries > 0 : !!did[c.key]);
  items.push({ label: 'Key manoeuvre', pts: keyDone ? 20 : 0, max: 20, note: keyDone ? `Done: ${KEY_TEXT[c.key]}.` : `The study needed ${KEY_TEXT[c.key]}.` });
  const fast = secs <= 360;
  items.push({ label: 'Time', pts: fast ? 10 : secs <= 600 ? 5 : 0, max: 10, note: `${Math.round(secs / 60)} min.` });
  return { score: items.reduce((s, i) => s + i.pts, 0), items };
}

// ── Pacemaker troubleshooting: something is wrong; name it, reprogram, check ──
const PVC_AT = 3000;
export const PM_CASES = [
  { id: 'pm1', title: 'Pacemaker-dependent, dizzy: spikes with no QRS', sub: 'chb', settings: { mode: 'VVI', lrl: 60, outV: 0.4, pw: 0.4 }, answer: 'Loss of capture',
    why: 'Pacing spikes without a following QRS: the output is below the capture threshold. Program at least twice the threshold (about 0.5 V at 0.4 ms here).',
    fixed: (pm, res) => res.vp > 4 && res.vp === res.vcap && pm.s.outV >= 1.0 },
  { id: 'pm2', title: 'Pacing spikes on top of the patient\'s own beats', sub: 'normal', settings: { mode: 'VVI', lrl: 60, sensV: 12 }, answer: 'Undersensing',
    why: 'The device paces regardless of intrinsic QRS complexes because the sensitivity (12 mV) is above the R wave (about 10 mV). Program it to about a third to half of the R wave.',
    fixed: (pm, res) => res.vp === 0 && pm.s.sensV <= 5 },
  { id: 'pm3', title: 'Pauses when the patient uses the arm', sub: 'chb', settings: { mode: 'VVI', lrl: 60, sensV: 0.8 }, noisy: true, answer: 'Oversensing (myopotentials)',
    why: 'Muscle noise on the ventricular lead is sensed as R waves and inhibits pacing in a patient with no escape rhythm worth having. Make the ventricular channel less sensitive (2–5 mV here).',
    fixed: (pm, res) => res.maxGap < 1300 && pm.s.sensV <= 5 },
  { id: 'pm4', title: 'Sudden fast paced rhythm after an ectopic beat', sub: 'chbva', settings: { mode: 'DDD', lrl: 60, url: 130, pvarp: 200 }, pvc: true, answer: 'Pacemaker-mediated tachycardia',
    why: 'A PVC conducted back to the atrium after PVARP; the device tracked the retrograde P wave, paced the ventricle, and the loop repeated at the upper rate. Lengthen PVARP beyond the VA time (about 300 ms or more here).',
    fixed: (pm, res) => res.fastVP < 4 },
  { id: 'pm5', title: 'Asystole whenever the atrium is paced', sub: 'chb', sinus: 40, settings: { mode: 'DDD', lrl: 60, vBlank: 0, safety: false, sensV: 1 }, answer: 'Crosstalk',
    why: 'With no ventricular blanking the ventricular channel senses the atrial pacing pulse and withholds the ventricular output. Restore blanking (about 28 ms) and turn safety pacing on.',
    fixed: (pm, res) => res.vp >= 6 },
];
export const PM_PROBLEMS = [...PM_CASES.map((c) => c.answer), 'Normal pacemaker function'];

/** Simulate the case for 9 s with the learner's settings and measure what happened. Pure. */
export function checkPM(c, settings) {
  const h = new Heart(c.sub);
  if (c.sinus) h.nodes.sa.auto = 60000 / c.sinus;
  const pm = new Pacemaker(settings);
  const opts = { noisy: !!c.noisy };
  runPaced(h, pm, PVC_AT, opts);
  if (c.pvc) h.stim(PVC_AT + 0.5, 'lvl', { mA: 5, pw: 1, pos: region('lvl').pos });
  runPaced(h, pm, 9000, opts);
  const from = 1500, to = 8800; // leave time for the last output's capture to be resolved
  const vp = pm.log.filter((e) => (e.m === 'VP' || e.m === 'SP') && e.t >= from && e.t < to).map((e) => e.t);
  const vcap = h.log.filter((e) => e.kind === 'capture' && e.id === 'rva' && e.t >= from && e.t < to).length;
  const vs = h.log.filter((e) => e.kind === 'act' && e.id === 'lvs' && e.t >= from).map((e) => e.t);
  const gaps = vs.slice(1).map((t, i) => t - vs[i]);
  const fastVP = vp.slice(1).filter((t, i) => t - vp[i] < 600 && t > PVC_AT + 1000).length;
  return { pm, vp: vp.length, vcap, maxGap: Math.max(0, ...gaps, vs.length ? 0 : 9000), fastVP };
}

/** Points: problem named 40, fixed (checked by simulation) 50, time 10 (under 4 min). */
export function scorePM(c, { picked, settings, secs = 0 }) {
  const res = checkPM(c, settings), fixed = c.fixed(res.pm, res);
  const items = [
    { label: 'Problem', pts: picked === c.answer ? 40 : 0, max: 40, note: picked === c.answer ? `Correct: ${c.answer}.` : `You chose "${picked ?? 'nothing'}". It was ${c.answer}.` },
    { label: 'Fixed', pts: fixed ? 50 : 0, max: 50, note: fixed ? 'Your settings work: checked over 9 seconds of simulation.' : `Not fixed yet. ${c.why}` },
    { label: 'Time', pts: secs <= 240 ? 10 : secs <= 480 ? 5 : 0, max: 10, note: `${Math.round(secs / 60)} min.` },
  ];
  return { score: items.reduce((s, i) => s + i.pts, 0), items };
}
