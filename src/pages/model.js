// Model & limits page: how each part is modelled, what it does not do, and the sources.
export const MODEL_HTML = `<div class="prose">
<h2>Model &amp; limits</h2>
<p class="warn"><b>Not validated for clinical use.</b> This is a teaching model. Its educational effect has not been evaluated. Every number is a teaching value chosen to fall in textbook ranges, not a measured human parameter.</p>

<h3>One causal chain</h3>
<p>Every deflection on the screen comes from one simulated heart: a stimulus or the sinus node starts an activation, the activation travels between regions or blocks, and the electrograms, the surface ECG and the 3D heart are drawn from those activation times. Nothing is a recorded or template tracing. The <b>Truth</b> list shows the underlying events (block, concealed conduction, capture), which a real lab cannot show you.</p>

<h3>How each part is modelled</h3>
<div class="tbl"><table>
<thead><tr><th>Part</th><th>Model</th><th>Simplification</th></tr></thead>
<tbody>
<tr><td>Heart</td><td>A graph of 34 named regions (sinus node, 13 atrial regions including the cavotricuspid isthmus, fast and slow AV nodal pathways, compact node, His, bundle branches, 10 ventricular regions, optional accessory pathway), event-driven, deterministic</td><td>Regions, not a tissue mesh; no wavefront curvature, no spiral waves, no fibrillation</td></tr>
<tr><td>Refractoriness</td><td>After each activation: ERP = ERP<sub>0</sub> × (1 − a·e<sup>−DI/τ</sup>), so it shortens at faster rates (restitution)</td><td>One refractory value per region; no action-potential ionic currents</td></tr>
<tr><td>Conduction</td><td>Time through a region rises when it is entered early: t = t<sub>0</sub> × (1 + A·e<sup>−DI/τ</sup>). Strongest in the compact AV node (decremental conduction, Wenckebach)</td><td>Fixed link delays from distance (atria ~1 m/s, ventricles ~0.7 m/s)</td></tr>
<tr><td>AV node</td><td>Fast pathway (long ERP) and slow pathway (short ERP) meeting at the compact node; recovery timed from when the node last conducted, as in functional nodal models; an impulse that arrives late in refractoriness penetrates and resets recovery (concealed conduction)</td><td>Structure follows published functional models; values are not human measurements (the foundational models used rabbit data)</td></tr>
<tr><td>Accessory pathway</td><td>Non-decremental link between the distal CS atrium and the basal lateral LV; can be retrograde-only (concealed)</td><td>One location (left lateral)</td></tr>
<tr><td>Automaticity</td><td>Sinus node, His (junctional escape) and RV apex (ventricular escape) fire at their own rates and are reset by any activation; being driven faster suppresses the sinus node (overdrive suppression, SNRT)</td><td>No autonomic tone, no drugs</td></tr>
<tr><td>Pacing capture</td><td>Threshold = rheobase × (1 + chronaxie / pulse width) (Lapicque–Weiss), rising steeply as the tissue nears the end of refractoriness; no capture inside refractoriness</td><td>A fitted teaching relation, not electrode–tissue physics; the AV node itself cannot be paced</td></tr>
<tr><td>Electrograms</td><td>Each bipole records a sharp biphasic deflection at the local activation of nearby regions, decaying with distance, plus a broad far-field ventricular signal; stimulus artefacts</td><td>Schematic: no extracellular field solution, no filters</td></tr>
<tr><td>Surface ECG</td><td>Each region contributes by its position along the lead while depolarised; repolarisation is earlier where activation is later, so the normal T wave is upright and paced or bundle-branch-block beats have discordant T waves</td><td>Schematic: no torso. The ventricular frontal plane is rotated once so that the normal QRS axis is +60°, and P and R amplitudes are scaled to about 0.15 and 1.2 mV in lead II</td></tr>
<tr><td>Pacemaker</td><td>Generic event-driven controller (AOO, VOO, DOO, AAI, VVI, DDD) with ventricular-based lower-rate timing, sensed and paced AV delays, upper tracking rate, PVARP, ventricular refractory period, blanking and ventricular safety pacing. It senses its own lead electrograms every millisecond and paces the heart through the same capture rule; lead impedance 500 Ω</td><td>Not any manufacturer's device; no mode switching, rate response, PMT algorithm, hysteresis, CRT or ICD functions</td></tr>
<tr><td>3D heart</td><td>NIH Human Reference Atlas male heart, v1.2 (CC BY 4.0); region positions and catheter routes placed by hand</td><td>Not patient anatomy; the conduction system is drawn schematically</td></tr>
</tbody></table></div>

<h3>Checked by automated tests</h3>
<ul>
<li>Normal sinus rhythm: AH 55–125 ms, HV 35–55 ms, narrow QRS.</li>
<li>Incremental atrial pacing: AH lengthens, then AV nodal Wenckebach at a cycle length of 300–500 ms.</li>
<li>S1–S2 at 600 ms: AV nodal ERP 230–400 ms, longer than the atrial ERP.</li>
<li>Dual pathways: an AH jump of at least 50 ms and inducible slow–fast AVNRT with a septal VA under 70 ms; none in the normal heart.</li>
<li>Pre-excitation with the earliest ventricle at the basal lateral LV; concentric retrograde activation via the AV node and eccentric (distal CS first) via a left lateral pathway; inducible orthodromic AVRT.</li>
<li>Pacemaker: lower-rate pacing and inhibition, undersensing, tracking with the sensed AV delay, upper-rate limits and PVARP, blanking versus crosstalk and safety pacing; coupled to the heart, tracking in heart block, loss of capture, myopotential inhibition, and PMT that a longer PVARP prevents.</li>
<li>Atrial flutter: burst pacing near the isthmus starts a loop at a cycle length of 200–300 ms with AV nodal block, and not in the normal heart.</li>
<li>Complete heart block with a dissociated escape rhythm; long HV with infra-Hisian disease; SNRT under 1500 ms normally and prolonged in sinus node dysfunction; capture versus strength–duration and refractoriness.</li>
</ul>

<h3>Not modelled (yet)</h3>
<ul>
<li>Atrial fibrillation, ventricular tachycardia, atypical flutter, scar, ablation lesions, drugs (adenosine, isoproterenol), autonomic tone.</li>
<li>Para-Hisian pacing, entrainment and other differential pacing manoeuvres beyond what emerges from the graph.</li>
<li>Catheter manipulation, contact force, mapping systems, fluoroscopy.</li>
<li>Pacemaker mode switching, rate response, CRT, ICD therapy, conduction system pacing.</li>
</ul>

<h3>Privacy</h3>
<p>Runs entirely in your browser. No analytics, no cookies, no patient data. Settings are kept only in your browser's local storage.</p>

<h3>Sources</h3>
<ul>
<li>Josephson ME. <i>Clinical Cardiac Electrophysiology: Techniques and Interpretations</i>. Normal intervals and stimulation protocols.</li>
<li>Climent AM, et al. Functional mathematical model of dual pathway AV nodal conduction. <i>Am J Physiol Heart Circ Physiol</i> 2011;300:H1393–H1401.</li>
<li>Inada S, et al. One-dimensional mathematical model of the atrioventricular node including atrio-nodal, nodal, and nodal-His cells. <i>Biophys J</i> 2009;97:2117–2127.</li>
<li>Mitchell CC, Schaeffer DG. A two-current model for the dynamics of cardiac membrane. <i>Bull Math Biol</i> 2003;65:767–793 (restitution concepts).</li>
<li>Geddes LA. Accuracy limitations of chronaxie values. <i>IEEE Trans Biomed Eng</i> 2004;51:176–181 (strength–duration).</li>
<li>Franz MR, et al. Monophasic action potential mapping in human subjects with normal electrocardiograms: direct evidence for the genesis of the T wave. <i>Circulation</i> 1987;75:379–386 (repolarisation earlier where activation is later).</li>
<li>Börner K, et al. HuBMAP 3D Human Reference Atlas. <i>Nat Methods</i> 2025 (heart model, CC BY 4.0).</li>
</ul>
</div>`;
