// App bootstrap: wires the heart engine, stimulator, recording system, 3D heart, pages, tour and Boba.
import { Heart } from './sim/heart.js';
import { SUBSTRATES, region } from './sim/regions.js';
import { schedule } from './sim/protocols.js';
import { ecg, egm } from './sim/signals.js';
import { CHANNELS, PM_CHANNELS, PACE_SITES, contactRegion } from './sim/catheters.js';
import { Pacemaker, MODES } from './sim/pacemaker.js';
import { runPaced, leadMv } from './sim/device.js';
import { hisBeats, waves, meanCL, describe } from './sim/measure.js';
import { Recorder } from './render/recorder.js';
import { Heart3D } from './render/heart3d.js';
import { store, el } from './ui/dom.js';
import { initLearn } from './learn/learn.js';
import { initBoba } from './ui/boba.js';
import { startTour } from './ui/tour.js';
import { renderAbout } from './pages/about.js';
import { MODEL_HTML } from './pages/model.js';
import { QuizMode, PlaceMode, CaseMode } from './modes/modes.js';
import { bipoles, TRACKS } from './modes/placement.js';
import { CATHETERS } from './sim/catheters.js';
import { DEFAULTS } from './sim/pacemaker.js';

const $ = (id) => document.getElementById(id);
const LAG = 40; // the display trails the engine, so every drawn sample has its activations and the device only sees the past

let heart = new Heart('normal');
let simT = 0, last = performance.now(), frozen = false, speed = 1;
let pacer = null;         // continuous pacing: { next, cl, site }
let protoEnd = 0;         // end time of the running protocol
let lab = 'ep';           // 'ep' or 'pm'
const pm = new Pacemaker();
let noisy = false;        // myopotential noise on the ventricular lead
let quietMode = false;    // quiz and cases: no notices that would name the heart
let pendingPVC = null;    // sim time of a scheduled PVC (pacemaker cases)
let did = {};             // what the learner has delivered in the current case
let modeId = 'explore', curMode = null;
const flags = { paced: false, extra: false, decrements: 0, usedTruth: false, usedSpeed: false, usedCaliper: false, openedLearn: false, toured: store.get('ep.toured', false), changedHeart: false };
const app = { get heart() { return heart; }, get simT() { return simT; }, get lab() { return lab; }, pm, flags, lastS2: null };

// ── recording and 3D ─────────────────────────────────────────────────────
const rec = new Recorder($('recorder'), CHANNELS, (ch, t) => (ch.kind === 'ecg' ? ecg(heart, ch.id, t) : ch.kind === 'lead' ? leadMv(heart, ch.ch, t, { noisy }) : egm(heart, ch.pos, t)));
rec.markerSource = () => pm.log;
const h3 = new Heart3D($('heartMount'), $('heartLabels'));

// ── controls ─────────────────────────────────────────────────────────────
for (const [id, s] of Object.entries(SUBSTRATES)) $('substrate').append(el('option', { value: id }, s.name));
for (const s of PACE_SITES) $('paceSite').append(el('option', { value: s.id }, s.id));
$('paceSite').value = 'HRA';
const num = (id) => Number($(id).value);
const site = () => PACE_SITES.find((s) => s.id === $('paceSite').value);
const opts = () => ({ mA: num('mA'), pw: num('pw'), pos: site().pos });

function setSubstrate(id, { sinus } = {}) {
  heart = new Heart(id); simT = 0; pacer = null; protoEnd = 0; app.lastS2 = null; pm.reset(0);
  rec.clear(); $('substrate').value = id; $('subBlurb').textContent = SUBSTRATES[id].blurb;
  if (SUBSTRATES[id].pacer && lab === 'pm') { $('pmSub').value = id; $('pmBlurb').textContent = SUBSTRATES[id].blurb; }
  if (sinus) $('sinus').value = sinus;
  if (lab === 'pm') setSinus();
  if (id !== 'normal') flags.changedHeart = true;
  notice(`${SUBSTRATES[id].name}`);
}

function syncProtocol() {
  const p = $('protocol').value;
  document.querySelectorAll('.stim .x').forEach((e) => { e.hidden = p !== 'extra'; });
  document.querySelectorAll('.stim .b').forEach((e) => { e.hidden = p !== 'burst'; });
  $('btnDec').hidden = p !== 'extra';
}
$('protocol').onchange = syncProtocol;

function stim(t, label) {
  const s = site(), id = contactRegion(s.pos);
  heart.stim(t, id, opts());
  rec.mark(t, label, label === 'S1' ? '#ff6b6b' : '#ffb02e');
}

