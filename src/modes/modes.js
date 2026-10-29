// The three task modes. Each renders into #task and drives the app through `api` (no simulation logic here).
// api: { task, setLab, setSubstrate, runProtocol(proto), runFast(ms), setFrozen, stopPacing, heart(), pm, quiet(v),
//        setTruthAllowed(v), placeCath(id, u), resetCaths(), setPM(settings), setNoise(v), pvcAt(ms), did(), resetDid(), notice }
import { el, store } from '../ui/dom.js';
import { QUESTIONS, options, rng, shuffle } from './quizBank.js';
import { EP_CASES, EP_DIAGNOSES, PM_CASES, PM_PROBLEMS, scoreEP, scorePM } from './cases.js';
import { TRACKS, bipoles, nearest, scorePlacement } from './placement.js';
import { CATHETERS } from '../sim/catheters.js';
import { hisBeats } from '../sim/measure.js';
import { Heart } from '../sim/heart.js';

// native replaceChildren prints null and false as text, so drop them first
const put = (box, ...kids) => box.replaceChildren(...kids.filter(Boolean));
const itemsTable = (items) => el('table', { class: 'items' }, el('tbody', {}, items.map((i) => el('tr', {}, el('td', {}, i.label), el('td', {}, `${i.pts}/${i.max}`), el('td', {}, i.note)))));

export class QuizMode {
  id = 'quiz';
  constructor(api) { this.api = api; }
  enter() {
    const r = rng(Date.now() % 100000);
    this.order = shuffle(QUESTIONS, r); this.r = r; this.i = 0; this.right = 0; this.answered = 0;
    this.api.quiet(true); this.api.setTruthAllowed(false); this.api.setLab('ep', { hideControls: true });
    this.load();
  }
  exit() { this.api.quiet(false); this.api.setTruthAllowed(true); this.api.setFrozen(false); }
  load() {
    const q = this.order[this.i % this.order.length], a = this.api;
    this.q = q; this.done = false; this.opts = options(q, this.r);
    a.setSubstrate(q.sub); a.setFrozen(false);
    a.runFast(1200); if (q.proto.kind !== 'none') a.runProtocol(q.proto); a.runFast(q.run); a.setFrozen(true);
    this.render();
  }
  answer(k) {
    if (this.done || !this.opts[k]) return;
    this.done = true; this.answered++;
    this.picked = this.opts[k];
    if (this.picked === this.q.answer) this.right++;
    store.set('ep.quiz.best', Math.max(store.get('ep.quiz.best', 0), this.right));
    this.render();
  }
  next() { this.i++; this.load(); }
  render() {
    const q = this.q;
    put(this.api.task, 
      el('h3', {}, `Name the finding · question ${this.answered + (this.done ? 0 : 1)} · ${this.right}/${this.answered} correct`),
      el('p', { class: 'fb' }, 'The recording is frozen at the end of the run. Use the calipers (K), unfreeze (F) to watch more, then pick what it shows.'),
      el('div', { class: 'opts' }, this.opts.map((o, k) => el('button', {
        class: this.done ? (o === q.answer ? 'right' : o === this.picked ? 'wrong' : '') : '', onclick: () => this.answer(k),
      }, `${k + 1}. ${o}`))),
      this.done ? el('p', { class: 'fb' }, el('b', {}, this.picked === q.answer ? 'Correct. ' : `It was: ${q.answer}. `), q.explain) : null,
      this.done ? el('button', { class: 'primary', onclick: () => this.next() }, 'Next ', el('kbd', {}, 'Enter')) : null,
    );
  }
  onKey(k) { if ('1234'.includes(k)) { this.answer(Number(k) - 1); return true; } if (k === 'enter' && this.done) { this.next(); return true; } return false; }
}

export class PlaceMode {
  id = 'place';
  constructor(api) { this.api = api; }
  enter() {
    this.us = { hra: 0, his: 0, cs: 0, rva: 0 }; this.sel = 'his'; this.result = null;
    this.api.setLab('ep', { hideControls: true }); this.api.setSubstrate('normal');
    for (const id of Object.keys(this.us)) this.api.placeCath(id, this.us[id]);
    this.render();
  }
  exit() { this.api.resetCaths(); }
  move(d) {
    const max = TRACKS[this.sel].points.length - 1;
    this.us[this.sel] = Math.max(0, Math.min(max, +(this.us[this.sel] + d).toFixed(2)));
    this.api.placeCath(this.sel, this.us[this.sel]); this.result = null; this.render();
  }
  render() {
    const t = TRACKS[this.sel], p = bipoles(this.sel, this.us[this.sel])[t.target.bipole], n = nearest(p);
    put(this.api.task, 
      el('h3', {}, 'Place the catheters'),
      el('span', { class: 'seg' }, Object.keys(TRACKS).map((id) => el('button', { class: id === this.sel ? 'on' : '', onclick: () => { this.sel = id; this.render(); } }, CATHETERS[id].name))),
      el('button', { onclick: () => this.move(-0.1) }, '◀ Withdraw ', el('kbd', {}, 'S')),
      el('button', { onclick: () => this.move(0.1) }, 'Advance ', el('kbd', {}, 'W'), ' ▶'),
      el('span', { class: 'fb', style: 'flex-basis:auto' }, this.api.labelsOn() ? `${CATHETERS[this.sel].bipoles[t.target.bipole].label} is ${n.cm.toFixed(1)} cm from: ${n.region.name}` : 'Labels off: read the electrograms'),
      el('button', { class: 'primary', onclick: () => this.check() }, 'Check placement ', el('kbd', {}, 'Enter')),
      el('p', { class: 'fb' }, t.hint),
      this.result ? el('p', { class: 'fb' }, el('span', { class: 'score' }, `${this.result.score}/100`)) : null,
      this.result ? itemsTable(this.result.items) : null,
    );
  }
  check() { this.result = scorePlacement(this.us); store.set('ep.place.best', Math.max(store.get('ep.place.best', 0), this.result.score)); this.render(); }
  onKey(k) {
    if (k === 'w') this.move(0.1); else if (k === 's') this.move(-0.1);
    else if (k === 'tab') { const ids = Object.keys(TRACKS); this.sel = ids[(ids.indexOf(this.sel) + 1) % ids.length]; this.render(); }
    else if (k === 'enter') this.check(); else return false;
    return true;
  }
}

