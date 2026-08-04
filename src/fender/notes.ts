import { LAP, OV, PH, PW, f0, f1 } from './defaults';
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
 * file follows: exact wording, curly apostrophes.
 *
 * PLAN FEEDBACK WP17 (the copy pass) reworded most of this file's prose to drop
 * em-dashes and `·` separators (decision A3) and to cut AI-writing tells. Facts and
 * voice are unchanged; only punctuation and a few sentence joins moved. Every changed
 * body/formula is excluded from notes.test.ts's verbatim-fixture comparison, each with
 * a comment there, the same mechanism §9.3/§9.4/§9.9 established for genuine factual
 * corrections. golden.json keeps the ORIGINAL design-source wording as the historical
 * record; it is deliberately not regenerated for this file.
 */

/**
 * Feeds assembly step 06. Source lines ~979–984, extended by WP23 §23.3/§23.5: the
 * skirt now shingles, so every join fastens a real overlap rather than a butt seam —
 * `cinch` is new, and `slot` is the integral punched tongue, not a separate clip.
 */
function joinNote(join: JoinKey): string {
  return {
    cinch: 'One 4 mm hole per panel, outside the lap. Pull the lap shut with a zip tie spanning across and snip the tail flush.',
    zip: 'Two 4 mm holes at top and bottom of each dart, both sides. Pull the dart closed with a zip tie through each pair and snip the tails flush.',
    rivet: 'One 3.2 mm hole per layer, top and bottom of each dart, straight through the lap. Rivet each pair together.',
    slot: 'A tongue punched from the lap folds through a slot in the panel beneath and lies flat against the inside. No hardware.',
    none: 'No holes at all. Score the marked line across both skirts and run one zip tie right around the girth of the fender in the scored channel. Nothing pierces the crown.'
  }[join];
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
      body: 'Print at 100% with margins set to none. Measure the 100 mm ruler on every sheet before cutting. If it is short, the printer scaled the page and nothing will fit.'
    },
    {
      n: '02',
      title: 'Tape the tiles',
      body:
        s.stock === 'a4'
          ? `Trim each tile on the grey dashed frame — that trim line is the panel seam, so cutting it is step 3 and 7 at once. ${tiling.cols * tiling.rows} tiles for the blank.`
          : `Trim each tile on the grey dashed frame and overlap the next by ${OV} mm, matching the cut line where it crosses. ${tiling.cols * tiling.rows} tiles for the blank.`
    },
    {
      n: '03',
      title: 'Cut the blank',
      body: 'Cut the solid outline including every V dart. Do not cut the blue dashed lines: they are folds and score lines.'
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
      body: `Cut ${blank.panelCount} panels: each is one printed tile, and each except the last is cut ${LAP} mm past its seam line. That tail is the lap: it sits on the wheel side of the joint once assembled, so water crossing the seam runs over it rather than into it. Slide the panels together until the fastener row sits in the middle of the lap, then fasten through both layers: one ${s.join === 'rivet' ? 'rivet' : 'zip tie'} per hole, across the full width. The lapped joint ends up stiffer than the sheet around it.`
    });
  }

  steps.push({
    n: panelled ? '08' : '07',
    title: 'Bend the struts',
    body: `Fold each strut 26 mm from both ends. One end takes the pair of holes at the skirt edge; the other ${
      s.strutEnd === 'strap'
        ? 'threads a 25 mm hook-and-loop strap through the pair of slots at the flared tip, round the stay, and back through the second slot'
        : 'bolts or zip-ties to the stay or eyelet'
    }.`
  });

  if (s.mudflap > 0) {
    steps.push({
      n: panelled ? '09' : '08',
      title: 'Add the mudflap',
      body: `Lap the ${f0(g.crownTail)} × ${f0(s.mudflap)} mm flap 16 mm under the tail, holes aligned, and fasten through the three crown holes. It is a separate part on purpose: it is the bit that gets destroyed.`
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
 * The 15 engineering notes (16 in the design source — WP21 §21.2/§21.3 drops
 * "Sacrificial strut end" with the feature it described). Transcribed verbatim from
 * source lines ~1139–1156, with
 * three corrections:
 *
 * - "Bend allowance, properly" — PLAN §9.9. The source's final sentence claims every
 *   term collapses to zero at zero thickness. False: `rBend = max(t, 0.2)` keeps a
 *   0.2 mm bend radius alive at `t = 0`, so `bendComp` never reaches zero (see the
 *   `geometry.test.ts` case documenting the ~0.016 mm residual). Reworded to state what
 *   actually happens; the maths is untouched.
 * - "Nesting" — PLAN §9.4. The source claims the nested pair shares "the shared edge",
 *   but the transform (`translate(L, Wd·2+10) rotate(180)`) leaves a 10 mm gap — the two
 *   blanks never touch. Reworded to match the geometry now that tiling covers the pair.
 * - "Export" — PLAN §9.3. The source's formula line claims "R12 ASCII"; LWPOLYLINE is
 *   R14+ and the file had no HEADER/TABLES section. `export/dxf.ts` now emits a minimal
 *   HEADER/TABLES pair, so the formula line is reworded to "AC1015 (R2000)" to match.
 */
export function buildNotes(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g)
): EngNote[] {
  // WP33 §9.40 — the actual, post-nudge slot x, read off the model instead of
  // recomputed here (which used to mirror pattern.ts's pre-nudge maths and could drift
  // up to 15 mm from the slot `nudgeAway` actually cut).
  const mounts = blank.mounts;
  // Mirrors pattern.ts's local `inset` (source line ~740) — no model field for this one
  // since it only feeds a comment on strut placement, not a fact that appears elsewhere.
  const inset = Math.max(5, Math.min(7, g.skirt * 0.22));
  const panelCount = blank.panelCount;

  return [
    {
      // WP23 §23.1/§23.2 — the source removed this surplus as a V-notch; it is now
      // left in as a shingled lap instead (decision C1), so both the mechanism and the
      // formula's own result (`lap`, not `notch`) change.
      title: 'Why the shingle exists',
      body: 'The blank is a developable cylinder along its length, so bending it round the wheel is free. Folding the skirts down is not: the skirt free edge sits on a smaller radius than the fold line, so it must be shorter than a plain butt fit. Rather than cutting that surplus away, each dart is cut as a plain slit and the surplus is left in as an overlap the next segment shingles under.',
      formula: `take-up = L × drop / R = ${f0(g.L)} × ${f0(g.drop)} / ${f0(g.R)} = ${f1(g.removal)} mm over ${g.n} darts → ${f1(g.lap)} mm lap each`
    },
    {
      title: 'Radius chain',
      body:
        s.measuredR > 0
          ? 'You have overridden the estimate with a measured radius, which is the right way round: the BSD approximation is the largest single error in the whole pattern.'
          : 'Tyre outer radius is approximated as BSD/2 + section width, i.e. a round section as tall as it is wide. Measure and override it.',
      formula: `R = ${s.measuredR > 0 ? 'measured' : 'BSD/2 + tyre'} + clearance = ${f0(g.tyreR)} + ${s.clear} = ${f0(g.R)} mm`
    },
    {
      title: 'Taper is local, not global',
      body: 'Crown width is held constant until the taper knee, then interpolated linearly to the tail. Because every dart is computed from the local crown width, the pattern edge follows the taper automatically: dart positions do not move, the edge they sit on does. Taper exists so the tail can pass a chainstay bridge or fork crown, not for looks.',
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
          : 'A rear fender takes two frame bolts (the chainstay bridge low at the front and the seatstay bridge higher up), with the struts running back to the dropouts. Two mounts on different radii is what stops a long rear fender from oscillating. Both are slots, not holes, because no two frames put those bridges the same distance apart.',
      formula: mounts.map((m) => `${m.label} at ${f0(m.x)} mm`).join(', ')
    },
    {
      title: 'How the panel seam works',
      body: `Butting two panels edge to edge has nothing to fasten. Instead each panel is cut ${LAP} mm past its seam and laps under the next — the same band the printed tiles overlap by, since one tile is one panel. A single row of fasteners passes through both layers in the middle of the lap. Lap direction matters more than fastener choice: the upstream panel sits on the wheel side, always.`,
      formula:
        panelCount > 1
          ? `${panelCount} panels, ${LAP} mm lap, fastener row at lap centre`
          : 'single sheet, no seams'
    },
    {
      // WP23 §23.1/§23.3 — a rivet used to need a separate butt strap because a V-
      // shaped gap left it nothing to squeeze. With a real shingled lap under it, a
      // rivet goes straight through both layers instead, so the strap (and its own
      // Sheet-B part) is gone.
      title: 'Rivets go straight through the lap',
      body: 'A rivet through a butt seam has nothing to squeeze: a V-shaped gap needs two layers pulled together first, which is what the old butt strap was for. With a real shingled lap already sitting under the dart, the rivet passes straight through both layers on its own, one hole per layer, no separate part.',
      formula: `1 rivet per layer, 4.5 mm in from the free edge, needs ≥ 7 mm lap (have ${f1(g.lap)} mm)`
    },
    {
      title: 'Every hole is a crack initiator',
      body: 'In thin plastic, fatigue cracks start at holes, and the crown is the worst place to put one because that is where water sits. Hence the hole-free option: a scored channel and one zip tie round the girth, nothing pierced. Struts fasten at the skirt edge for the same reason.',
      formula: `strut pairs at ${f0(inset)} mm inset, 10 mm apart, crown unpierced`
    },
    {
      title: 'Nesting',
      // WP20 §20.1 (decision B2) — nesting removed outright. It was a ghost outline for
      // planning stock layout, not a second printed fender: tiling derived its page
      // count from the doubled bounding box, so turning it on silently added six sheets
      // of a 180°-rotated duplicate of the pattern already in hand. Removed rather than
      // fixed; see docs/FEEDBACK-2-PLAN.md WP20 §20.1.
      body: 'Removed. A tapered blank nests tail-to-nose with a second one on paper, but drawing that ghost as real print tiles meant turning it on roughly doubled the sheet count for no cuttable benefit — the ghost was only ever a cutting-layout suggestion, not a second fender to print.',
      formula: 'removed'
    },
    {
      title: 'Print geometry',
      body:
        s.stock === 'a4'
          ? `Each tile draws into ${PW} × ${PH} mm inside a 15 mm safe margin, which clears the unprintable edge on essentially every consumer inkjet and laser. Tiles overlap ${LAP} mm — the same band as the panel lap, since one tile is one panel.`
          : `Each tile draws into ${PW} × ${PH} mm inside a 15 mm safe margin, which clears the unprintable edge on essentially every consumer inkjet and laser. Tiles overlap ${OV} mm so the cut line crosses both sheets and can be aligned by eye.`,
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
        // PLAN FEEDBACK WP17 — dropped the trailing em-dash on top of the §9.9 reword.
        'At zero thickness the dart term reaches the ideal, and the bend term falls to a few hundredths of a millimetre, too small to cut to.',
      formula: `setback = (r+t)×tan(α/2) = ${f1(g.setback)}, BA = α(r+0.44t) = ${f1(g.BA)}, net ${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm per fold`
    },
    {
      // WP23 §23.2 — the ideal-geometry surplus was always going somewhere; it used to
      // be cut away as dart width, and now it is left in as lap width instead, one
      // thickness wider either way so the two folded edges have room to sit alongside
      // each other rather than fighting.
      title: 'The lap gets wider with thickness',
      body: 'Two folded flaps meeting at a plain slit would collide edge-on at the ideal geometric surplus, so the material has to go somewhere: it stays in, as overlap. Adding one thickness to every lap gives the two edges room to sit alongside each other rather than fighting.',
      formula: `lap = L×drop/R/n + t = ${f1(g.lap)} mm`
    },
    {
      title: 'Hemmed edge',
      body: 'Folding the skirt edge back on itself doubles the material at the most vulnerable line on the fender, removes the cut edge you would otherwise brush your ankle against, and stiffens the whole skirt far more than extra thickness would. Cost is a wider blank and one more fold to make cleanly.',
      formula: s.hem ? `hem ${f0(g.hem)} mm = 2t + 4, blank ${f0(g.Wd)} mm wide` : 'off'
    },
    {
      title: 'Export',
      // PLAN FEEDBACK WP17 — the em-dash before "a laser wants..." is gone (colon now
      // introduces the reason), on top of the §9.3 formula fix below.
      body: 'SVG and DXF both come out at 1 unit = 1 mm with no transform, so they land at true size in Inkscape, LightBurn, Illustrator or any CAM tool. Cut geometry, fold and score lines, and hole centres go on separate layers: a laser wants to score the folds at low power and cut the outline at full, and it cannot guess which is which from the geometry alone.',
      // PLAN §9.3 — the source claimed "R12 ASCII", but LWPOLYLINE is R14+ and the
      // file had no HEADER/TABLES section. export/dxf.ts now emits a minimal HEADER
      // ($ACADVER = AC1015) and a TABLES/LAYER section; entity geometry is unchanged.
      // Corrected here to match. See notes.test.ts's "corrected prose" block.
      // PLAN FEEDBACK WP17 — the `·` list separator is a `;` between the SVG/DXF
      // clauses (each already has its own commas) and a `,` within each.
      formula: 'SVG: 1 user unit = 1 mm; DXF: AC1015 (R2000), LWPOLYLINE + CIRCLE, layers CUT / FOLD / HOLES'
    },
    {
      title: 'Still open',
      body: 'Cross-section as a true arc rather than a crown plus two flat facets: better spray control, much harder pattern. A measured k-factor for real sheet rather than the 0.44 rule of thumb. And strut stiffness: a rolled or channel-section strut would outperform a flat strip by a large margin, but it stops being cuttable with scissors, which is the whole point of this thing.',
      formula: ''
    }
  ];
}