function deliver() {
  stopPacing(false);
  const kind = $('protocol').value, start = simT + 150, atrial = site().cath !== 'rva';
  flags.paced = true;
  did.deliveries = (did.deliveries ?? 0) + 1;
  if (site().cath === 'rva') did.rv = true;
  if (kind === 'extra') did.extra = true;
  if (kind === 'burst') { did.burst = true; if (atrial && num('dur') >= 10000) did.snrt = true; }
  if (kind === 'pace') { pacer = { next: start, cl: num('s1'), start, atrial }; notice(`Pacing ${site().id} at ${num('s1')} ms (${Math.round(60000 / num('s1'))} /min)`); return; }
  const p = kind === 'extra' ? { kind, s1: num('s1'), n: num('n'), s2: num('s2'), s3: num('s3') || 0 } : { kind, s1: num('s1'), dur: num('dur') };
  const list = schedule(p);
  for (const x of list) stim(start + x.t, x.label);
  protoEnd = start + list.at(-1).t;
  if (kind === 'extra') {
    flags.extra = true;
    const tS2 = start + list.find((x) => x.label === 'S2').t;
    app.lastS2 = { t: tS2, s2: p.s2, site: site().id };
    notice(`${p.n} × S1 ${p.s1} ms, S2 ${p.s2} ms${p.s3 ? `, S3 ${p.s3} ms` : ''} from ${site().id}`);
  } else notice(`Burst from ${site().id} at ${p.s1} ms for ${p.dur / 1000} s`);
}
function stopPacing(say = true) {
  // drop stimuli not yet delivered
  if (pacer?.atrial && simT - pacer.start >= 10000) did.snrt = true; // overdrive pacing then stop: SNRT
  heart.q = heart.q.filter((e) => e.kind !== 'stim' || e.t <= simT);
  rec.marks = rec.marks.filter((m) => m.t <= simT);
  pacer = null; protoEnd = 0;
  if (say) notice('Pacing stopped');
}
$('btnGo').onclick = deliver;
$('btnStop').onclick = () => stopPacing();
$('btnDec').onclick = () => { $('s2').value = Math.max(100, num('s2') - 10); flags.decrements++; deliver(); };
$('substrate').onchange = () => setSubstrate($('substrate').value);
$('speed').onchange = () => { speed = Number($('speed').value); flags.usedSpeed = speed < 1; };

let noticeTimer = null;
function notice(msg) {
  if (quietMode) return;
  const n = $('notice'); n.textContent = msg; n.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { n.hidden = true; }, 4000);
}

// ── readouts ─────────────────────────────────────────────────────────────
const fmt = (v) => (v == null ? '–' : `${Math.round(v)}`);
function renderIntervals() {
  if (lab === 'pm') return renderPacer();
  const beats = hisBeats(heart, simT - 3000, simT - 150).filter((b) => b.h <= simT);
  const b = beats.at(-1), w = waves(heart, simT - 4000, simT);
  const aa = meanCL(w.a.slice(-3)), vv = meanCL(w.v.slice(-3));
  let s2 = '';
  if (app.lastS2 && simT > app.lastS2.t + 400) {
    const after = hisBeats(heart, app.lastS2.t, app.lastS2.t + 600)[0];
    const cap = heart.log.find((e) => e.t === app.lastS2.t && (e.kind === 'capture' || e.kind === 'nocapture'));
    s2 = `<div class="s2">S2 ${app.lastS2.s2}: ${!cap || cap.kind === 'nocapture' ? 'no capture (tissue refractory)' : after ? `A2H2 ${fmt(after.ah)} ms` : 'blocked before the His'}</div>`;
  }
  $('intervals').innerHTML = `<div><b>AH</b> ${fmt(b?.ah)} <b>HV</b> ${fmt(b?.hv)} ms</div><div><b>A–A</b> ${fmt(aa)} <b>V–V</b> ${fmt(vv)} ms</div>${s2}`;
}
function renderPacer() {
  const recent = (m) => pm.log.filter((e) => e.t > simT - 6000 && m.includes(e.m)).map((e) => e.t);
  const w = waves(heart, simT - 6000, simT), vv = meanCL(w.v.slice(-4));
  const v = recent(['VP', 'SP', 'VS']), paced = recent(['VP', 'SP']).length;
  const fails = heart.log.filter((e) => e.t > simT - 6000 && e.kind === 'nocapture');
  const below = fails.filter((e) => e.why === 'below threshold').length, refr = fails.length - below;
  $('intervals').innerHTML = `<div><b>${pm.s.mode}</b> ${pm.s.lrl}${MODES[pm.s.mode].senseA && MODES[pm.s.mode].paceV ? `–${pm.s.url}` : ''} /min</div>`
    + `<div><b>Heart rate</b> ${vv ? Math.round(60000 / vv) : '–'} /min</div>`
    + `<div><b>V paced</b> ${v.length ? Math.round((100 * paced) / v.length) : 0}%</div>`
    + (below ? `<div class="s2">${below} output${below > 1 ? 's' : ''} below threshold: loss of capture</div>` : '')
    + (refr ? `<div class="s3">${refr} output${refr > 1 ? 's' : ''} into refractory tissue</div>` : '');
}
function renderTruth() {
  if ($('truth').hidden) return;
  const ev = heart.log.filter((e) => e.t <= simT && e.t > simT - 6000 && ['block', 'conceal', 'nocapture', 'capture'].includes(e.kind) || (e.kind === 'act' && ['ap', 's3'].includes(e.id) && e.t <= simT && e.t > simT - 6000));
  $('truth').replaceChildren(...ev.slice(-9).reverse().map((e) => el('li', { class: e.kind }, `${(e.t / 1000).toFixed(2)} s  ${describe(e)}`)));
}

