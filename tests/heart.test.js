import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heart, threshold } from '../src/sim/heart.js';
import { schedule } from '../src/sim/protocols.js';
import { hisBeats, sequence, waves, meanCL, VENT } from '../src/sim/measure.js';
import { REGIONS, SUBSTRATES, buildEdges } from '../src/sim/regions.js';

/** Run a protocol from `site` starting at t0; returns the heart and the stimulus times. */
function pace(sub, site, p, { t0 = 600, tail = 3000, mA = 2, pw = 2 } = {}) {
  const h = new Heart(sub); h.step(t0 - 100);
  const s = schedule(p).map((x) => ({ ...x, t: t0 + x.t }));
  for (const x of s) h.stim(x.t, site, { mA, pw });
  h.step(s.at(-1).t + tail);
  return { h, s };
}
const firstV = (h, t0, t1) => Math.min(...VENT.map((id) => h.acts(id, t0).find((t) => t < t1) ?? Infinity));

test('graph is connected and every substrate names real regions', () => {
  const adj = buildEdges();
  const seen = new Set(['sa']), stack = ['sa'];
  while (stack.length) for (const e of adj[stack.pop()]) if (!seen.has(e.to)) { seen.add(e.to); stack.push(e.to); }
  assert.equal(seen.size, REGIONS.length);
  for (const s of Object.values(SUBSTRATES)) for (const id of Object.keys(s.patch)) assert.ok(REGIONS.some((r) => r.id === id), id);
});

test('normal sinus rhythm: CL 800, AH 55-125, HV 35-55, narrow QRS', () => {
  const h = new Heart('normal'); h.step(5000);
  const b = hisBeats(h, 1000, 5000);
  assert.equal(b.length, 5);
  for (const x of b) { assert.ok(x.ah >= 55 && x.ah <= 125, `AH ${x.ah}`); assert.ok(x.hv >= 35 && x.hv <= 55, `HV ${x.hv}`); }
  assert.ok(Math.abs(meanCL(b.map((x) => x.h)) - 800) < 2);
  const w = waves(h, 1000, 5000);
  const qrs = Math.max(...VENT.map((id) => h.acts(id, w.v[1]).find((t) => t < w.v[1] + 300) ?? -Infinity)) - w.v[1];
  assert.ok(qrs < 120, `QRS spread ${qrs}`);
});

test('incremental atrial pacing: AH lengthens, then AV nodal Wenckebach at CL 300-500', () => {
  let wcl = null;
  for (let cl = 600; cl >= 250 && wcl == null; cl -= 25) {
    const { h, s } = pace('normal', 'hra', { kind: 'drive', s1: cl, n: 12 });
    const blocked = s.slice(2).some((x) => !h.acts('his', x.t).some((t) => t < x.t + cl));
    if (blocked) wcl = cl;
  }
  assert.ok(wcl >= 300 && wcl <= 500, `Wenckebach CL ${wcl}`);
  const slow = hisBeats(pace('normal', 'hra', { kind: 'drive', s1: 600, n: 10 }).h, 3000, 6000)[0].ah;
  const fast = hisBeats(pace('normal', 'hra', { kind: 'drive', s1: wcl + 25, n: 10 }).h, 3000, 6000)[0].ah;
  assert.ok(fast > slow + 20, `AH ${slow} -> ${fast}`);
});

/** Shortest S2 that conducts to the His (AV nodal ERP is the longest S2 that blocks). */
function avnERP(sub) {
  for (let s2 = 500; s2 >= 150; s2 -= 10) {
    const { h, s } = pace(sub, 'hra', { kind: 'extra', s1: 600, n: 8, s2 });
    const S2 = s.at(-1).t;
    const cap = h.log.find((e) => e.t === S2 && e.kind === 'capture');
    if (!cap) return { erp: null, aerp: s2 };
    if (!h.acts('his', S2).some((t) => t < S2 + 600)) return { erp: s2 };
  }
  return {};
}

