// Transparent heart (NIH Human Reference Atlas, CC BY 4.0) with the conduction regions lighting up as they
// activate, the specialised conduction system, and the four diagnostic catheters. Draws only: it reads the
// heart's state and never changes it. Units: cm, patient frame (x left, y superior, z anterior).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REGIONS } from '../sim/regions.js';
import { CATHETERS } from '../sim/catheters.js';

const ORIGIN = [0.0033, 0.4782, 0.03645]; // HRA model offset (m), as in the RHC simulator
const BLUE = 0x5a8cff, RED = 0xff5a6e, PURPLE = 0x9b7bff, GREY = 0x9aa7b8, VALVE = 0xf2f5fa;
const LOOK = {
  ra: [BLUE, 0.08], rv: [BLUE, 0.07], svc: [BLUE, 0.1], ivc: [BLUE, 0.1], la: [RED, 0.06], lv: [RED, 0.06],
  ao: [RED, 0.05], pa: [PURPLE, 0.06], septum: [GREY, 0.05], tv: [VALVE, 0.2], pv: [VALVE, 0.15], mv: [VALVE, 0.15], av: [VALVE, 0.12],
};
const V = (a) => new THREE.Vector3(...a);
// colour of each tissue's activation glow
const GLOW = { sa: 0xffe066, atrium: 0x7fd3ff, avn: 0xffb02e, his: 0xffe066, bb: 0xffe066, vent: 0x9dff8a, ap: 0xff6b6b };
// the specialised conduction system drawn as lines
const WIRES = [['f1', 'f2'], ['f2', 'cn'], ['s1', 's2'], ['s2', 's3'], ['s3', 'cn'], ['cn', 'his'], ['his', 'rbb'], ['rbb', 'rva'], ['his', 'lbb'], ['lbb', 'lvs'], ['lbb', 'lva'], ['lbb', 'lvan'], ['lbb', 'lvi'], ['cs12', 'ap'], ['ap', 'lvb']];
const LABELS = { RA: [-3.4, -0.6, 1.4], RV: [1.4, -3.4, 3.2], LA: [1.2, 2.6, -3.8], LV: [5.4, -3.0, 0.6] };

export class Heart3D {
  constructor(mount, labelsEl) {
    this.mount = mount; this.labelsEl = labelsEl; this.labelsOn = true; this.labels = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    mount.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.resetView();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(8, 14, 20); this.scene.add(dl);

    this.parts = {};
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/heart.glb`).then((g) => this.addModel(g.scene)).catch(() => {});

    // regions: a soft dot each, brightening when the region activates
    this.dots = {};
    const geo = new THREE.SphereGeometry(1, 16, 12);
    for (const r of REGIONS) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: GLOW[r.tissue], transparent: true, opacity: 0.25, depthTest: false }));
      m.position.copy(V(r.pos)); m.renderOrder = 5;
      const base = r.tissue === 'vent' || r.tissue === 'atrium' ? 0.32 : 0.2;
      m.userData = { base, r }; m.scale.setScalar(base);
      this.scene.add(m); this.dots[r.id] = m;
    }
    this.wires = new THREE.Group();
    for (const [a, b] of WIRES) {
      const pa = REGIONS.find((r) => r.id === a).pos, pb = REGIONS.find((r) => r.id === b).pos;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(pa), V(pb)]), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, depthTest: false }));
      line.renderOrder = 4; line.userData = { a, b }; this.wires.add(line);
    }
    this.scene.add(this.wires);

    // catheters: a tube along the route and a bright ring at each recording pair
    this.caths = {};
    for (const [id, c] of Object.entries(CATHETERS)) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c.route.map(V)), 80, 0.07, 8, false), new THREE.MeshPhongMaterial({ color: 0xd8dde6, emissive: 0x111111 })));
      for (const b of c.bipoles) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: c.color, depthTest: false }));
        e.position.copy(V(b.pos)); e.renderOrder = 6; g.add(e);
        this.addLabel(b.label, V(b.pos), 'lbl-cath', id);
      }
      g.userData.pacer = !!c.pacer; this.scene.add(g); this.caths[id] = g;
    }
    for (const [t, p] of Object.entries(LABELS)) this.addLabel(t, V(p), 'lbl-ch');
    this.paceRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff6b6b, depthTest: false }));
    this.paceRing.renderOrder = 7; this.scene.add(this.paceRing);

    this.showCaths(false);
    new ResizeObserver(() => this.resize()).observe(mount);
    this.resize();
  }

  addModel(root) {
    root.scale.setScalar(100); root.position.set(...ORIGIN.map((v) => -v * 100)); root.updateMatrixWorld(true);
    for (const [id, [col, op]] of Object.entries(LOOK)) {
      const obj = root.getObjectByName(id);
      if (!obj) continue;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        g.deleteAttribute('normal'); g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, shininess: 40 }));
        m.renderOrder = 1; this.scene.add(m); this.parts[id] = m;
      });
    }
  }

  addLabel(text, pos, cls = '', cath = null) {
    const d = document.createElement('div'); d.className = `lbl ${cls}`; d.textContent = text;
    this.labelsEl.append(d); this.labels.push({ d, pos, cath });
  }
  /** Move a catheter: a new route for the tube and new electrode positions (in bipole order). */
  placeCath(id, route, positions) {
    const g = this.caths[id], tube = g.children[0];
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(route.map(V)), 80, 0.07, 8, false);
    const labels = this.labels.filter((l) => l.cath === id);
    positions.forEach((p, i) => { g.children[i + 1].position.copy(V(p)); labels[i].pos.copy(V(p)); });
  }
  /** Show the EP catheters, or the pacemaker leads (pacer = true). */
  showCaths(pacer) {
    for (const g of Object.values(this.caths)) g.visible = g.userData.pacer === pacer;
    for (const l of this.labels) if (l.cath) l.hidden = this.caths[l.cath].userData.pacer !== pacer;
  }

  resetView() {
    this.controls.enableDamping = false; this.camera.position.set(3, 0, 44); this.controls.target.set(0.8, -0.5, -0.5); this.controls.update(); this.controls.enableDamping = true;
  }
  setLabels(v) { this.labelsOn = v; this.labelsEl.hidden = !v; }
  setWires(v) { this.wires.visible = v; }
  /** Highlight the pacing bipole (pos) or hide the ring (null). */
  setPacing(pos) { this.paceRing.visible = !!pos; if (pos) this.paceRing.position.copy(V(pos)); }

  resize() {
    const w = this.mount.clientWidth || 1, h = this.mount.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Draw the heart at simulated time t (ms): each region glows for a moment after it activates. */
  update(heart, t) {
    for (const [id, m] of Object.entries(this.dots)) {
      const n = heart.nodes[id];
      const a = n.hist.findLast((e) => e.t <= t);
      const age = a ? t - a.t : 1e9;
      const k = n.off ? 0 : Math.exp(-age / 90);
      m.visible = !n.off;
      m.material.opacity = 0.18 + 0.8 * k;
      m.scale.setScalar(m.userData.base * (1 + 1.2 * k));
    }
    for (const l of this.wires.children) {
      const off = heart.nodes[l.userData.a].off || heart.nodes[l.userData.b].off;
      l.visible = !off;
    }
    this.paceRing.quaternion.copy(this.camera.quaternion);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.labelsOn) {
      const w = this.mount.clientWidth, h = this.mount.clientHeight;
      for (const { d, pos, hidden } of this.labels) {
        const p = pos.clone().project(this.camera);
        d.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -140%)`;
        d.style.display = p.z < 1 && !hidden ? '' : 'none';
      }
    }
  }
}