// ── pacemaker lab ────────────────────────────────────────────────────────
for (const [id, s] of Object.entries(SUBSTRATES)) if (s.pacer) $('pmSub').append(el('option', { value: id }, s.name));
$('pmSub').value = 'chb';
const pmInputs = [...document.querySelectorAll('[data-pm]')];
function syncProgrammer() {
  for (const i of pmInputs) { if (i.type === 'checkbox') i.checked = pm.s[i.dataset.pm]; else i.value = pm.s[i.dataset.pm]; }
  $('pmMode').value = pm.s.mode;
  const m = MODES[pm.s.mode], dual = pm.s.mode === 'DDD' || pm.s.mode === 'DOO';
  const show = (cls, on) => document.querySelectorAll(`#pmCtl .${cls}`).forEach((e) => { e.hidden = !on; });
  show('dd', dual); show('sa', m.senseA); show('sv', m.senseV); show('pa', m.paceA); show('pv', m.paceV);
}
for (const i of pmInputs) i.onchange = () => { pm.set({ [i.dataset.pm]: i.type === 'checkbox' ? i.checked : Number(i.value) }); flags.programmed = true; };
$('pmMode').onchange = () => { pm.set({ mode: $('pmMode').value }); pm.reset(simT); syncProgrammer(); flags.programmed = true; notice(`Mode ${pm.s.mode}`); };
function setSinus() { heart.nodes.sa.auto = 60000 / Math.max(30, num('sinus')); }
$('sinus').onchange = setSinus;
$('pmSub').onchange = () => setSubstrate($('pmSub').value);
function pvc() { heart.stim(simT + 1, 'lvl', { mA: 5, pw: 1, pos: region('lvl').pos }); flags.pvc = true; notice('PVC'); }
$('btnPVC').onclick = pvc;
function setNoiseOn(v) { noisy = v; $('btnNoise').classList.toggle('on', v); }
$('btnNoise').onclick = () => { setNoiseOn(!noisy); notice(noisy ? 'Myopotential noise on the ventricular lead' : 'Noise off'); };
function setLab(name, { hideControls = false, hideSubstrate = false } = {}) {
  lab = name;
  document.body.classList.toggle('hide-ctl', hideControls); document.body.classList.toggle('hide-sub', hideSubstrate);
  $('pmCtl').hidden = name !== 'pm'; $('epCtl').hidden = name === 'pm';
  rec.setChannels(name === 'pm' ? PM_CHANNELS : CHANNELS);
  h3.showCaths(name === 'pm'); h3.setPacing(null);
  stopPacing(false); setNoiseOn(false);
  setSubstrate(name === 'pm' ? ($('pmSub').value || 'chb') : 'normal');
  syncProgrammer();
}

// ── frame loop ───────────────────────────────────────────────────────────
function advance(ms) {
  simT += ms;
  if (lab === 'pm') {
    if (pendingPVC != null && simT >= pendingPVC) { pvc(); pendingPVC = null; }
    runPaced(heart, pm, Math.floor(simT), { noisy });
    if (pm.log.length > 200) pm.log = pm.log.filter((e) => e.t > simT - 10000);
  } else {
    if (pacer) while (pacer.next < simT + 100) { stim(pacer.next, 'S1'); pacer.next += pacer.cl; }
    heart.step(simT);
  }
  heart.trim(simT - 8000);
  rec.advance(simT - LAG);
}
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  if (!frozen) advance(dt * speed);
  rec.draw();
  h3.update(heart, simT - LAG);
  if (now - (frame.ro ?? 0) > 250) { frame.ro = now; renderIntervals(); renderTruth(); }
  requestAnimationFrame(frame);
}