test('S1-S2 at 600: AV nodal ERP 230-400 ms, longer than atrial ERP', () => {
  const { erp } = avnERP('normal');
  assert.ok(erp >= 230 && erp <= 400, `AVN ERP ${erp}`);
  const { h, s } = pace('normal', 'hra', { kind: 'extra', s1: 600, n: 8, s2: 180 });
  assert.ok(h.log.some((e) => e.t === s.at(-1).t && e.kind === 'nocapture' && e.why === 'refractory'), 'atrial ERP > 180');
});

test('dual pathways: AH jump >= 50 ms and inducible slow-fast AVNRT with short septal VA', () => {
  let prev = null, jump = 0, induced = null;
  for (let s2 = 450; s2 >= 250; s2 -= 10) {
    const { h, s } = pace('dual', 'hra', { kind: 'extra', s1: 600, n: 8, s2 }, { tail: 4000 });
    const S2 = s.at(-1).t;
    const b = hisBeats(h, S2, S2 + 600)[0];
    if (b && prev != null) jump = Math.max(jump, b.ah - prev);
    if (b) prev = b.ah;
    const his = h.acts('his', S2 + 1000);
    if (his.length > 6 && !induced) induced = { h, his };
  }
  assert.ok(jump >= 50, `largest AH step ${jump}`);
  assert.ok(induced, 'AVNRT not induced');
  const cl = meanCL(induced.his.slice(0, 6));
  assert.ok(cl > 270 && cl < 480, `AVNRT CL ${cl}`);
  const h0 = induced.his[2], v = firstV(induced.h, h0 - 20, h0 + 150), a = induced.h.acts('sra', h0 - 50).find((t) => t < h0 + 200);
  assert.ok(a - v < 70, `septal VA ${a - v}`);
  // normal heart: no jump big enough for reentry
  const n = pace('normal', 'hra', { kind: 'extra', s1: 600, n: 8, s2: 300 }, { tail: 4000 });
  assert.ok(n.h.acts('his', n.s.at(-1).t + 1000).length < 6, 'no AVNRT in the normal heart');
});

test('WPW: sinus beats are pre-excited, with the earliest ventricle at the basal lateral LV', () => {
  const h = new Heart('wpw'); h.step(4000);
  const w = waves(h, 1600, 4000);
  const seq = sequence(h, VENT, w.v[0] - 1, w.v[0] + 200);
  const earliest = Object.entries(seq).sort((a, b) => a[1] - b[1])[0][0];
  assert.equal(earliest, 'lvb');
  const his = h.acts('his', w.a[0])[0];
  assert.ok(w.v[0] < his + 35, 'ventricle activates before the normal HV');
});

test('retrograde atrial activation in RV pacing: concentric via the AV node, eccentric via a left lateral pathway', () => {
  const order = (sub) => {
    const { h, s } = pace(sub, 'rva', { kind: 'drive', s1: 500, n: 8 });
    const t = s[5].t;
    const seq = sequence(h, ['sra', 'csos', 'cs56', 'cs12', 'hra'], t, t + 450);
    return Object.entries(seq).sort((a, b) => a[1] - b[1])[0]?.[0];
  };
  assert.equal(order('normal'), 'sra');
  assert.equal(order('concealed'), 'cs12');
  // the concealed pathway does not conduct antegrade: sinus rhythm is not pre-excited
  const h = new Heart('concealed'); h.step(3000);
  const w = waves(h, 1600, 3000);
  assert.ok(w.v[0] > h.acts('his', w.a[0])[0] + 30);
});

