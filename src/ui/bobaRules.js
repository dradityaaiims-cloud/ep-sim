// Boba's tips are plain rules over what the simulator is doing: no AI model, no network.
// Pure functions (testable in Node). Same shape as the other Dr. Singh simulators' Boba.
// ctx = { t (s since load), flags, lab ('ep'|'pm'), pm (settings), noisy, sub, speed, pacing, lastS2 }

export const RULES = [
  { id: 'pmLab', cool: 1e12, when: (c) => c.lab === 'pm', text: () => 'This is a generic dual-chamber pacemaker in a patient with complete heart block. The bottom row is the marker channel: AS/VS sensed, AP/VP paced, AR/VR sensed but ignored (refractory). Try lowering the V output until a VP stops capturing.' },
  { id: 'pmNoise', cool: 1e12, when: (c) => c.lab === 'pm' && c.noisy, text: () => 'Muscle noise on the ventricular lead looks like R waves to the device, so it withholds pacing: dangerous in a pacemaker-dependent patient. Make the V sensitivity less sensitive (a larger number), or switch to VOO for a moment.' },
  { id: 'pmPmt', cool: 1e12, when: (c) => c.lab === 'pm' && c.sub === 'chbva' && c.flags.pvc, text: () => 'If the PVC conducted back to the atrium after PVARP ended, the device sensed that retrograde P wave and paced the ventricle again: a loop at the upper rate (PMT). Lengthen PVARP beyond the VA time to stop it.' },
  { id: 'pmVa', cool: 1e12, when: (c) => c.lab === 'pm' && c.sub === 'chbva' && !c.flags.pvc, text: () => 'This patient conducts backwards from ventricle to atrium. Set PVARP to 200 ms and press V for a PVC.' },
  { id: 'tour', cool: 1e12, when: (c) => c.t > 40 && !c.flags.toured, text: () => 'New here? The Tour walks through the screen in about two minutes.' },
  { id: 'speed', cool: 1e12, when: (c) => c.t > 25 && !c.flags.usedSpeed, text: () => 'Set the speed to ⅕× (key 3) and watch one sinus beat travel: sinus node, atria, a pause in the AV node, then the His and the ventricles all at once.' },
  { id: 'pace', cool: 1e12, when: (c) => c.lab !== 'pm' && c.t > 60 && !c.flags.paced, text: () => 'Try incremental pacing: Pace from HRA at 600 ms, then 400, then 330. Watch the AH on the His channel grow until an A has no H after it.' },
  { id: 'extra', cool: 1e12, when: (c) => c.lab !== 'pm' && c.flags.paced && !c.flags.extra && c.t > 90, text: () => 'Choose "Drive train + extrastimuli": 8 beats at 600 ms then an S2 at 400. Press D to shorten the S2 by 10 ms each time and find the AV nodal ERP.' },
  { id: 'dual', cool: 1e12, when: (c) => c.lab !== 'pm' && c.sub === 'dual' && c.flags.decrements > 3, text: () => 'Watch A2H2 as you shorten S2. A sudden jump of 50 ms or more means the impulse has switched from the fast to the slow pathway. A little shorter, and it may come back up the fast pathway.' },
  { id: 'wpw', cool: 1e12, when: (c) => c.lab !== 'pm' && c.sub === 'wpw', text: () => 'Look at the His channel: the V comes very soon after the H, or even before it. The ventricle is being reached early through the pathway. Which CS pair shows the earliest V?' },
  { id: 'concealed', cool: 1e12, when: (c) => c.lab !== 'pm' && c.sub === 'concealed', text: () => 'Sinus rhythm looks normal here. Pace from the RVA and look at the atrial signals: which channel is earliest, the His or CS 1-2?' },
  { id: 'snd', cool: 1e12, when: (c) => c.lab !== 'pm' && c.sub === 'snd', text: () => 'Pace the HRA at 500 ms for 30 beats (burst for 15 s), stop, and measure the pause to the first sinus beat with the calipers (K): that is the sinus node recovery time.' },
  { id: 'truth', cool: 1e12, when: (c) => c.flags.decrements > 1 && !c.flags.usedTruth, text: () => 'Press T for the Truth list. When an S2 has no response, it tells you whether it failed to capture or blocked, and where.' },
  { id: 'caliper', cool: 1e12, when: (c) => c.t > 150 && !c.flags.usedCaliper, text: () => 'Freeze (F) and press K for calipers. Drag the green lines to measure any interval to the millisecond.' },
  { id: 'learn', cool: 1e12, when: (c) => c.t > 200 && !c.flags.openedLearn, text: () => 'The Learn tab has a short guide for each heart, with a button that loads it here.' },
];

export const GENERAL = [
  'AH is the AV node; HV is the His–Purkinje system. Normal AH 55–125 ms, HV 35–55 ms.',
  'The AV node conducts more slowly when the impulse arrives early. The His–Purkinje system does not.',
  'An ERP is the longest coupling interval that fails to conduct through a structure. Always say from where, at what drive cycle length.',
  'Retrograde atrial activation earliest at the His region is concentric (AV node). Earliest elsewhere is eccentric (accessory pathway).',
  'At a pulse width equal to the chronaxie, the capture threshold is twice the rheobase.',
  'In typical AVNRT the atrium and ventricle activate almost together: the A sits on or just after the V.',
  'Pacemaker: tissue refractoriness decides whether the heart can respond; device refractoriness decides whether a sensed signal resets the timers.',
  'Total atrial refractory period (TARP) = sensed AV delay + PVARP. Atrial rates faster than 60000/TARP per minute give 2:1 block in DDD.',
];

/** First rule that applies and is not cooling down. */
export function nextRule(ctx, fired, now) {
  for (const r of RULES) {
    const last = fired.get(r.id);
    if (last != null && now - last < r.cool) continue;
    try { if (r.when(ctx)) return { key: r.id, text: r.text }; } catch { /* missing context */ }
  }
  return null;
}
