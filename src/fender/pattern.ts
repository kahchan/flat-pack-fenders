import { LAP, PW, TONGUE_L, TONGUE_W, f0, f1 } from './defaults';
import { crownAt, geo } from './geometry';
import type { BlankModel, FenderConfig, Geometry, Hole, Label, Path, Slot } from './types';

/** Margin around the blank in the on-screen viewBox, mm. */
const VIEW_MARGIN = 22;

interface Event {
  x: number;
  dart?: boolean;
}

/** Edge-to-edge clearance a seam's fastener column should keep from any other feature
 * column (dart fasteners, strut fasteners, mount slots, the mudflap holes) — WP19
 * §19.3/§19.4's "clear window" rule. Matches the 6 mm buffer the dart columns themselves
 * already use off their own centreline (`cinch`'s `off = lap/2 + 6`, below). */
export const SEAM_CLEAR = 6;

/**
 * WP19 §19.3/§19.4: place each seam left to right, choosing where in its available
 * window it falls to maximise clearance from every dart/strut/mount column, rather than
 * nudging one offending seam at a time (which just relocates the collision onto whoever
 * is now nearest).
 *
 * Each seam's ceiling is `prevBoundary + stepX` — the nominal, fully-uniform grid
 * position relative to wherever the *actual* previous boundary landed — so panel `i`'s
 * cut extent (this seam, plus its lap, back to the previous boundary) can never exceed
 * `PW` no matter how far earlier seams have drifted: the seam only ever moves earlier
 * than its ceiling, never later, so that invariant holds by construction.
 *
 * The one thing a purely local "never later than ceiling" rule doesn't bound is the
 * LAST panel: moving every seam earlier pushes more of the blank into that final
 * uncapped panel, which can overflow `PW` even though every seam individually obeyed its
 * own ceiling. `budget` is exactly the slack panelCount's own `ceil()` already banked for
 * this — how much smaller than `PW` the last panel is at zero drift — and capping total
 * earliness (summed across every seam) to that budget makes the last panel's extent
 * `extentAtZeroDrift + totalDrift`, which stays `≤ PW` for the same reason the first
 * `panelCount` windows covered the blank in the first place. No seam ever needs
 * relocating after the fact.
 */
function placeSeams(panelCount: number, stepX: number, startX: number, totalW: number, dangerXs: number[]): number[] {
  const PER_SEAM_SLACK = 40; // mm a single seam may sit short of its own ceiling
  let budget = PW + (panelCount - 1) * stepX - totalW; // §19.2's own banked slack
  const seams: number[] = [];
  let prevBoundary = startX;

  for (let i = 1; i < panelCount; i++) {
    const ceiling = prevBoundary + stepX;
    const floor = ceiling - Math.min(PER_SEAM_SLACK, budget);
    // Satisficing, not maximising: the first position (searching from `ceiling`
    // backwards, so least drift first) that clears every danger column by `TARGET` is
    // good enough and stops the search there. Grabbing the single clearest spot in the
    // whole window instead would happily spend the entire budget on a seam that only
    // needed a few mm of it, starving whichever seam further down the blank actually
    // needs the room — this is a shared budget, not five independent ones.
    const TARGET = SEAM_CLEAR + 5; // padding for the two largest hole radii on the sheet
    let best = ceiling;
    let bestClearance = -Infinity;
    for (let x = ceiling; x >= floor; x -= 0.5) {
      // The fastener row sits at the lap's centre (`xm = x + LAP/2`, matching the
      // Panel seams block below), not at the cut line itself — clearance has to be
      // judged from where the holes actually land.
      const xm = x + LAP / 2;
      const clearance = dangerXs.reduce((worst, d) => Math.min(worst, Math.abs(xm - d)), Infinity);
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = x;
      }
      if (bestClearance >= TARGET) break;
    }
    seams.push(best);
    budget -= ceiling - best;
    prevBoundary = best;
  }

  return seams;
}

