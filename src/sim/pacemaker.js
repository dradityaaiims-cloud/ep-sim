// A generic pacemaker: an event-driven controller that only sees its two lead signals and only acts by pacing.
// It knows nothing about the heart's refractoriness: device refractory and blanking periods are timing rules
// about which sensed signals it acts on. Ventricular-based lower-rate timing. Not any manufacturer's device.
// Pure, no DOM. Times in ms, signals in mV.

export const MODES = {
  AOO: { paceA: true, paceV: false, senseA: false, senseV: false },
  VOO: { paceA: false, paceV: true, senseA: false, senseV: false },
  DOO: { paceA: true, paceV: true, senseA: false, senseV: false },
  AAI: { paceA: true, paceV: false, senseA: true, senseV: false },
  VVI: { paceA: false, paceV: true, senseA: false, senseV: true },
  DDD: { paceA: true, paceV: true, senseA: true, senseV: true },
};

export const DEFAULTS = {
  mode: 'DDD',
  lrl: 60,         // lower rate limit, /min
  url: 120,        // upper tracking rate, /min
  pav: 180,        // AV delay after an atrial paced event, ms
  sav: 150,        // AV delay after an atrial sensed event, ms
  pvarp: 250,      // post-ventricular atrial refractory period, ms
  vrp: 250,        // ventricular refractory period, ms
  arp: 300,        // atrial refractory period (AAI), ms
  pvab: 50,        // post-ventricular atrial blanking, ms
  vBlank: 28,      // ventricular blanking after an atrial pace, ms
  vpBlank: 100,    // ventricular blanking after a ventricular pace (its own output and evoked response), ms
  aBlank: 100,     // atrial blanking after an atrial pace, ms
  safety: true,    // ventricular safety pacing: a V sense soon after an atrial pace may be crosstalk, so pace at 110 ms
  sensA: 0.5,      // atrial sensitivity, mV (smaller = more sensitive)
  sensV: 2.5,      // ventricular sensitivity, mV
  outA: 2.5, outV: 2.5, pw: 0.4, // output (V) and pulse width (ms)
};
export const SAFETY_MS = 110;
const DETECT_MS = 100; // after a detection the channel's detector ignores the same signal for this long

export class Pacemaker {
  constructor(settings = {}) { this.set(settings); this.reset(0); }

  set(s) { this.s = { ...DEFAULTS, ...this.s, ...s }; }

  reset(t) {
    this.lastV = t; this.lastA = -Infinity; this.lastAP = -Infinity; this.lastVP = -Infinity;
    this.av = null;               // pending AV delay: { t: start, d: delay }
    this.detA = this.detV = -Infinity;
    this.cycle = t;               // asynchronous modes: start of the current cycle
    this.log = [];                // markers: { t, m: 'AP'|'AS'|'AR'|'VP'|'VS'|'VR'|'SP' }
  }

  get lri() { return 60000 / this.s.lrl; }
  get uri() { return 60000 / this.s.url; }

  /**
   * Advance to time t with the current lead signals. Returns the outputs to deliver now: [{ ch: 'A'|'V' }].
   */
  step(t, aMv, vMv) {
    const s = this.s, m = MODES[s.mode], out = [];
    const mark = (k) => this.log.push({ t, m: k });
    const paceA = () => { out.push({ ch: 'A' }); mark('AP'); this.lastA = this.lastAP = t; };
    const paceV = (k = 'VP') => { out.push({ ch: 'V' }); mark(k); this.lastV = this.lastVP = t; this.av = null; };

    // ── sensing ──
    if (m.senseA && Math.abs(aMv) >= s.sensA && t - this.detA > DETECT_MS) {
      const blanked = t - this.lastV < s.pvab || t - this.lastAP < s.aBlank;
      if (!blanked) {
        this.detA = t;
        const refractory = s.mode === 'AAI' ? t - this.lastA < s.arp : t - this.lastV < s.pvarp;
        if (refractory) mark('AR');
        else {
          mark('AS'); this.lastA = t;
          if (s.mode === 'DDD' && !this.av) this.av = { t, d: s.sav };
        }
      }
    }
    if (m.senseV && Math.abs(vMv) >= s.sensV && t - this.detV > DETECT_MS && t - this.lastAP >= s.vBlank && t - this.lastVP >= s.vpBlank) {
      this.detV = t;
      if (t - this.lastV < s.vrp) mark('VR');
      else if (s.mode === 'DDD' && s.safety && this.av && t - this.lastAP < SAFETY_MS && this.lastAP === this.av.t) {
        // possibly crosstalk: commit to a ventricular pace at the end of the safety window
        mark('VS'); this.av = { t: this.lastAP, d: SAFETY_MS, safety: true };
      } else { mark('VS'); this.lastV = t; this.av = null; }
    }

    // ── timers ──
    const L = this.lri;
    switch (s.mode) {
      case 'AOO': if (t - this.cycle >= L || !this.log.length) { this.cycle = t; paceA(); } break;
      case 'VOO': if (t - this.cycle >= L || !this.log.length) { this.cycle = t; paceV(); } break;
      case 'DOO':
        if (t - this.cycle >= L || !this.log.length) { this.cycle = t; paceA(); this.av = { t, d: s.pav }; }
        else if (this.av && t - this.av.t >= this.av.d) paceV();
        break;
      case 'AAI': if (t - this.lastA >= L) paceA(); break;
      case 'VVI': if (t - this.lastV >= L) paceV(); break;
      case 'DDD':
        if (this.av) {
          const due = this.av.safety ? this.av.t + this.av.d : Math.max(this.av.t + this.av.d, this.lastV + this.uri);
          if (t >= due) paceV(this.av.safety ? 'SP' : 'VP');
        } else if (t - this.lastV >= L - s.pav) { paceA(); this.av = { t, d: s.pav }; }
        break;
    }
    return out;
  }
}
