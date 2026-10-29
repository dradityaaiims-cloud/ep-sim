import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, options, rng } from '../src/modes/quizBank.js';
import { EP_CASES, PM_CASES, scoreEP, scorePM, checkPM } from '../src/modes/cases.js';
import { SUBSTRATES } from '../src/sim/regions.js';
import { PACE_SITES } from '../src/sim/catheters.js';
import { Pacemaker } from '../src/sim/pacemaker.js';
import { TRACKS, bipoles, targetU, scorePlacement, along } from '../src/modes/placement.js';
import { egm } from '../src/sim/signals.js';
import { Heart } from '../src/sim/heart.js';

test('quiz: every question uses a real heart and pacing site, and offers four distinct options including the answer', () => {
  const r = rng(7);
  for (const q of QUESTIONS) {
    assert.ok(SUBSTRATES[q.sub], q.id);
    if (q.proto.site) assert.ok(PACE_SITES.some((s) => s.id === q.proto.site), q.id);
    const o = options(q, r);
    assert.equal(new Set(o).size, 4); assert.ok(o.includes(q.answer));
  }
});

test('EP case scoring adds to 100 for a perfect study and explains a wrong diagnosis', () => {
  const c = EP_CASES[0];
  const best = scoreEP(c, { picked: c.answer, measured: { ah: 80, hv: 40 }, truth: { ah: 82, hv: 39 }, did: { extra: true, deliveries: 3 }, secs: 200 });
  assert.equal(best.score, 100);
  const worst = scoreEP(c, { picked: 'Normal EP study', truth: { ah: 82, hv: 39 }, did: {}, secs: 900 });
  assert.equal(worst.score, 0);
  assert.match(worst.items[0].note, /AH jump/);
  for (const k of EP_CASES) assert.ok(SUBSTRATES[k.sub], k.id);
});

test('each pacemaker case is broken as given and fixed by the textbook change', () => {
  const FIX = { pm1: { outV: 2.5 }, pm2: { sensV: 2.5 }, pm3: { sensV: 2.5 }, pm4: { pvarp: 350 }, pm5: { vBlank: 28, safety: true } };
  for (const c of PM_CASES) {
    const broken = checkPM(c, c.settings);
    assert.equal(c.fixed(broken.pm, broken), false, `${c.id} should start broken`);
    const s = { ...c.settings, ...FIX[c.id] }, ok = checkPM(c, s);
    assert.equal(c.fixed(ok.pm, ok), true, `${c.id} should be fixed by ${JSON.stringify(FIX[c.id])}`);
    assert.equal(scorePM(c, { picked: c.answer, settings: s, secs: 100 }).score, 100);
  }
  assert.ok(new Pacemaker().s.vBlank > 0);
});


test('placement: every catheter can reach its target, and the His electrogram shows an H only in the right place', () => {
  const us = Object.fromEntries(Object.keys(TRACKS).map((id) => [id, targetU(id)]));
  assert.equal(scorePlacement(us).score, 100);
  assert.equal(scorePlacement(Object.fromEntries(Object.keys(TRACKS).map((id) => [id, 0]))).score, 0);
  assert.deepEqual(along([[0, 0, 0], [2, 0, 0]], 0.5), [1, 0, 0]);
  // H spike size on the distal His pair: biggest at the target, small when too atrial
  const h = new Heart('normal'); h.step(2000);
  const hisT = h.acts('his', 800)[0];
  const spike = (u) => { const p = bipoles('his', u)[0]; let m = 0; for (let t = hisT - 5; t < hisT + 20; t++) m = Math.max(m, Math.abs(egm(h, p, t))); return m; };
  assert.ok(spike(targetU('his')) > 2 * spike(0.3), `${spike(targetU('his'))} vs ${spike(0.3)}`);
});
