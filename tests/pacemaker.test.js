import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pacemaker, SAFETY_MS } from '../src/sim/pacemaker.js';

/** Run the device for `ms` with signal functions a(t), v(t); returns markers. */
function run(settings, ms, a = () => 0, v = () => 0) {
  const pm = new Pacemaker(settings);
  for (let t = 0; t <= ms; t++) pm.step(t, a(t), v(t));
  return pm.log;
}
const times = (log, m) => log.filter((e) => e.m === m).map((e) => e.t);
const gaps = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
// a 5 ms deflection of amplitude mV at each time in `at`
const spikes = (at, mV) => (t) => (at.some((x) => t >= x && t < x + 5) ? mV : 0);

test('VVI paces at the lower rate with no intrinsic beats, and is inhibited by faster ones', () => {
  assert.deepEqual(gaps(times(run({ mode: 'VVI', lrl: 60 }, 5000), 'VP')), [1000, 1000, 1000, 1000]);
  const intrinsic = [300, 1100, 1900, 2700, 3500];
  const log = run({ mode: 'VVI', lrl: 60 }, 4000, undefined, spikes(intrinsic, 8));
  assert.equal(times(log, 'VS').length, 5);
  assert.equal(times(log, 'VP').length, 0);
});

test('undersensing: sensitivity set above the signal lets the device pace over intrinsic beats', () => {
  const log = run({ mode: 'VVI', lrl: 60, sensV: 10 }, 4000, undefined, spikes([300, 1100, 1900, 2700, 3500], 8));
  assert.equal(times(log, 'VS').length, 0);
  assert.ok(times(log, 'VP').length >= 3);
});

test('DDD tracks sensed atrial beats with the sensed AV delay', () => {
  const as = [500, 1300, 2100, 2900];
  const log = run({ mode: 'DDD', lrl: 60, sav: 150 }, 3200, spikes(as, 2));
  assert.deepEqual(times(log, 'AS'), as);
  assert.deepEqual(times(log, 'VP'), as.map((t) => t + 150));
  assert.equal(times(log, 'AP').length, 0);
});

test('DDD with no intrinsic activity: AP then VP after the paced AV delay, at the lower rate', () => {
  const log = run({ mode: 'DDD', lrl: 60, pav: 180 }, 3000);
  const ap = times(log, 'AP'), vp = times(log, 'VP');
  assert.ok(ap.length >= 2);
  assert.deepEqual(vp.slice(0, ap.length), ap.map((t) => t + 180));
  assert.deepEqual(gaps(vp), vp.slice(1).map(() => 1000));
});

test('upper rate: fast atrial rates are not tracked faster than the URI, and some fall in PVARP', () => {
  const as = Array.from({ length: 20 }, (_, k) => 200 + k * 400); // 150 /min
  const log = run({ mode: 'DDD', lrl: 60, url: 120, sav: 150, pvarp: 300 }, 8200, spikes(as, 2));
  const vp = times(log, 'VP');
  assert.ok(Math.min(...gaps(vp)) >= 500 - 1, `min V-V ${Math.min(...gaps(vp))}`);
  assert.ok(times(log, 'AR').length > 0, 'some atrial beats sensed in PVARP and not tracked');
});

test('ventricular blanking hides the atrial pace artefact; without it, safety pacing at 110 ms', () => {
  // artefact: the device's own atrial pace appears on the ventricular channel 1 ms later
  const withArtefact = (settings) => {
    const pm = new Pacemaker({ mode: 'DDD', lrl: 60, sensV: 0.5, ...settings });
    let art = -1;
    for (let t = 0; t <= 2000; t++) {
      const out = pm.step(t, 0, t >= art && t < art + 3 ? 1 : 0);
      if (out.some((o) => o.ch === 'A')) art = t + 1;
    }
    return pm.log;
  };
  const ok = withArtefact({ vBlank: 28 });
  assert.equal(times(ok, 'SP').length, 0);
  const cross = withArtefact({ vBlank: 0 });
  const ap = times(cross, 'AP'), sp = times(cross, 'SP');
  assert.ok(sp.length > 0);
  assert.equal(sp[0] - ap[0], SAFETY_MS);
  // with safety pacing off, crosstalk inhibits the ventricular output entirely
  const off = withArtefact({ vBlank: 0, safety: false });
  assert.equal(times(off, 'VP').length + times(off, 'SP').length, 0);
});

test('asynchronous modes ignore intrinsic signals', () => {
  const log = run({ mode: 'VOO', lrl: 60 }, 3000, undefined, spikes([300, 700, 1500], 10));
  assert.deepEqual(times(log, 'VP'), [0, 1000, 2000, 3000]);
  assert.equal(times(log, 'VS').length, 0);
});
