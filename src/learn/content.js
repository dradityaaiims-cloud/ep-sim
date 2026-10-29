// Learn-tab content as data. Block types:
//   {p: 'text'}  {h: 'subheading'}  {ul: [...]}  {note: 'callout'}
//   {table: {head: [...], rows: [[...]], go: colIndex?}}   (go => "Show in sim" button; the cell holds a substrate id)
// Normal values are textbook teaching ranges (Josephson); the simulator's own numbers are teaching values.

export const SECTIONS = [
  {
    id: 'start', title: 'Start here: using the simulator',
    blocks: [
      { p: 'This is a diagnostic EP study you run yourself. Four catheters record from a simulated heart, and a stimulator lets you pace it. Every tracing comes from one model of the heart, so when you change something the electrograms, the surface ECG and the 3D heart change together.' },
      { h: 'The screen' },
      { ul: [
        'Left: the recording system. Surface leads I, II, aVF and V1, then the high right atrium (HRA), the His catheter (distal and proximal), the coronary sinus (CS 9-10 at the ostium to CS 1-2 distally, along the mitral annulus) and the RV apex. The grid is 100 ms.',
        'Top left of the recording: the AH, HV, A–A and V–V intervals of the latest beat, and the result of the last S2.',
        'Right: the 3D heart. Each region lights up as it activates. The speed menu slows the heart so you can follow the impulse.',
        'Bottom: choose the heart (substrate) and set the stimulator: pacing site, output, pulse width and protocol.',
      ] },
      { h: 'Modes' },
      { ul: [
        'EP lab: free study of any heart with the stimulator.',
        'Pacemaker lab: a generic pacemaker in a patient; program it and watch the marker channel.',
        'Name the finding: ten frozen recordings to interpret (Wenckebach, AVNRT, AVRT, pre-excitation, flutter, heart block, concentric and eccentric VA, non-capture).',
        'Place the catheters: advance each catheter until its electrograms look right; scored out of 100.',
        'Cases: six unknown hearts to study and diagnose, and five pacemaker problems to name and fix; each scored out of 100 with feedback.',
      ] },
      { h: 'Keys' },
      { table: { head: ['Key', 'What it does'], rows: [
        ['Space', 'Deliver the protocol'], ['D', 'S2 −10 ms and deliver again'], ['S', 'Stop pacing'],
        ['F, K', 'Freeze, calipers'], ['T', 'Truth: what the heart really did'], ['C, L', 'Conduction system, labels'], ['1–4', 'Speed'], ['H', 'Help'],
      ] } },
    ],
  },
  {
    id: 'conduction', title: 'The conduction system',
    blocks: [
      { p: 'The sinus node, at the junction of the superior vena cava and the right atrium, fires spontaneously. The impulse spreads through both atria (the P wave) and reaches the AV node in the low septal right atrium, near the coronary sinus ostium.' },
      { p: 'The AV node is the only normal electrical connection between atria and ventricles. It conducts slowly, and conducts more slowly still when an impulse arrives early (decremental conduction). That delay lets the ventricles fill after atrial contraction and protects them from very fast atrial rhythms.' },
      { p: 'From the node the impulse enters the His bundle, then the right and left bundle branches and the Purkinje network, which spread it almost at once over the ventricular endocardium (a narrow QRS).' },
      { note: 'Most people have two inputs to the AV node: a fast pathway (superior, fast conduction, longer refractory period) and a slow pathway (inferior, near the CS ostium, slow conduction, shorter refractory period). When both exist with different properties you have dual AV nodal physiology, the substrate of AVNRT.' },
    ],
  },
  {
    id: 'catheters', title: 'Catheters, electrograms and intervals',
    blocks: [
      { p: 'A bipolar electrogram is the voltage difference between two neighbouring electrodes. It shows a sharp deflection when the tissue right under the pair activates, and only small, blunt far-field signals from tissue further away. So each catheter "sees" its own neighbourhood.' },
      { table: { head: ['Catheter', 'Where', 'What it shows'], rows: [
        ['HRA', 'High lateral right atrium near the sinus node', 'Early atrial activation in sinus rhythm'],
        ['His', 'Across the septal tricuspid annulus', 'A (low septal atrium), H (His spike), V'],
        ['CS', 'Coronary sinus, behind the left atrium along the mitral annulus', 'Left atrial (and some ventricular) activation, proximal to distal'],
        ['RVA', 'Right ventricular apex', 'Ventricular activation; the usual ventricular pacing site'],
      ] } },
      { h: 'Normal intervals' },
      { table: { head: ['Interval', 'Normal (ms)', 'What it measures'], rows: [
        ['PA', '25–55', 'Intra-atrial conduction to the His region'],
        ['AH', '55–125', 'AV nodal conduction'],
        ['HV', '35–55', 'His–Purkinje conduction'],
        ['QRS', '< 120', 'Ventricular activation'],
      ] } },
      { note: 'Measure AH from the A on the His channel to the H spike, and HV from the H spike to the earliest ventricular activation on any channel or the surface ECG.' },
    ],
  },
  {
    id: 'stimulation', title: 'Programmed stimulation',
    blocks: [
      { p: 'Pacing is a question you ask the heart. You control the timing; the heart\'s response (conduct, delay, block, or start a tachycardia) tells you about its refractory periods and pathways.' },
      { ul: [
        'Incremental pacing: pace at progressively shorter cycle lengths. From the atrium, the AH lengthens until a beat fails to reach the His: the AV nodal Wenckebach cycle length (normally about 300–500 ms).',
        'Extrastimulus testing: a drive train of 8 beats (S1) then one premature beat (S2), shortened by 10 ms at a time. The longest S2 that fails to conduct is the effective refractory period (ERP) of the structure it blocks in.',
        'Burst pacing: a short run of fast pacing, often used to induce or terminate a tachycardia.',
        'Ventricular pacing: tests retrograde (VA) conduction. Retrograde atrial activation that is earliest at the His region is concentric (AV node); earliest elsewhere is eccentric (an accessory pathway).',
      ] },
      { note: 'Pace at about twice the diastolic capture threshold. Too low and the stimulus may fail to capture late in the drive train or at short coupling intervals; the Truth list will tell you whether a missing response was non-capture or block.' },
      { h: 'Strength–duration' },
      { p: 'The output needed to capture falls as the pulse gets wider: threshold = rheobase × (1 + chronaxie / pulse width). At a pulse width equal to the chronaxie the threshold is twice the rheobase. Try lowering the output at 0.2 ms and at 1.0 ms.' },
    ],
  },
  {
    id: 'avnode', title: 'AV node: decrement, Wenckebach and ERP',
    blocks: [
      { p: 'In the normal heart, pace the HRA at 600, then 450, 400, 350 and 325 ms. The AH grows with each shorter cycle; at the shortest it grows beat by beat and then one A is not followed by an H: AV nodal Wenckebach. The HV does not change, because the His–Purkinje system is not decremental.' },
      { p: 'Then set Drive train + extrastimuli, S1 600 × 8, S2 400, and press D repeatedly. A2H2 lengthens smoothly as S2 shortens, until S2 blocks in the AV node (A without H): that S2 is the AV nodal ERP. Shorter still and S2 no longer captures the atrium: atrial ERP.' },
      { table: { head: ['Try', 'Heart', ''], rows: [['Normal decremental conduction and Wenckebach', 'Normal conduction', 'normal'], ['Long AH, Wenckebach at a longer cycle length', 'First-degree AV block', 'avb1']], go: 2 } },
    ],
  },
  {
    id: 'avnrt', title: 'Dual pathways and AVNRT',
    blocks: [
      { p: 'In the dual pathway heart, S2 decrements show A2H2 rising smoothly, then suddenly jumping by 50 ms or more: the S2 has reached the fast pathway while it is still refractory and conducts down the slow pathway instead. That is the AH jump.' },
      { p: 'Shorten S2 a little more. The impulse comes down the slow pathway slowly enough that the fast pathway has recovered, and it returns up the fast pathway to the atrium (an echo beat). If the slow pathway has recovered too, it goes round again: typical (slow–fast) AVNRT.' },
      { ul: [
        'Look at the His channel during the tachycardia: the A comes at almost the same time as the V (septal VA under about 70 ms), because atria and ventricles are activated in parallel from the node.',
        'Retrograde atrial activation is concentric: earliest at the His region and CS ostium.',
        'Burst pace the atrium to terminate it, or watch the Truth list to see where each beat goes.',
      ] },
      { table: { head: ['Try', 'Heart', ''], rows: [['AH jump and AVNRT induction', 'Dual AV nodal pathways', 'dual']], go: 2 } },
    ],
  },
  {
    id: 'ap', title: 'Accessory pathways',
    blocks: [
      { p: 'An accessory pathway is a strand of muscle that bridges the AV groove. It conducts fast and without decrement. Here it is left lateral, between the distal CS atrium and the basal lateral LV.' },
      { ul: [
        'Manifest (WPW): in sinus rhythm the ventricle is activated early through the pathway: short PR (and short HV), delta wave, wide QRS. The earliest ventricular electrogram is at CS 1-2.',
        'Concealed: the pathway conducts only from ventricle to atrium, so sinus rhythm looks normal. Pace the RV: the earliest atrial activation is at the distal CS (eccentric).',
        'Orthodromic AVRT: down the AV node, up the pathway. An atrial or ventricular extrastimulus can start it. The QRS is narrow and the atria activate distal CS first.',
      ] },
      { table: { head: ['Try', 'Heart', ''], rows: [['Pre-excitation', 'Manifest left lateral pathway', 'wpw'], ['Eccentric VA and AVRT', 'Concealed left lateral pathway', 'concealed']], go: 2 } },
    ],
  },
  {
    id: 'flutter', title: 'Atrial flutter',
    blocks: [
      { p: 'Typical flutter is a large loop of activation around the tricuspid annulus. The narrow strip between the tricuspid valve and the inferior vena cava, the cavotricuspid isthmus, conducts slowly and is the part ablation targets.' },
      { ul: [
        'In the flutter heart, burst pace from CS 9-10 (near the isthmus) at about 230 ms for 2–3 seconds. If the isthmus blocks in one direction, the wave goes round the other way and returns: flutter at about 230 ms (260 /min).',
        'Look at the atrial channels: activation runs in a fixed order round and round (counterclockwise: up the septum, down the lateral wall), with no pause. The AV node lets only some beats through (2:1 to 4:1).',
        'Compare the same burst in the normal heart: the atrium follows the pacing and stops when it stops.',
      ] },
      { table: { head: ['Try', 'Heart', ''], rows: [['Flutter induction', 'Atrial flutter substrate', 'flutter']], go: 2 } },
    ],
  },
  {
    id: 'block', title: 'Heart block and the sinus node',
    blocks: [
      { ul: [
        'Infra-Hisian disease: the HV is long (> 55 ms) and the QRS wide. Fast atrial pacing produces block below the His (A and H with no V), which is more dangerous than AV nodal Wenckebach.',
        'Complete heart block: no atrial impulse reaches the ventricles. An escape rhythm from the His region drives the ventricles at its own slower rate.',
        'Sinus node recovery time (SNRT): pace the HRA at 500 ms for 30 beats, stop, and measure from the last paced beat to the first sinus beat. Normal is under about 1500 ms (corrected SNRT, minus the sinus cycle length, under about 525 ms).',
      ] },
      { table: { head: ['Try', 'Heart', ''], rows: [['Long HV, infra-Hisian block', 'Infra-Hisian conduction disease', 'infrahis'], ['AV dissociation and escape', 'Complete heart block', 'chb'], ['Prolonged SNRT', 'Sinus node dysfunction', 'snd']], go: 2 } },
    ],
  },
  {
    id: 'pacemaker', title: 'Pacemaker lab',
    blocks: [
      { p: 'The pacemaker lab puts a generic dual-chamber pacemaker into the same simulated heart. The device sees only its two lead electrograms (right atrial appendage and RV apex) and acts only by pacing. It knows nothing about the heart: the heart decides whether a pacing pulse captures, and the device decides which sensed signals it acts on.' },
      { table: { head: ['Mode', 'Paces', 'Senses', 'Response to a sense'], rows: [
        ['AOO / VOO / DOO', 'A / V / both', 'nothing', 'none: fixed rate (asynchronous)'],
        ['AAI', 'atrium', 'atrium', 'inhibit'],
        ['VVI', 'ventricle', 'ventricle', 'inhibit'],
        ['DDD', 'both', 'both', 'inhibit, and track atrial beats into the ventricle'],
      ] } },
      { h: 'Timing in DDD' },
      { ul: [
        'Lower rate: if nothing is sensed, pace the atrium, then the ventricle after the paced AV delay.',
        'A sensed atrial beat starts the sensed AV delay; if no R wave comes, the ventricle is paced, but never faster than the upper tracking rate.',
        'PVARP: after every ventricular event the atrial channel ignores what it senses (marked AR), so retrograde P waves and far-field R waves are not tracked.',
        'Blanking: very short windows when a channel ignores everything, mainly the device\'s own pulses. Ventricular blanking after an atrial pace prevents crosstalk.',
      ] },
      { h: 'Things to try' },
      { ul: [
        'Capture threshold: lower the V output step by step until a VP has no QRS after it. Then do it at 0.2 ms and at 1.0 ms pulse width.',
        'Undersensing: raise V sensitivity above the R wave size. The device paces regardless of the patient\'s own beats.',
        'Oversensing: switch on myopotentials. The noise looks like R waves and inhibits pacing.',
        'Crosstalk: set V blanking to 0 and V sensitivity to 1 mV in DDD at a slow sinus rate. The atrial pulse is sensed on the ventricular lead; safety pacing at 110 ms protects the patient. Turn safety pacing off to see why it exists.',
        'Upper rate: raise the sinus rate above the upper rate. The AV delay stretches (pacemaker Wenckebach), then atrial beats fall in PVARP (2:1).',
        'PMT: in the patient with retrograde conduction, set PVARP to 200 ms and give a PVC. Then lengthen PVARP.',
      ] },
      { note: 'The device is generic and does not reproduce any manufacturer\'s timing. Mode switching, rate response, PMT algorithms, CRT, ICDs and conduction system pacing are not modelled.' },
    ],
  },
  {
    id: 'glossary', title: 'Glossary',
    blocks: [
      { table: { head: ['Term', 'Meaning'], rows: [
        ['ERP', 'Effective refractory period: the longest coupling interval that fails to capture or conduct through a structure'],
        ['Decremental conduction', 'Conduction that slows when the impulse arrives earlier (AV node)'],
        ['Concealed conduction', 'An impulse that enters a structure but does not emerge, yet changes how it responds to the next one'],
        ['AH jump', 'A sudden ≥ 50 ms rise in A2H2 for a 10 ms shorter S2: switch from fast to slow pathway'],
        ['Concentric / eccentric', 'Retrograde atrial activation earliest at the septum / elsewhere'],
        ['SNRT', 'Sinus node recovery time after overdrive pacing'],
        ['Rheobase, chronaxie', 'Threshold at a very long pulse; the pulse width at which the threshold is twice the rheobase'],
        ['PVARP', 'Post-ventricular atrial refractory period: atrial senses after a ventricular event are ignored for timing'],
        ['PMT', 'Pacemaker-mediated tachycardia: paced V, retrograde P sensed, tracked, paced V again, at the upper rate'],
        ['Crosstalk', 'One channel sensing the other channel\'s pacing pulse'],
      ] } },
    ],
  },
];
