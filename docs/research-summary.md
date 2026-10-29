# EP & Pacing Simulator: research summary and plan

Prepared 2026-10-29 for ADI. Inputs: your Perplexity PDF ("i want to design a simulator for EP and pacing sim"), the Medical Simulator Design Guide, and a search of existing tools.

## 1. What your PDF gets right (and I will keep)

- **One causal chain, many views.** Stimulus → local capture → propagation/block → activation → electrograms → device sensing → markers. Every deflection on screen should trace back to an event in one shared state. I will build exactly this, with an internal event log ("ground truth") you can reveal.
- **Output ≠ capture ≠ sensing ≠ marker.** Four separate things. The pacemaker controller is its own state machine, independent of tissue refractoriness.
- **Refractoriness depends on history** (restitution after a short diastolic interval), not a fixed "ignore for 250 ms".
- **AV node as a stateful dual-pathway model** (fast pathway: fast conduction, long ERP; slow pathway: slow conduction, short ERP), so AVNRT emerges from timing rather than being triggered.
- **Strength–duration capture** (Lapicque/Weiss: threshold = rheobase × (1 + chronaxie / pulse width)), labelled as a fitted teaching model.
- **Label simplifications honestly**, e.g. a schematic surface ECG.

## 2. Where I would depart from it (please confirm)

The PDF describes a research-grade engine: ionic cell models (Courtemanche, O'Hara–Rudy), monodomain/bidomain tissue on a 1 mm volumetric mesh, openCARP as reference solver. That is right for a research platform but wrong for a free browser teaching tool:

| PDF recommendation | Problem for us | What I propose |
|---|---|---|
| Ionic models (ORd ~40 state variables) per mesh node | Cannot run in real time in a browser on a whole heart | **Reduced excitable graph**: ~40 named regions (SA node, atrial segments, AVN fast/slow, His, bundle branches, ventricular segments, CS, optional accessory pathway). Each region has its own APD and conduction restitution curves. Event-driven, deterministic, fully unit-testable. |
| openCARP as reference engine | Academic Public Licence, not permissive; C++ server-side; not shippable in a static site | Use published equations and numbers only (not code). Optionally later run offline openCARP experiments to calibrate, never bundled. |
| Rodero–Strocchi 4-chamber mesh (CC BY 4.0, Zenodo 4590294) | Volumetric VTK, large; needs atrial fibres and conduction system added anyway | Default: **reuse the NIH HRA heart (CC BY 4.0) already built into the RHC sim**, place named regions and catheter sites on it. Rodero mesh stays an option. |
| Extracellular field recovery for electrograms | Needs a field solve | **Schematic electrograms**: each catheter bipole records near-field from the regions under it (sharp biphasic spike at local activation time) plus a small far-field term by distance. Moving a catheter changes what it records. Labelled schematic. |
| Body-surface ECG from torso model | Needs torso volume conductor | **Schematic leads** (I, II, aVF, V1) built from atrial and ventricular activation timing and sequence. Labelled schematic. |

## 3. Existing simulators and models I looked at

| Tool | What it is | Can we borrow it? |
|---|---|---|
| [svtsim](https://svtsim.com/svtsim_doc.html) (Iravanian, 2011) | Web EP-study simulator: HRA, His, CS, RVA + V1; SND, AV block, dual AVN, AVNRT, AVRT, AF; pacing, extra stimuli, ablation, drugs | Closest to your goal. **No licence stated, © 2011, no source.** Inspiration only, no code reuse. |
| CardiacEPStim (Kosiuk, 2022 abstract) | Online EP training sim with HRA/His/CS/RVA signals | No licence or source found. Inspiration only. |
| [TheVirtualHeart.org](https://thevirtualheart.org) / Abubu.js (Fenton lab) | WebGL ionic and tissue models in browser | Licence not confirmed. Tissue-level, not an EP lab. Not needed for the graph model. |
| openCARP | Research solver | Academic Public Licence. Not for bundling. |
| Pacemaker GitHub projects (VerifiedPacemaker UPPAAL, Simulink DDD) | Device logic for hardware | Not web, licences unclear. I will write a generic DDD controller from timing-cycle references (Biotronik, McMaster handouts) instead. |
| Mitchell–Schaeffer 2003, AV-node functional models (Climent 2011; Inada 2009) | Published equations | Equations are free to implement with citation. I use their **shape** (restitution, dual pathways, concealed conduction); parameters are teaching values, flagged as such. |

**Bottom line:** no permissively licensed EP-lab simulator exists to fork. We build our own engine from published equations, and reuse our own code (RHC/ArtLine shell, Boba, tour, pages, HRA heart).

## 4. Proposed product (defaults I am starting on)

**Two labs in one app, one heart engine:**

1. **EP lab.** 3D heart with four catheters: HRA, His, CS (CS 9-10 proximal → CS 1-2 distal), RVA. Live tracings: surface I, II, aVF, V1 + intracardiac channels, paper speed, calipers. Stimulator: pace from any catheter, S1 drive train, S1–S2 (–S3) extrastimuli, incremental and burst pacing. Readouts: AH, HV, PR, QRS, measured intervals. Teaches: normal conduction and intervals, AV Wenckebach point, AVN ERP, AH jump, AVNRT induction, accessory pathway (pre-excitation, eccentric CS activation), sinus node recovery time, His-level vs AV-nodal block.
2. **Pacemaker lab.** Generic (non-manufacturer) device: AOO, VOO, DOO, AAI, VVI, DDD (DDI and rate response later). Settings: lower rate, AV delay, upper tracking rate, PVARP, blanking, sensitivity, output and pulse width. Marker channel (AS, AP, VS, VP, refractory sense). Teaches: timing cycles, capture threshold (strength–duration), loss of capture, undersensing, oversensing, crosstalk, upper-rate Wenckebach/2:1, PMT.

**Modes (same as other sims):** Free explore · Name the finding (quiz) · Place the catheters (navigate) · Cases (game: e.g. "Find the AVN ERP", "Induce and name the SVT", "Fix this pacemaker").

**Plus:** Learn tab, first-visit tour, Boba tips, Model & limits, About, PDF session report, verbatim disclaimer.

## 5. Phase plan

1. Engine + tests (graph, restitution, AV node, capture, EGMs, ECG), EP lab explore, 3D heart with catheters. ← starting now
2. Pacemaker controller + tests, Pacemaker lab.
3. Quiz, navigate, cases, Learn, tour, Boba, pages, report.