// ── tools ────────────────────────────────────────────────────────────────
const toggle = (btn, on) => { btn.classList.toggle('on', on); return on; };
function setFrozen(v) { frozen = v; toggle($('btnFreeze'), v); $('frozen').hidden = !v; }
$('btnFreeze').onclick = () => setFrozen(!frozen);
$('btnCaliper').onclick = () => { toggle($('btnCaliper'), rec.toggleCaliper()); flags.usedCaliper = true; };
$('btnTruth').onclick = () => { const on = $('truth').hidden; $('truth').hidden = !on; toggle($('btnTruth'), on); flags.usedTruth = true; renderTruth(); };
$('btnWires').onclick = () => h3.setWires(toggle($('btnWires'), !$('btnWires').classList.contains('on')));
$('btnLabels').onclick = () => h3.setLabels(toggle($('btnLabels'), !$('btnLabels').classList.contains('on')));
$('btnView').onclick = () => h3.resetView();
$('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
$('help').onclick = () => { $('help').hidden = true; };

// ── task modes ───────────────────────────────────────────────────────────
const STD = Object.fromEntries(Object.entries(CATHETERS).map(([id, c]) => [id, c.bipoles.map((b) => b.pos)]));
function moveCath(id, positions, route) {
  const chans = CHANNELS.filter((c) => c.cath === id);
  positions.forEach((p, i) => { chans[i].pos = p; const ps = PACE_SITES.find((s) => s.id === CATHETERS[id].bipoles[i].label); if (ps) ps.pos = p; });
  h3.placeCath(id, route, positions);
}
const api = {
  task: $('task'), pm, setLab, setSubstrate, setFrozen, stopPacing, notice,
  heart: () => heart,
  runFast: (ms) => { for (let k = 0; k < ms; k += 16) advance(16); rec.draw(); },
  runProtocol(p) {
    $('paceSite').value = p.site; $('protocol').value = p.kind; $('mA').value = p.mA ?? 2;
    for (const k of ['s1', 'n', 's2', 'dur']) if (p[k] != null) $(k).value = p[k];
    $('s3').value = p.s3 ?? 0; syncProtocol(); deliver();
  },
  quiet(v) { quietMode = v; },
  setTruthAllowed(v) { $('btnTruth').disabled = !v; if (!v && !$('truth').hidden) $('btnTruth').click(); },
  placeCath(id, u) {
    const t = TRACKS[id], tip = bipoles(id, u)[t.offsets.indexOf(0)];
    const route = [...CATHETERS[id].route.slice(0, 3), ...t.points.filter((_, i) => i <= u), tip];
    moveCath(id, bipoles(id, u), route);
  },
  resetCaths() { for (const id of Object.keys(TRACKS)) moveCath(id, STD[id], CATHETERS[id].route); },
  setPM(settings) { pm.s = { ...DEFAULTS }; pm.set(settings); pm.reset(simT); syncProgrammer(); },
  setNoise: setNoiseOn,
  pvcAt(ms) { pendingPVC = ms; },
  did: () => ({ ...did }),
  resetDid() { did = {}; },
  labelsOn: () => $('btnLabels').classList.contains('on'),
};
const modes = { quiz: new QuizMode(api), place: new PlaceMode(api), cases: new CaseMode(api) };
function setMode(id) {
  curMode?.exit(); curMode = null; modeId = id;
  $('task').hidden = !modes[id]; setFrozen(false);
  if (modes[id]) { curMode = modes[id]; curMode.enter(); } else { setLab(id === 'pacer' ? 'pm' : 'ep'); if (id === 'pacer') api.setPM({}); } // fresh device after a case
  setActiveTab(document.querySelector(`#modeTabs [data-mode="${id}"]`));
}

// ── learn tab, pages, tour, Boba ─────────────────────────────────────────
const t0 = Date.now();
const learnTab = $('navLearn');
const setActiveTab = (btn) => document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('active', b === btn));
function openLearn() { document.body.classList.add('learning'); document.body.classList.remove('paging'); setActiveTab(learnTab); flags.openedLearn = true; }
function openPage(id) {
  const page = $('page');
  document.body.classList.add('learning', 'paging');
  if (id === 'about') renderAbout(page); else page.innerHTML = MODEL_HTML;
  page.scrollTop = 0;
  setActiveTab($(id === 'about' ? 'navAbout' : 'navModel'));
}
function closeLearn() { document.body.classList.remove('learning', 'paging'); setActiveTab(document.querySelector(`[data-mode="${modeId}"]`)); }
initLearn({ root: $('learn'), onGoto: (id) => { closeLearn(); if (modeId !== 'explore') setMode('explore'); setSubstrate(id); }, onTour: () => { closeLearn(); runTour(); } });
document.querySelectorAll('#modeTabs button').forEach((b) => b.addEventListener('click', () => {
  if (b === learnTab) openLearn(); else if (b.id === 'navModel') openPage('model'); else if (b.id === 'navAbout') openPage('about');
  else { closeLearn(); if (b.dataset.mode !== modeId) setMode(b.dataset.mode); else setActiveTab(b); }
}));