/**
 * Sheet A — the fender blank.
 *
 * Ordering matters and is preserved from the design source: holes and slots are pushed
 * dart-row first, then frame mounts, struts, mudflap, tongue, then panel seams. Anything
 * that iterates these arrays (exports, DXF layers, print tiles) inherits that order, and
 * the fixture tests assert against it.
 */
export function buildBlank(s: FenderConfig, g: Geometry = geo(s)): BlankModel {
  const cw = (x: number) => crownAt(g, x);
  const yFreeT = (x: number) => g.yc - cw(x) / 2 - g.skirt;
  const yFoldT = (x: number) => g.yc - cw(x) / 2;
  const yFoldB = (x: number) => g.yc + cw(x) / 2;
  const yFreeB = (x: number) => g.yc + cw(x) / 2 + g.skirt;

  // ── Outline ────────────────────────────────────────────────────────────────
  // One vertex per event along the top edge, then the bottom edge in reverse. A dart
  // is three vertices: down to the fold line and back out, cutting a V from the skirt.
  const events: Event[] = [{ x: 0 }];
  if (g.knee > 0 && g.knee < g.L) events.push({ x: g.knee });
  for (let i = 1; i < g.n; i++) events.push({ x: i * g.pitch, dart: true });
  events.push({ x: g.L });
  events.sort((p, q) => p.x - q.x);

  // Chamfer at the tongue-to-skirt corner (PLAN §13.3): without it, the skirt free edge
  // starts at full depth right at x = 0 — a square corner against the tongue's narrow
  // 24 mm width that fouls the frame and is sharp against a shin. Runs from the tongue's
  // edge out to full skirt depth over the first `s.bevel` mm, clamped short of whatever
  // event comes next (a dart's own offset, the taper knee, or a blank so short the tail
  // is closer than the bevel) so the chamfer never overruns it. Only meaningful with the
  // tongue on — without one there is no "tongue's edge" to run the chamfer from, and the
  // nose is already a plain flat edge, not a sharp corner.
  const nextEvent = events[1];
  const nextX = nextEvent ? nextEvent.x - (nextEvent.dart ? g.notch / 2 : 0) : g.L;
  const bevelL = s.tongue ? Math.max(0, Math.min(s.bevel, nextX)) : 0;

  const edge = (isTop: boolean): [number, number][] => {
    const free = isTop ? yFreeT : yFreeB;
    const fold = isTop ? yFoldT : yFoldB;
    const pts: [number, number][] = [];
    for (const e of events) {
      if (e.dart) {
        pts.push([e.x - g.notch / 2, free(e.x)], [e.x, fold(e.x)], [e.x + g.notch / 2, free(e.x)]);
      } else if (e.x === 0 && bevelL > 0) {
        const tongueY = isTop ? g.yc - TONGUE_W / 2 : g.yc + TONGUE_W / 2;
        pts.push([0, tongueY], [bevelL, free(bevelL)]);
      } else {
        pts.push([e.x, free(e.x)]);
      }
    }
    return pts;
  };

  // WP23 §23.2: with `notch` always 0, a dart's own three points can now round to the
  // SAME point as a neighbouring non-dart event (the taper knee, rarely, when a dart
  // pitch position happens to land on it) — a zero-length segment in a CUT path, the
  // exact laser-dwell defect the tongue bevel above already avoids. Deduped here, once,
  // at render-rounding precision, rather than chasing every place a coincidence could
  // occur.
  const seg = (pts: [number, number][]) => {
    const rounded = pts.map((p) => `${f1(p[0])},${f1(p[1])}`);
    return rounded.filter((p, i) => i === 0 || p !== rounded[i - 1]).join(' L ');
  };

  let outline = `M ${seg(edge(true))} L ${seg(edge(false).reverse())}`;
  if (s.tongue) {
    // With a bevel, the reversed bottom edge already ends exactly on the tongue's lower
    // corner, so emitting it again would leave a zero-length segment in a CUT path — a
    // laser can dwell there and burn a mark, and it puts a repeated vertex in the DXF
    // polyline. Skip the redundant first move in that case.
    if (bevelL <= 0) outline += ` L 0,${f1(g.yc + TONGUE_W / 2)}`;
    outline +=
      ` L ${-TONGUE_L},${f1(g.yc + TONGUE_W / 2)}` +
      ` L ${-TONGUE_L},${f1(g.yc - TONGUE_W / 2)}` +
      ` L 0,${f1(g.yc - TONGUE_W / 2)}`;
  }
  outline += ' Z';

  // ── Folds ──────────────────────────────────────────────────────────────────
  const kneeInRange = g.knee > 0 && g.knee < g.L;
  const foldXs = kneeInRange ? [0, g.knee, g.L] : [0, g.L];
  const foldPath = (fold: (x: number) => number) =>
    `M ${foldXs.map((x) => `${f1(x)},${f1(fold(x))}`).join(' L ')}`;

  const foldLines: Path[] = [
    { d: foldPath(yFoldT) },
    { d: foldPath(yFoldB) },
    { d: `M ${s.tongue ? -TONGUE_L : 0},${f1(g.yc)} L ${f1(g.L)},${f1(g.yc)}` }
  ];

  const holes: Hole[] = [];
  const slots: Slot[] = [];
  const scoreLines: Path[] = [];
  const seams: Path[] = [];
  const lapLines: Path[] = [];
  const lapArrows: Path[] = [];
  const extraLabels: Label[] = [];

  // WP19 §19.3/§19.4: x-columns a panel seam must stay clear of — dart fastener
  // columns, strut fastener columns, and frame-mount slots. Collected as we build each
  // feature, then used once (Panel seams, below) to phase the seam grid away from all of
  // them at once, since a seam that dodges a dart column but lands on a strut is not
  // fixed, just moved.
  const dangerXs: number[] = [];

  // ── Hem ────────────────────────────────────────────────────────────────────
  if (g.hem > 0) {
    const hemT = (x: number) => yFreeT(x) + g.hem;
    const hemB = (x: number) => yFreeB(x) - g.hem;
    scoreLines.push({
      d: `M ${foldXs.map((x) => `${f1(x)},${f1(hemT(x))}`).join(' L ')}`
    });
    scoreLines.push({
      d: `M ${foldXs.map((x) => `${f1(x)},${f1(hemB(x))}`).join(' L ')}`
    });
    extraLabels.push({
      x: f1(g.L * 0.5),
      y: f1(hemT(g.L * 0.5) - 2),
      size: 4.5,
      fill: 'var(--draw-fold)',
      anchor: 'middle',
      text: `HEM ${f0(g.hem)} MM: FOLD BACK 180°`
    });
  }

  // ── Dart fastenings (WP23 §23.3/§23.6) ──────────────────────────────────────
  // The dart is a plain slit now (`g.notch` is always 0) with `g.lap` of shingled
  // overlap absorbed instead of cut away. `cinch` fastens outside that band, exactly
  // like the old butt-seam tie, just with real overlap under it. `rivet`/`zip`/`slot`
  // pass THROUGH the band, so their holes sit on a slanted column (§23.6): the band is
  // a triangle, `lap` wide at the free edge and converging to zero at the fold, so a
  // hole placed at a fixed absolute depth from the free edge needs a flat-pattern
  // offset that varies with that depth for the two layers to land on the same point
  // once assembled.
  for (let i = 1; i < g.n; i++) {
    const xc = i * g.pitch;

    if (s.join === 'none') {
      // Nothing pierced. One tie runs round the girth in a scored channel instead.
      scoreLines.push({
        d: `M ${f1(xc)},${f1(yFreeT(xc))} L ${f1(xc)},${f1(yFreeB(xc))}`
      });
      continue;
    }

    if (s.join === 'cinch') {
      // Outside the lap band by design (§23.3) — the tie never passes through the
      // overlap, so it needs almost no lap at all, just the same clearance the old
      // butt-seam columns kept off their own centreline.
      const off = g.lap / 2 + 6;
      for (const dir of [-1, 1]) {
        const x = xc + dir * off;
        dangerXs.push(x);
        holes.push(
          { cx: f1(x), cy: f1(yFreeT(x) + g.skirt * 0.5), r: 2 },
          { cx: f1(x), cy: f1(yFreeB(x) - g.skirt * 0.5), r: 2 }
        );
      }
      continue;
    }

    if (s.join === 'slot') {
      // The punched tongue (§23.5, decision C6): a U-shaped release cut in the
      // upstream panel (segment i, the one already on top per the shingle direction —
      // "forward panel on top", same rule the panel seams use), freeing a tongue
      // hinged at its inboard edge, passing through a slot in the downstream panel
      // (segment i+1) beneath it. One pair per skirt (top, bottom).
      const tw = 8;
      const reach = Math.max(2, Math.min(14, g.skirt * 0.45));
      const d0 = 2;
      const xTongue = xc - g.lap / 4;
      const xSlot = xc + g.lap / 4;
      dangerXs.push(xTongue, xSlot);

      for (const top of [true, false]) {
        const free = top ? yFreeT : yFreeB;
        const dirIn = top ? 1 : -1;
        const yNear = (x: number) => free(x) + dirIn * d0;
        const yFar = (x: number) => free(x) + dirIn * (d0 + reach);

        const yA = yNear(xTongue);
        const yB = yFar(xTongue);
        // A separate release-cut subpath, not part of the dart slit — left open at
        // the hinge (the fold-ward edge) so the tongue folds flat rather than
        // detaching.
        outline +=
          ` M ${f1(xTongue - tw / 2)},${f1(yA)}` +
          ` L ${f1(xTongue - tw / 2)},${f1(yB)}` +
          ` L ${f1(xTongue + tw / 2)},${f1(yB)}` +
          ` L ${f1(xTongue + tw / 2)},${f1(yA)}`;
        scoreLines.push({
          d: `M ${f1(xTongue - tw / 2)},${f1(yA)} L ${f1(xTongue + tw / 2)},${f1(yA)}`
        });

        const sy0 = yNear(xSlot);
        const sy1 = yFar(xSlot);
        slots.push({
          x: f1(xSlot - tw / 2),
          y: f1(Math.min(sy0, sy1)),
          w: tw,
          h: f1(Math.abs(sy1 - sy0))
        });
      }
      continue;
    }

    // rivet, zip — through the lap, slanted per §23.6.
    const depths = s.join === 'zip' ? [3.5, 8.5] : [4.5];
    const r = s.join === 'zip' ? 2 : 1.6;
    dangerXs.push(xc - g.lap / 2, xc + g.lap / 2);
    for (const d of depths) {
      const t = g.skirt > 0 ? d / g.skirt : 0;
      for (const dir of [-1, 1]) {
        const x = xc + dir * t * (g.lap / 2);
        holes.push(
          { cx: f1(x), cy: f1(yFreeT(x) + g.skirt * t), r },
          { cx: f1(x), cy: f1(yFreeB(x) - g.skirt * t), r }
        );
      }
    }
  }

  // ── Frame mounts ───────────────────────────────────────────────────────────
  // Slots, not holes, on the crown centreline — no two frames put their bridges the
  // same distance apart, so the fender has to slide to take up the difference.
  const xTDC = (s.lead / Math.max(1, g.cov)) * g.L;
  const mounts =
    s.side === 'front'
      ? [{ x: xTDC, label: 'FORK CROWN' }]
      : [
          { x: Math.min(xTDC * 0.4, g.L - 40), label: 'CHAINSTAY BRIDGE' },
          { x: xTDC, label: 'SEATSTAY BRIDGE' }
        ];

  for (const m of mounts) {
    dangerXs.push(m.x - 8, m.x + 8);
    slots.push({ x: f1(m.x - 8), y: f1(g.yc - 2.5), w: 16, h: 5 });
    extraLabels.push({
      x: f1(m.x),
      y: f1(g.yc - 8),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: m.label
    });
  }

  // ── Struts ─────────────────────────────────────────────────────────────────
  // Fastened at the skirt edge, never the crown: every hole is a crack initiator and
  // the crown is where water sits.
  const strutFrac: number[] = [];
  const inset = Math.max(5, Math.min(7, g.skirt * 0.22));
  const span: [number, number] = s.side === 'front' ? [0.5, 0.95] : [0.5, 0.96];

  for (let i = 0; i < s.struts; i++) {
    const fr =
      s.struts === 1
        ? (span[0] + span[1]) / 2
        : span[0] + ((span[1] - span[0]) * i) / (s.struts - 1);
    strutFrac.push(fr);
    const x = g.L * fr;
    dangerXs.push(x - 5, x + 5);
    holes.push(
      { cx: f1(x - 5), cy: f1(yFreeT(x) + inset), r: 2.5 },
      { cx: f1(x + 5), cy: f1(yFreeT(x) + inset), r: 2.5 }
    );
    holes.push(
      { cx: f1(x - 5), cy: f1(yFreeB(x) - inset), r: 2.5 },
      { cx: f1(x + 5), cy: f1(yFreeB(x) - inset), r: 2.5 }
    );
  }

  if (s.mudflap > 0) {
    dangerXs.push(g.L - 10);
    for (const k of [-0.3, 0, 0.3]) {
      holes.push({ cx: f1(g.L - 10), cy: f1(g.yc + g.crownTail * k), r: 2 });
    }
  }

  if (s.tongue) slots.push({ x: f1(-TONGUE_L + 6), y: f1(g.yc - 2.5), w: 16, h: 5 });

  // ── Panel seams ────────────────────────────────────────────────────────────
  // WP19 §19.1 (decision B1): one printed A4 tile IS one material panel now, so a panel
  // is exactly one `PW`-wide tile window, and the next panel's window starts `LAP` mm
  // before this one ends — that shared band is both the tile's own registration overlap
  // and the panel's fastening lap, not two numbers for two purposes. Panel 1's window
  // starts at the tongue (`x = -TONGUE_L` when there is one), so "cut extent, tongue
  // included, fits PW" holds by construction (§19.2) rather than needing its own margin
  // constant. Lap direction matters more than fastener choice: forward panel on top —
  // panel `i` (smaller x, upstream) is the top layer and panel `i + 1` (downstream) goes
  // under it.
  const stepX = PW - LAP;
  const totalW = g.L + (s.tongue ? TONGUE_L : 0);
  let panelCount = 1;
  if (s.stock === 'a4') {
    panelCount = totalW <= PW ? 1 : 1 + Math.ceil((totalW - PW) / stepX);
    const tongueOff = s.tongue ? TONGUE_L : 0;

    // §19.3/§19.4 — place every seam left to right, dodging dart/strut/mount columns
    // as it goes (see `placeSeams`'s doc comment for why this is safe against §19.2's
    // per-panel and last-panel invariants without re-checking them after the fact).
    const placed = placeSeams(panelCount, stepX, -tongueOff, totalW, dangerXs);

    for (let i = 1; i < panelCount; i++) {
      const x = placed[i - 1]!;
      seams.push({
        d: `M ${f1(x)},${f1(yFreeT(x) - 5)} L ${f1(x)},${f1(yFreeB(x) + 5)}`
      });
      lapLines.push({
        d:
          `M ${f1(x + LAP)},${f1(yFreeT(x + LAP) - 5)}` +
          ` L ${f1(x + LAP)},${f1(yFreeB(x + LAP) + 5)}`
      });

      const xm = x + LAP / 2;
      // WP23 §23.3 — a plain fastener row through both panel layers, same for every
      // join: the panel lap is a separate joint from the dart lap, so it never grew a
      // tongue-and-slot of its own, and the old `slot` join's clip (removed with it,
      // see parts.ts) was the only reason this used to cut slots here instead of holes.
      const rowN = Math.max(3, Math.floor(g.Wd / 30));
      for (let j = 0; j <= rowN; j++) {
        const y = yFreeT(xm) + 7 + ((yFreeB(xm) - yFreeT(xm) - 14) * j) / rowN;
        holes.push({
          cx: f1(xm),
          cy: f1(y),
          r: s.join === 'rivet' ? 1.6 : 2
        });
      }

      extraLabels.push({
        x: f1(xm),
        y: f1(yFreeT(xm) - 9),
        size: 4.5,
        fill: 'var(--draw-seam)',
        anchor: 'middle',
        text: `SEAM ${i}: CUT PANEL ${i} TO HERE +${LAP} MM LAP`
      });

      // WP19 §19.5 — "over/under" used to describe the drawing plane, not the built
      // part. Restated in built terms: the upstream panel sits on the wheel side once
      // assembled, so water crossing the joint runs over it rather than into the seam.
      extraLabels.push({
        x: f1(xm),
        y: f1(yFreeB(xm) + 9),
        size: 4.5,
        fill: 'var(--draw-seam)',
        anchor: 'middle',
        text: `PANEL ${i}: WHEEL SIDE OF THE JOINT, WATER RUNS OVER IT`
      });
      const arrowY = g.yc + 8;
      const arrowHalf = 6;
      const head = 2.5;
      const ax0 = xm - arrowHalf;
      const ax1 = xm + arrowHalf;
      lapArrows.push({
        d:
          `M ${f1(ax0)},${f1(arrowY)} L ${f1(ax1)},${f1(arrowY)}` +
          ` M ${f1(ax1 - head)},${f1(arrowY - head)} L ${f1(ax1)},${f1(arrowY)} L ${f1(ax1 - head)},${f1(arrowY + head)}`
      });
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────────
  const labels: Label[] = [
    {
      x: f1(g.L / 2),
      y: f1(g.yc - 3),
      size: 5,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: `CENTRELINE, BLANK ${f0(g.L)} × ${f0(g.Wd)} mm, ${g.n} FLAPS`
    },
    {
      x: 4,
      y: f1(yFoldT(0) - 3),
      size: 4.5,
      fill: 'var(--draw-fold)',
      anchor: 'start',
      text: 'FOLD / SCORE'
    },
    {
      x: 4,
      y: f1(yFoldB(0) + 7),
      size: 4.5,
      fill: 'var(--draw-fold)',
      anchor: 'start',
      text: 'FOLD / SCORE'
    },
    {
      x: f1(g.L - 4),
      y: f1(g.yc - 6),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'end',
      text: s.mudflap > 0 ? 'TAIL, MUDFLAP' : 'TAIL'
    }
  ];

  if (s.tongue) {
    labels.push({
      x: f1(-TONGUE_L + 2),
      y: f1(g.yc - 8),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'start',
      text: s.side === 'front' ? 'TONGUE, FORK ARCH' : 'TONGUE, CHAINSTAY BRIDGE'
    });
  }

  if (kneeInRange) {
    labels.push({
      x: f1(g.knee),
      y: f1(yFreeT(g.knee) - 5),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: `TAPER ${s.taper}%`
    });
  }

  labels.push(...extraLabels);

  // ── Frame ──────────────────────────────────────────────────────────────────
  const bboxW = g.L + (s.tongue ? TONGUE_L : 0);
  const bboxH = g.Wd;
  const x0 = (s.tongue ? -TONGUE_L : 0) - 6;
  const viewBox =
    `${f1(x0 - VIEW_MARGIN)} ${f1(-VIEW_MARGIN)}` +
    ` ${f1(bboxW + VIEW_MARGIN * 2 + 12)} ${f1(bboxH + VIEW_MARGIN * 2)}`;

  return {
    outline,
    foldLines,
    scoreLines,
    holes,
    slots,
    seams,
    lapLines,
    lapArrows,
    labels,
    panelCount,
    strutFrac,
    viewBox,
    bboxW,
    bboxH
  };
}
