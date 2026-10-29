import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heart } from '../src/sim/heart.js';
import { Pacemaker } from '../src/sim/pacemaker.js';
import { runPaced, leadMv } from '../src/sim/device.js';
import { region } from '../src/sim/regions.js';

const marks = (pm, m, t0 = 0) => pm.log.filter((e) => e.m === m && e.t >= t0).map((e) => e.t);
const captured = (heart, t0, ch) => heart.log.filter((e) => e.kind === 'capture' && e.t >= t0 && e.id === (ch === 'A' ? 'hra' : 'rva')).length;

test('lead signals: P waves of a few mV on the RA lead, R waves near 10 mV on the RV lead', () => {
  const h = new Heart('normal'); h.step(2000);
  let a = 0, v = 0;
  for (let t = 800; t < 1600; t++) { a = Math.max(a, Math.abs(leadMv(h, 'A', t))); v = Math.max(v, Math.abs(leadMv(h, 'V', t))); }
  assert.ok(a > 1.5 && a < 6, `A ${a}`);
  assert.ok(v > 5 && v < 20, `V ${v}`);
});

test('DDD in complete heart block: senses sinus P waves and paces the ventricle after the sensed AV delay, with capture', () => {
  const h = new Heart('chb'), pm = new Pacemaker({ mode: 'DDD', lrl: 50 });
  runPaced(h, pm, 8000);
  const as = marks(pm, 'AS', 2000), vp = marks(pm, 'VP', 2000);
  assert.ok(as.length >= 6, `AS ${as.length}`);
  assert.ok(vp.length >= as.length - 1);
  assert.ok(captured(h, 2000, 'V') >= vp.length - 1);
  assert.equal(marks(pm, 'AP', 2000).length, 0, 'sinus at 75 is above the lower rate: no atrial pacing');
});

test('loss of capture: an output below threshold paces without capturing', () => {
  const h = new Heart('chb'), pm = new Pacemaker({ mode: 'VVI', lrl: 70, outV: 0.2 });
  runPaced(h, pm, 6000);
  assert.ok(marks(pm, 'VP').length >= 3); // escape beats still inhibit it between pacing spikes
  assert.equal(captured(h, 0, 'V'), 0);
});

test('AAI in sinus node dysfunction: paces the atrium at the lower rate and conducts normally', () => {
  const h = new Heart('snd'), pm = new Pacemaker({ mode: 'AAI', lrl: 70 });
  runPaced(h, pm, 8000);
  const ap = marks(pm, 'AP', 2000);
  assert.ok(ap.length >= 6);
  assert.ok(captured(h, 2000, 'A') >= ap.length - 1);
  assert.ok(h.acts('his', 2000).length >= ap.length - 1, 'paced atrial beats conduct to the His');
});

test('myopotential oversensing inhibits VVI pacing in a pacemaker-dependent patient', () => {
  const quiet = new Pacemaker({ mode: 'VVI', lrl: 60, sensV: 1 }), noisy = new Pacemaker({ mode: 'VVI', lrl: 60, sensV: 1 });
  runPaced(new Heart('chb'), quiet, 10000);
  runPaced(new Heart('chb'), noisy, 10000, { noisy: true });
  assert.ok(marks(noisy, 'VP').length < marks(quiet, 'VP').length - 2);
});

test('pacemaker-mediated tachycardia: a PVC with retrograde conduction starts tracking at the upper rate; a long PVARP prevents it', () => {
  const pmt = (pvarp) => {
    const h = new Heart('chbva'), pm = new Pacemaker({ mode: 'DDD', lrl: 60, url: 130, pvarp });
    runPaced(h, pm, 3000);
    h.stim(3000.5, 'lvl', { mA: 5, pw: 1, pos: region('lvl').pos }); // a PVC
    runPaced(h, pm, 8000);
    return marks(pm, 'VP', 4000);
  };
  const short = pmt(200), long = pmt(400);
  const gap = (v) => (v.at(-1) - v[0]) / (v.length - 1);
  assert.ok(gap(short) < 520, `PMT V-V ${gap(short)}`);
  assert.ok(gap(long) > 650, `no PMT V-V ${gap(long)}`);
});