test('orthodromic AVRT can be induced with a concealed pathway', () => {
  let ok = false;
  for (let s2 = 400; s2 >= 220 && !ok; s2 -= 10) {
    const { h, s } = pace('concealed', 'rva', { kind: 'extra', s1: 600, n: 8, s2 }, { tail: 4000 });
    const t = s.at(-1).t + 1500;
    ok = h.acts('his', t).length >= 4 && h.acts('cs12', t).length >= 4;
  }
  if (!ok) for (let s2 = 400; s2 >= 220 && !ok; s2 -= 10) {
    const { h, s } = pace('concealed', 'hra', { kind: 'extra', s1: 600, n: 8, s2 }, { tail: 4000 });
    const t = s.at(-1).t + 1500;
    ok = h.acts('his', t).length >= 4 && h.acts('cs12', t).length >= 4;
  }
  assert.ok(ok, 'AVRT not induced');
});

test('complete heart block: atria at the sinus rate, ventricles at a slower dissociated escape rate', () => {
  const h = new Heart('chb'); h.step(12000);
  const w = waves(h, 2000, 12000);
  assert.ok(Math.abs(meanCL(w.a) - 800) < 5);
  assert.ok(meanCL(w.v) > 1400, `escape CL ${meanCL(w.v)}`);
});

test('infra-Hisian disease: long HV', () => {
  const h = new Heart('infrahis'); h.step(4000);
  const b = hisBeats(h, 1000, 4000);
  assert.ok(b.every((x) => x.hv > 55), JSON.stringify(b));
});

test('sinus node recovery time: normal < 1500 ms, prolonged in sinus node dysfunction', () => {
  const snrt = (sub) => {
    const { h, s } = pace(sub, 'hra', { kind: 'drive', s1: 500, n: 30 }, { tail: 5000 });
    const last = s.at(-1).t;
    return h.log.find((e) => e.kind === 'act' && e.id === 'sa' && e.src === 'auto' && e.t > last).t - last;
  };
  assert.ok(snrt('normal') < 1500, `normal ${snrt('normal')}`);
  assert.ok(snrt('snd') > 2000, `SND ${snrt('snd')}`);
});

test('capture follows strength-duration and fails below threshold or in refractoriness', () => {
  assert.ok(threshold(0.5, 0.4, 0.2) > threshold(0.5, 0.4, 1.0));
  assert.equal(threshold(0.5, 0.4, 0.4), 1.0); // at the chronaxie the threshold is twice rheobase
  const h = new Heart('normal'); h.step(300);
  h.stim(650, 'rva', { mA: 0.3, pw: 0.5 }); h.stim(1300, 'rva', { mA: 2, pw: 0.5 }); h.stim(1400, 'rva', { mA: 10, pw: 0.5 });
  h.step(1600);
  const k = (t) => h.log.find((e) => e.t === t && (e.kind === 'capture' || e.kind === 'nocapture'));
  assert.equal(k(650).kind, 'nocapture'); assert.equal(k(650).why, 'below threshold');
  assert.equal(k(1300).kind, 'capture');
  assert.equal(k(1400).why, 'refractory');
});

test('protocol schedules', () => {
  assert.deepEqual(schedule({ kind: 'extra', s1: 600, n: 3, s2: 300, s3: 250 }).map((x) => x.t), [0, 600, 1200, 1500, 1750]);
  assert.equal(schedule({ kind: 'burst', s1: 200, dur: 1000 }).length, 5);
  assert.equal(schedule({ kind: 'incremental', from: 600, to: 500, stepMs: 50, perStep: 2 }).length, 6);
});

test('atrial flutter: burst pacing starts an isthmus-dependent loop at CL 200-300 with AV block; not in the normal heart', () => {
  const run = (sub) => pace(sub, 'csos', { kind: 'burst', s1: 230, dur: 2300 }, { tail: 6000, mA: 4 });
  const { h, s } = run('flutter');
  const t = s.at(-1).t + 2000, cti = h.acts('cti', t);
  const cl = meanCL(cti);
  assert.ok(cti.length > 10 && cl > 200 && cl < 300, `flutter CL ${cl}`);
  assert.ok(h.acts('his', t).length < cti.length / 1.5, 'AV nodal block during flutter');
  const n = run('normal');
  assert.ok(n.h.acts('cti', n.s.at(-1).t + 2000).length < 6, 'no flutter in the normal heart');
});
