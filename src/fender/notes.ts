import { OV, OVERLAP, PH, PW, f0, f1 } from './defaults';
import { geo } from './geometry';
import { buildBlank } from './pattern';
import { buildTiling } from './tiling';
import type {
  AssemblyStep,
  BlankModel,
  EngNote,
  FenderConfig,
  Geometry,
  JoinKey,
  TilingModel
} from './types';

/**
 * Assembly-step and engineering-note prose, transcribed verbatim from the design source
 * (lines ~979–984, ~1126–1156). See `warnings.ts` for the transcription conventions this
 * file follows: exact wording, em-dashes, curly apostrophes, `·` separators.
 *
 * Two deliberate departures from the source, per PLAN §9.9 and §9.4 — both noted inline
 * where they occur, nowhere else.
 */

/** Feeds assembly step 06. Source lines ~979–984. */
function joinNote(join: JoinKey): string {
  return {
    zip: 'Two 4 mm holes at top and bottom of each dart, both sides. Pull the dart closed with a zip tie through each pair and snip the tails flush.',
    rivet: 'Four 3.2 mm holes per dart plus a butt strap bridging the gap — two rivets per side.',
    slot: 'Two 3 mm slots per dart. A folded clip threads both slots and holds the dart shut — no hardware.',
    none: 'No holes at all. Score the marked line across both skirts and run one zip tie right around the girth of the fender in the scored channel. Nothing pierces the crown.'
  }[join];
}

/**
 * Mount positions along the arc. Mirrors the private `mounts` computation in
 * `pattern.ts` (source lines ~731–738) — not part of `BlankModel`, since it exists only
 * to place frame-mount slots and labels, not as a model field. Recomputed here rather
 * than exposed on the frozen `types.ts` contract; if `pattern.ts` ever changes this
 * formula, the fixture test in `notes.test.ts` will catch the drift.
 */
function mountPositions(s: FenderConfig, g: Geometry): { x: number; label: string }[] {
  const xTDC = (s.lead / Math.max(1, g.cov)) * g.L;
  return s.side === 'front'
    ? [{ x: xTDC, label: 'FORK CROWN' }]
    : [
        { x: Math.min(xTDC * 0.4, g.L - 40), label: 'CHAINSTAY BRIDGE' },
        { x: xTDC, label: 'SEATSTAY BRIDGE' }
      ];
}

/**
 * The eight-to-ten step assembly sequence. Step numbers renumber depending on whether
 * the blank is panelled (`blank.panelCount > 1`) and whether a mudflap exists
 * (`s.mudflap > 0`) — preserved exactly from source lines ~1126–1137.
 */