export class CaseMode {
  id = 'cases';
  constructor(api) { this.api = api; }
  enter() { this.c = null; this.api.setTruthAllowed(false); this.api.setLab('ep'); this.list(); }
  exit() { this.api.quiet(false); this.api.setTruthAllowed(true); this.api.setNoise(false); }
  list() {
    const best = store.get('ep.cases', {});
    const btn = (c, kind) => el('button', { onclick: () => this.start(c, kind) }, c.title, el('small', {}, `${kind === 'ep' ? 'EP study' : 'Pacemaker'}${best[c.id] != null ? ` · best ${best[c.id]}/100` : ''}`));
    put(this.api.task, 
      el('h3', {}, 'Cases: each scored out of 100'),
      el('p', { class: 'fb' }, 'EP study: an unknown heart. Study it, measure the sinus AH and HV, and give the diagnosis. Pacemaker: something is wrong. Name the problem and reprogram the device to fix it.'),
      el('div', { class: 'caselist' }, [...EP_CASES.map((c) => btn(c, 'ep')), ...PM_CASES.map((c) => btn(c, 'pm'))]));
  }
  start(c, kind) {
    const a = this.api;
    this.c = c; this.kind = kind; this.t0 = Date.now(); this.result = null; this.picked = null; this.m = {};
    a.quiet(true);
    if (kind === 'ep') {
      a.setLab('ep', { hideSubstrate: true }); a.setSubstrate(c.sub); a.resetDid();
      const h = new Heart(c.sub); h.step(5000);
      const b = hisBeats(h, 1500, 5000);
      this.truth = { ah: b.reduce((s, x) => s + x.ah, 0) / b.length, hv: b.reduce((s, x) => s + x.hv, 0) / b.length };
    } else {
      a.setLab('pm', { hideSubstrate: true }); a.setSubstrate(c.sub, { sinus: c.sinus ?? 75 }); a.setPM(c.settings); a.setNoise(!!c.noisy);
      if (c.pvc) a.pvcAt(3000);
    }
    this.render();
  }
  submit() {
    const secs = (Date.now() - this.t0) / 1000, a = this.api;
    if (this.kind === 'ep') {
      const v = (x) => (x === '' || x == null ? null : Number(x));
      this.result = scoreEP(this.c, { picked: this.picked, measured: { ah: v(this.m.ah), hv: v(this.m.hv) }, truth: this.truth, did: a.did(), secs });
    } else this.result = scorePM(this.c, { picked: this.picked, settings: { ...a.pm.s }, secs });
    const best = store.get('ep.cases', {}); best[this.c.id] = Math.max(best[this.c.id] ?? 0, this.result.score); store.set('ep.cases', best);
    this.render();
  }
  render() {
    if (!this.c) return this.list();
    const ep = this.kind === 'ep', choices = ep ? EP_DIAGNOSES : PM_PROBLEMS;
    put(this.api.task, 
      el('h3', {}, `${ep ? 'EP study' : 'Pacemaker'} case: ${this.c.title}`),
      el('p', { class: 'fb' }, ep ? 'Pace and record as you would in the lab (the Truth list is off). Enter the sinus-rhythm AH and HV, then your diagnosis.' : 'Watch the recording and the marker channel, name the problem, change the programming, then check.'),
      ep ? el('label', {}, 'AH ', el('input', { type: 'number', min: 0, max: 600, value: this.m.ah ?? false, oninput: (e) => { this.m.ah = e.target.value; } }), ' ms') : null,
      ep ? el('label', {}, 'HV ', el('input', { type: 'number', min: 0, max: 300, value: this.m.hv ?? false, oninput: (e) => { this.m.hv = e.target.value; } }), ' ms') : null,
      el('label', {}, ep ? 'Diagnosis ' : 'Problem ', el('select', { onchange: (e) => { this.picked = e.target.value || null; } },
        el('option', { value: '' }, 'Choose…'), choices.map((d) => el('option', { value: d, selected: d === this.picked }, d)))),
      el('button', { class: 'primary', onclick: () => this.submit() }, ep ? 'Submit' : 'Check my settings'),
      el('button', { onclick: () => { this.c = null; this.api.quiet(false); this.api.setNoise(false); this.api.setLab('ep'); this.list(); } }, 'All cases'),
      this.result ? el('p', { class: 'fb' }, el('span', { class: 'score' }, `${this.result.score}/100`)) : null,
      this.result ? itemsTable(this.result.items) : null,
    );
  }
  onKey() { return false; }
}