function runTour() {
  closeLearn();
  startTour([
    { title: 'Welcome to the EP lab', text: 'You are recording from four catheters in a simulated heart and pacing it yourself. Everything on screen comes from one model of the heart, so the electrograms, the surface ECG and the 3D heart always agree.' },
    { title: 'The recording system', target: '#monitorPane', text: 'Surface leads I, II, aVF and V1 at the top, then the high right atrium (HRA), the His catheter, the coronary sinus (CS 9-10 proximal to CS 1-2 distal) and the RV apex. Time runs left to right; the grid is 100 ms.' },
    { title: 'Intervals', target: '#intervals', text: 'AH is conduction through the AV node, HV through the His–Purkinje system. Normal: AH 55–125 ms, HV 35–55 ms.' },
    { title: 'The heart', target: '#heartPane', text: 'Each region lights up as it activates. Drag to rotate, scroll to zoom. The yellow lines are the AV nodal pathways and the His–Purkinje system.' },
    { title: 'Slow it down', target: '#paneBtns', text: 'Set the speed to ⅕× and watch a sinus beat: sinus node, atria, AV node (a pause), His, bundles, ventricles.', tryText: 'set a slower speed', done: () => speed < 1 },
    { title: 'The stimulator', target: '.stim', text: 'Choose where to pace from, the output, and a protocol. Pace from the HRA at 600 ms, then try 400, 350, 300: watch the AH lengthen until the AV node blocks (Wenckebach).', tryText: 'press Deliver', done: () => flags.paced },
    { title: 'Change the heart', target: '#substrate', text: 'Each heart has a different substrate: dual AV nodal pathways, an accessory pathway, AV block, sinus node dysfunction. The Learn tab says what to try in each.' },
    { title: 'Truth', target: '#btnTruth', text: 'In a real lab you only see the electrograms. Here you can also see what really happened: where a beat blocked, conduction that was concealed, capture or no capture.' },
  ], { onEnd: () => { flags.toured = true; store.set('ep.toured', true); } });
}
$('btnTour').onclick = runTour;
initBoba({
  onTour: runTour, onLearn: openLearn,
  getCtx: () => ({ t: (Date.now() - t0) / 1000, flags, lab, pm: pm.s, noisy, sub: heart.substrate, speed, pacing: !!pacer || protoEnd > simT, heart, simT, lastS2: app.lastS2 }),
});

// ── keyboard ─────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.body.classList.contains('learning') && e.key !== 'h') return;
  const k = e.key.toLowerCase();
  if (curMode?.onKey(k)) { e.preventDefault(); return; }
  if (k === 'm') { setMode(modeId === 'pacer' ? 'explore' : 'pacer'); return; }
  if (lab === 'pm') { if (k === 'v') pvc(); else if (k === 'n') $('btnNoise').click(); }
  if (k === ' ' && lab === 'ep') { e.preventDefault(); deliver(); }
  else if (k === 'd' && lab === 'ep') $('btnDec').click();
  else if (k === 's' && lab === 'ep') stopPacing();
  else if (k === 'f') setFrozen(!frozen);
  else if (k === 'k') $('btnCaliper').click();
  else if (k === 't') $('btnTruth').click();
  else if (k === 'c') $('btnWires').click();
  else if (k === 'l') $('btnLabels').click();
  else if (k === 'h') $('btnHelp').click();
  else if ('1234'.includes(k)) { $('speed').selectedIndex = Number(k) - 1; $('speed').onchange(); }
});

setSubstrate('normal');
syncProtocol();
syncProgrammer();
if (!flags.toured) setTimeout(runTour, 600);
requestAnimationFrame(frame);
// DEV: run(ms) advances the simulation without animation frames (for tests in a hidden browser tab)
if (import.meta.env.DEV) window.__ep = { app, rec, h3, setSubstrate, setLab, setMode, modes, deliver, region, run: (ms) => { for (let k = 0; k < ms; k += 16) advance(16); rec.draw(); h3.update(heart, simT - LAG); renderIntervals(); renderTruth(); } };