export function buildSteps(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g),
  tiling: TilingModel = buildTiling(s, g, blank)
): AssemblyStep[] {
  const panelled = blank.panelCount > 1;

  const steps: AssemblyStep[] = [
    {
      n: '01',
      title: 'Check the scale',
      body: 'Print at 100% with margins set to none. Measure the 100 mm ruler on every sheet before cutting — if it is short, the printer scaled the page and nothing will fit.'
    },
    {
      n: '02',
      title: 'Tape the tiles',
      body: `Trim each tile on the grey dashed frame and overlap the next by ${OV} mm, matching the cut line where it crosses. ${tiling.cols * tiling.rows} tiles for the blank.`
    },
    {
      n: '03',
      title: 'Cut the blank',
      body: 'Cut the solid outline including every V dart. Do not cut the blue dashed lines — those are folds and score lines.'
    },
    {
      n: '04',
      title: 'Score, don’t slice',
      body: 'Score the fold lines about a third of the way through, on the outside face, with a blunt point or the back of a blade. Cut deeper than half and the fold becomes a hinge that will crack. Warm material folds cleaner than cold.'
    },
    {
      n: '05',
      title: 'Fold the skirts',
      body: `Bend both skirts down to ${s.angle}° over a straight edge. Work along the fold in stages rather than creasing it all at once.`
    },
    {
      n: '06',
      title: 'Close the darts',
      body: joinNote(s.join)
    }
  ];

  if (panelled) {
    steps.push({
      n: '07',
      title: 'Lap the panels',
      body: `Cut ${blank.panelCount} panels. Each panel except the last is cut ${OVERLAP} mm past its seam line — that tail is the lap, and it goes UNDERNEATH the panel in front so water runs across the joint, not into it. Slide the panels together until the fastener row sits in the middle of the lap, then fasten through both layers: one ${s.join === 'rivet' ? 'rivet' : s.join === 'slot' ? 'clip' : 'zip tie'} per hole, across the full width. The lapped joint ends up stiffer than the sheet around it.`
    });
  }

  steps.push({
    n: panelled ? '08' : '07',
    title: 'Bend the struts',
    body: `Fold each strut 26 mm from both ends. One end takes the pair of holes at the skirt edge; the other zip-ties, velcros, or bolts to the stay or eyelet.${s.fuse ? ' The single oversize hole is deliberate — it is the end you want to fail first.' : ''}`
  });

  if (s.mudflap > 0) {
    steps.push({
      n: panelled ? '09' : '08',
      title: 'Add the mudflap',
      body: `Lap the ${f0(g.crownTail)} × ${f0(s.mudflap)} mm flap 16 mm under the tail, holes aligned, and fasten through the three crown holes. It is a separate part on purpose — it is the bit that gets destroyed.`
    });
  }

  steps.push({
    n: 'LAST',
    title: 'Fit to the bike',
    body: `${s.side === 'front' ? 'Bolt the fork-crown slot first and slide it until the fender sits central, then ' : 'Bolt the chainstay-bridge slot, then the seastay bridge, then '}set the ${s.struts} struts so the gap to the tyre stays even at ${s.clear} mm all the way round. Spin the wheel and listen before you ride.`
  });

  return steps;
}

/**
 * The 15 engineering notes. Transcribed verbatim from source lines ~1139–1156, with two
 * corrections:
 *
 * - "Bend allowance, properly" — PLAN §9.9. The source's final sentence claims every
 *   term collapses to zero at zero thickness. False: `rBend = max(t, 0.2)` keeps a
 *   0.2 mm bend radius alive at `t = 0`, so `bendComp` never reaches zero (see the
 *   `geometry.test.ts` case documenting the ~0.016 mm residual). Reworded to state what
 *   actually happens; the maths is untouched.
 * - "Nesting" — PLAN §9.4. The source claims the nested pair shares "the shared edge",
 *   but the transform (`translate(L, Wd·2+10) rotate(180)`) leaves a 10 mm gap — the two
 *   blanks never touch. Reworded to match the geometry now that tiling covers the pair.
 */
