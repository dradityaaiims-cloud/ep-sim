# Dr. Singh's EP Sim

An open, browser-based **electrophysiology study and pacemaker simulator** for students, residents, fellows and early learners.
Pace a simulated heart from four standard catheters, watch the impulse travel on a 3D heart while the intracardiac
electrograms and surface ECG unfold, then program a generic pacemaker in the same heart.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23751660.svg)](https://doi.org/10.5281/zenodo.23751660)

**Live:** https://dradityaaiims-cloud.github.io/ep-sim/

> Educational use only. Not a medical device. Not for clinical decisions, procedure planning, assessment or exams. All cases are simulated. Never enter patient information.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # node --test tests/*.test.js
npm run build    # static site in dist/ (relative base, works on GitHub Pages)
```

## Modes

- **EP lab**: HRA, His, CS (9-10 to 1-2) and RVA catheters with surface leads I, II, aVF and V1. Stimulator with
  continuous pacing, drive train plus S2/S3 (D shortens S2 by 10 ms) and burst pacing. Nine hearts: normal, dual AV nodal
  pathways (AVNRT), manifest and concealed left lateral pathways, first-degree AV block, infra-Hisian disease, complete
  heart block (with and without retrograde conduction), sinus node dysfunction and a flutter substrate. Slow motion,
  calipers, and a **Truth** list of what really happened (block, concealed conduction, capture).
- **Pacemaker lab**: a generic AOO, VOO, DOO, AAI, VVI or DDD device that sees only its lead electrograms. Marker channel,
  programmer, PVCs and myopotential noise. Capture threshold, under- and oversensing, crosstalk and safety pacing,
  upper-rate behaviour and pacemaker-mediated tachycardia emerge from the simulation.
- **Name the finding**: ten frozen recordings to interpret.
- **Place the catheters**: advance each catheter until its electrograms look right; scored out of 100.
- **Cases**: six unknown hearts to study and diagnose and five pacemaker faults to name and fix, each scored out of 100
  with feedback (pacemaker fixes are checked by simulating the patient).

Also: a Learn tab, a guided tour, Boba (the rule-based assistant), Model & limits and About pages.

## How it works

`src/sim/regions.js` describes the heart as a graph of 34 named regions (sinus node, atria including the cavotricuspid
isthmus, fast and slow AV nodal pathways, compact node, His, bundle branches, ventricles, an optional accessory pathway).
`src/sim/heart.js` is an event-driven engine: refractoriness and conduction time depend on the previous diastolic interval
(restitution, decremental AV nodal conduction), late impulses penetrate the AV node and reset its recovery (concealed
conduction), automatic regions show overdrive suppression, and pacing captures by a strength-duration rule.
`src/sim/signals.js` derives schematic bipolar electrograms and surface leads from the activation times.
`src/sim/pacemaker.js` is the generic device and `src/sim/device.js` couples it to the heart millisecond by millisecond.
Modes and scoring live in `src/modes`; rendering (`src/render`) only draws. See the Model & limits page.

## Limitations

A region graph, not a tissue mesh or ionic model; every number is a teaching value. Electrograms and the surface ECG are
schematic (the ECG has no torso model and is calibrated once to a +60 degree QRS axis). The pacemaker is generic and does
not reproduce any manufacturer's device. Not validated for clinical use; educational effect not evaluated.

## Data and licence

Code: MIT (see `LICENSE`). 3D heart: NIH Human Reference Atlas (HuBMAP) male heart v1.2, CC BY 4.0 (see
`public/models/ATTRIBUTION.md`). Cite via `CITATION.cff`: DOI [10.5281/zenodo.23751660](https://doi.org/10.5281/zenodo.23751660).
