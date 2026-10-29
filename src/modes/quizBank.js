// "Name the finding" questions. Each sets up a heart and a protocol; the app runs it and freezes the recording.
// Pure data + helpers. proto: { site, kind: 'pace'|'extra'|'burst'|'none', s1, n, s2, dur } ; run = ms to simulate.
export const QUESTIONS = [
  { id: 'wenck', sub: 'normal', proto: { site: 'HRA', kind: 'pace', s1: 330 }, run: 5500, answer: 'AV nodal (AH) Wenckebach during atrial pacing',
    explain: 'Each paced A is followed by a longer AH until one A has no H: block in the AV node. The HV stays constant, so the His–Purkinje system is not involved.' },
  { id: 'avnrt', sub: 'dual', proto: { site: 'HRA', kind: 'extra', s1: 600, n: 8, s2: 320 }, run: 8000, answer: 'Typical (slow–fast) AVNRT',
    explain: 'A narrow-complex tachycardia started by an S2 with a long AH (slow pathway). The septal A falls on or just after the V (VA under 70 ms) and atrial activation is concentric.' },
  { id: 'avrt', sub: 'concealed', proto: { site: 'HRA', kind: 'extra', s1: 600, n: 8, s2: 300 }, run: 8000, answer: 'Orthodromic AVRT via a left lateral pathway',
    explain: 'A narrow-complex tachycardia with a longer VA than AVNRT, and the earliest atrial activation at CS 1-2 (eccentric): down the AV node, up a left lateral pathway.' },
  { id: 'wpw', sub: 'wpw', proto: { kind: 'none' }, run: 4000, answer: 'Ventricular pre-excitation (manifest accessory pathway)',
    explain: 'Sinus rhythm with a short HV (the V starts at or before the H) and a wide QRS with a delta wave. The earliest V is at the distal CS: a left lateral pathway.' },
  { id: 'flutter', sub: 'flutter', proto: { site: 'CS 9-10', kind: 'burst', s1: 230, dur: 2300, mA: 4 }, run: 7000, answer: 'Typical atrial flutter',
    explain: 'After the burst the atria keep going at about 230 ms in a fixed, repeating order, with only some beats conducted to the ventricles. A loop round the tricuspid annulus through the isthmus.' },
  { id: 'chb', sub: 'chb', proto: { kind: 'none' }, run: 6000, answer: 'Complete heart block with an escape rhythm',
    explain: 'Atrial and ventricular activity are independent: regular A at the sinus rate, slower regular V, no fixed relation. The escape QRS is narrow, so it comes from the His region.' },
  { id: 'infrahis', sub: 'infrahis', proto: { kind: 'none' }, run: 4000, answer: 'Infra-Hisian conduction disease (long HV)',
    explain: 'The AH is normal but the HV is well over 55 ms and the QRS is wide (left bundle branch block). Disease below the His carries a risk of sudden high-grade block.' },
  { id: 'concentric', sub: 'normal', proto: { site: 'RVA', kind: 'pace', s1: 500 }, run: 4500, answer: 'Concentric retrograde conduction through the AV node',
    explain: 'During RV pacing every V conducts back to the atria, earliest at the His region and CS ostium, then the distal CS later: the AV node.' },
  { id: 'eccentric', sub: 'concealed', proto: { site: 'RVA', kind: 'pace', s1: 500 }, run: 4500, answer: 'Eccentric retrograde conduction through a left lateral pathway',
    explain: 'During RV pacing the earliest atrial activation is at CS 1-2, before the His region: the impulse returns through a pathway on the lateral mitral annulus.' },
  { id: 'noncapture', sub: 'normal', proto: { site: 'HRA', kind: 'extra', s1: 600, n: 8, s2: 180 }, run: 6000, answer: 'S2 inside atrial refractoriness (no capture)',
    explain: 'The S2 artefact is followed by nothing on any channel, not even a local A on the HRA: the atrium itself was refractory. That is the atrial ERP, not AV nodal block.' },
];
export const ANSWERS = QUESTIONS.map((q) => q.answer);

/** Small seeded generator so a quiz order can be reproduced. */
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export function shuffle(a, r) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** Four options: the answer and three others, shuffled. */
export function options(q, r) { return shuffle([q.answer, ...shuffle(ANSWERS.filter((a) => a !== q.answer), r).slice(0, 3)], r); }