export function buildNotes(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g)
): EngNote[] {
  const mounts = mountPositions(s, g);
  // Mirrors pattern.ts's local `inset` (source line ~740) — see mountPositions() above
  // for why this is recomputed rather than read off a model.
  const inset = Math.max(5, Math.min(7, g.skirt * 0.22));
  const panelCount = blank.panelCount;

  return [
    {
      title: 'Why the darts exist',
      body: 'The blank is a developable cylinder along its length, so bending it round the wheel is free. Folding the skirts down is not: the skirt free edge sits on a smaller radius than the fold line, so it must be shorter. Each dart removes exactly that surplus.',
      formula: `take-up = L × drop / R = ${f0(g.L)} × ${f0(g.drop)} / ${f0(g.R)} = ${f1(g.removal)} mm over ${g.n} darts → ${f1(g.notch)} mm each`
    },
    {
      title: 'Radius chain',
      body:
        s.measuredR > 0
          ? 'You have overridden the estimate with a measured radius, which is the right way round — the BSD approximation is the largest single error in the whole pattern.'
          : 'Tyre outer radius is approximated as BSD/2 + section width, i.e. a round section as tall as it is wide. Measure and override it.',
      formula: `R = ${s.measuredR > 0 ? 'measured' : 'BSD/2 + tyre'} + clearance = ${f0(g.tyreR)} + ${s.clear} = ${f0(g.R)} mm`
    },
    {
      title: 'Taper is local, not global',
      body: 'Crown width is held constant until the taper knee, then interpolated linearly to the tail. Because every dart is computed from the local crown width, the pattern edge follows the taper automatically — dart positions do not move, the edge they sit on does. Taper exists so the tail can pass a chainstay bridge or fork crown, not for looks.',
      formula: `crown ${f0(g.crown0)} mm until ${f0(g.knee)} mm, then → ${f0(g.crownTail)} mm at ${f0(g.L)} mm`
    },
    {
      title: 'Asymmetric coverage',
      body: 'Lead and trail are separate because a front fender wants material ahead of the axle (that is where the spray at your feet comes from) and a rear wants a long tail. Zero lead gives you a rear-only fender that starts at the top of the wheel.',
      formula: `lead ${s.lead}° + trail ${s.trail}° = ${f0(g.cov)}°`
    },
    {
      title: s.side === 'front' ? 'Front mounting' : 'Rear mounting',
      body:
        s.side === 'front'
          ? 'A front fender hangs from one bolt through the fork crown at top dead centre, with the struts running to the blade eyelets. Everything behind that bolt is cantilevered, so the struts sit on the trailing half of the arc where they actually resist flutter. The crown slot runs along the length so the fender can slide fore and aft to centre it.'
          : 'A rear fender takes two frame bolts — the chainstay bridge low at the front and the seatstay bridge higher up — with the struts running back to the dropouts. Two mounts on different radii is what stops a long rear fender from oscillating. Both are slots, not holes, because no two frames put those bridges the same distance apart.',
      formula: mounts.map((m) => `${m.label} at ${f0(m.x)} mm`).join(' · ')
    },
    {
      title: 'How the panel seam works',
      body: `Butting two panels edge to edge has nothing to fasten. Instead each panel is cut ${OVERLAP} mm past its seam and laps under the next, so a single row of fasteners passes through both layers in the middle of the lap. Lap direction matters more than fastener choice: forward panel on top, always.`,
      formula:
        panelCount > 1
          ? `${panelCount} panels · ${OVERLAP} mm lap · fastener row at lap centre`
          : 'single sheet — no seams'
    },
    {
      title: 'What a butt strap is',
      body: 'A rivet cannot pull a V-shaped gap closed the way a zip tie can — it needs two layers to squeeze. The butt strap is a small separate rectangle that sits behind the dart and bridges it: two rivets into the left flap, two into the right. The dart stays open by design; the strap carries the load. Zip ties and clips need no strap because they pull through both sides at once.',
      formula: 'strap 34 × 14 mm · 4 × 3.2 mm holes · one per dart'
    },
    {
      title: 'Every hole is a crack initiator',
      body: 'In thin plastic, fatigue cracks start at holes, and the crown is the worst place to put one because that is where water sits. Hence the hole-free option: a scored channel and one zip tie round the girth, nothing pierced. Struts fasten at the skirt edge for the same reason.',
      formula: `strut pairs at ${f0(inset)} mm inset, 10 mm apart · crown unpierced`
    },
    {
      title: 'Sacrificial strut end',
      body: 'A fender that jams should let go before it stops the wheel. The optional single oversize hole at the frame end is the intended failure point: one fastener in tension, nothing redundant. This is a safety feature, not a tolerance.',
      formula: s.fuse ? 'single 6.4 mm hole, one fastener' : 'off — both ends fully fastened'
    },
    {
      title: 'Nesting',
      // PLAN §9.4 — the source said "cut the shared edge once", but the transform
      // (translate(L, Wd·2+10) rotate(180)) leaves a 10 mm gap between the two blanks.
      // There is no shared edge. Reworded to match; the maths is unchanged.
      body: 'A tapered blank nests tail-to-nose with a second one, so a front and rear pair costs less than twice one fender in stock width. The pair is drawn and cut as two separate blanks 10 mm apart — there is no shared edge, so cut each one.',
      formula: s.nest ? `pair stock ≈ ${f0(g.L)} × ${f0(g.Wd * 2 + 10)} mm` : 'off'
    },
    {
      title: 'Print geometry',
      body: `Each tile draws into ${PW} × ${PH} mm inside a 15 mm safe margin, which clears the unprintable edge on essentially every consumer inkjet and laser. Tiles overlap ${OV} mm so the cut line crosses both sheets and can be aligned by eye.`,
      formula: `A4 landscape 297 × 210 − 2 × 15 mm = ${PW} × ${PH} mm live`
    },
    {
      title: 'Bend allowance, properly',
      body:
        'A fold does not consume the length a sharp corner would. The flat pattern needs the two legs measured to the theoretical sharp corner, minus twice the setback, plus the arc length along the neutral axis. Bend radius is taken as equal to thickness (a hand fold over a straight edge, not a press brake) and the k-factor as 0.44, which is the usual figure for soft sheet in air bending. ' +
        // PLAN §9.9 — the source claimed every term collapses to zero at t = 0. It
        // doesn't: rBend = max(t, 0.2) keeps a 0.2 mm bend radius alive, so bendComp
        // settles a few hundredths of a millimetre short of zero. The dart term (notch)
        // does collapse correctly — see geometry.test.ts.
        'At zero thickness the dart term reaches the ideal, and the bend term falls to a few hundredths of a millimetre — below anything you can cut to.',
      formula: `setback = (r+t)·tan(α/2) = ${f1(g.setback)} · BA = α(r+0.44t) = ${f1(g.BA)} · net ${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm per fold`
    },
    {
      title: 'Darts get wider with thickness',
      body: 'Two folded flaps meeting at a closed dart collide edge-on if the dart is cut to the ideal width — the material has to go somewhere. Adding one thickness to every dart gives the two edges room to sit alongside each other rather than fighting.',
      formula: `dart = L·drop/R/n + t = ${f1(g.notch)} mm`
    },
    {
      title: 'Hemmed edge',
      body: 'Folding the skirt edge back on itself doubles the material at the most vulnerable line on the fender, removes the cut edge you would otherwise brush your ankle against, and stiffens the whole skirt far more than extra thickness would. Cost is a wider blank and one more fold to make cleanly.',
      formula: s.hem ? `hem ${f0(g.hem)} mm = 2t + 4 · blank ${f0(g.Wd)} mm wide` : 'off'
    },
    {
      title: 'Export',
      body: 'SVG and DXF both come out at 1 unit = 1 mm with no transform, so they land at true size in Inkscape, LightBurn, Illustrator or any CAM tool. Cut geometry, fold and score lines, and hole centres go on separate layers — a laser wants to score the folds at low power and cut the outline at full, and it cannot guess which is which from the geometry alone.',
      // NB not corrected here — PLAN §9.3 assigns the "R12 ASCII" → "DXF AC1015
      // (R2000)" wording fix to WP5 (the DXF export note lives in this file, but the
      // header fix itself is export/dxf.ts's job). This task's brief lists only §9.9
      // and §9.4 as required corrections; flagged for whoever picks up WP5.
      formula: 'SVG: 1 user unit = 1 mm · DXF: R12 ASCII, LWPOLYLINE + CIRCLE, layers CUT / FOLD / HOLES'
    },
    {
      title: 'Still open',
      body: 'Cross-section as a true arc rather than a crown plus two flat facets — better spray control, much harder pattern. A measured k-factor for real sheet rather than the 0.44 rule of thumb. And strut stiffness: a rolled or channel-section strut would outperform a flat strip by a large margin, but it stops being cuttable with scissors, which is the whole point of this thing.',
      formula: ''
    }
  ];
}
