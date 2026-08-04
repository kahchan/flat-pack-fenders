import { LAP, PW, TONGUE_L, TONGUE_W, f0, f1, tileOriginX } from './defaults';
import { buildAssembly, mergedDartAt } from './assembly';
import { develop, flatY } from './develop';
import { crownAt, geo } from './geometry';
import type { BlankModel, FenderConfig, Geometry, Hole, Label, Path, Slot } from './types';

/** Margin around the blank in the on-screen viewBox, mm. */
const VIEW_MARGIN = 22;

interface Event {
  x: number;
  dart?: boolean;
}

/** Edge-to-edge clearance a seam's fastener column should keep from any other feature
 * column (dart fasteners, strut fasteners, frame mounts) — WP19 §19.3/§19.4's original
 * "clear window" rule, kept as the target `nudgeAway` (below) pushes struts and mounts
 * to clear now that seams no longer move to dodge them (WP27 §27.2, decision C10).
 * Matches the 6 mm buffer the dart columns themselves already use off their own
 * centreline (`cinch`'s `off = lap/2 + 6`, below). */
export const SEAM_CLEAR = 6;

/**
 * WP27 §27.2 (decision C10): a seam is always exactly at its tile boundary now — no
 * search, no drift. `placeSeams` (round 3, WP19 §19.3/§19.4) let each seam slide up to
 * 40 mm earlier than its nominal grid position to dodge dart/strut/mount columns, which
 * silently broke the WP19 B1 invariant it was built next to ("one printed tile IS one
 * material panel"): a seam that moved was no longer where the page said it was. Deleted
 * outright rather than patched — the fix is to move whatever CAN move (struts, mounts;
 * `nudgeAway` below) and merge with whatever can't (a dart; `mergedDartAt` in
 * `assembly.ts`), not to keep searching for a seam position that dodges everything.
 *
 * `panelCount` is windows of `stepX` covering the blank measured from `tileOriginX` —
 * the SAME origin `tiling.ts` tiles from, so a seam's own grid and the print grid are
 * one grid, not two that happen to agree. Sized so the trailing panel's real cut extent
 * (from the last seam to the tail, no lap on that end) never exceeds `PW`: window `i`
 * covers `[x0 + i·stepX, x0 + i·stepX + PW]`, and `panelCount` is the smallest count
 * whose last window's far edge reaches `g.L` — so `g.L − (x0 + (panelCount−1)·stepX) ≤
 * PW` by construction, not by a banked-slack budget re-checked after the fact.
 */
function seamGrid(g: Geometry, x0: number, stepX: number): { panelCount: number; seamXs: number[] } {
  const reach = g.L - x0;
  const panelCount = reach <= PW ? 1 : 1 + Math.ceil((reach - PW) / stepX);
  const seamXs: number[] = [];
  for (let i = 1; i < panelCount; i++) seamXs.push(x0 + i * stepX);
  return { panelCount, seamXs };
}

/**
 * WP27 §27.2: with seams pinned, whatever still needs to dodge one has to move itself —
 * struts (their `span` fraction) and frame mounts (their placement along the crown) both
 * have real freedom, unlike a seam (now fixed to the page grid) or a dart (evenly spaced
 * by construction, see `mergedDartAt`). Pushes `x` directly away from any seam column
 * inside `clear` mm, clamped to `[min, max]` so the nudge never leaves the feature's own
 * legal range (a strut's span, a mount's reach along the crown).
 */
function nudgeAway(x: number, seamXs: number[], clear: number, min: number, max: number): number {
  for (const xm of seamXs) {
    const d = x - xm;
    if (Math.abs(d) < clear) {
      const dir = d >= 0 ? 1 : -1;
      x = Math.max(min, Math.min(max, xm + dir * clear));
    }
  }
  return x;
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

  // ── Panel-seam grid (WP27 §27.2, decision C10) ──────────────────────────────
  // Computed up front, before anything that might need to dodge it, because it no
  // longer moves: `x0` is the SAME origin `tiling.ts` tiles from, so a seam and the
  // print-tile boundary it belongs to are one grid now, not two that happened to agree.
  const x0 = tileOriginX(s);
  const stepX = PW - LAP;
  const { panelCount, seamXs } = s.stock === 'a4' ? seamGrid(g, x0, stepX) : { panelCount: 1, seamXs: [] as number[] };
  // The fastener row sits at the lap's own centre, not the cut line — everything that
  // has to know where a seam actually clamps down (the merge check, the strut/mount
  // nudge) works in this, not `seamXs`.
  const seamXms = seamXs.map((x) => x + LAP / 2);
  // WP27 §27.2, point 2: darts can't move, so where a seam column lands on one, the
  // dart's own fastener has to serve both jobs instead of drawing two holes a few mm
  // apart. Decided once here, up front, so `buildAssembly` can size that hole for four
  // thicknesses and the seam loop (below) knows to skip its own row there.
  const mergedDarts = new Set<number>();
  for (const xm of seamXms) {
    const k = mergedDartAt(s, g, xm);
    if (k !== null) mergedDarts.add(k);
  }

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

  // ── Dart fastenings (WP29 §29.3, decisions D1/D2) ───────────────────────────
  // Nothing here decides WHERE a fastener goes. Every dart feature is declared once on
  // the assembled fender (`assembly.ts`) and unrolled onto each panel it pierces
  // (`develop.ts`); this loop only draws what comes back. That is the whole correction
  // from round 4 §9.35 — the flat position and the preview position are now the same
  // number seen twice, so they cannot disagree the way they did when each was written
  // out by hand.
  const flat = develop(g, buildAssembly(s, g, mergedDarts));

  for (const ff of flat) {
    if (ff.kind === 'score') {
      // The girth channel: crosses crown and both skirts in one line, pierces nothing.
      // Emitted once (the top-side instance) rather than per skirt.
      if (ff.side !== 0) continue;
      scoreLines.push({
        d: `M ${f1(ff.x)},${f1(yFreeT(ff.x))} L ${f1(ff.x)},${f1(yFreeB(ff.x))}`
      });
      continue;
    }

    if (ff.kind === 'hole') {
      holes.push({ cx: f1(ff.x), cy: f1(ff.y), r: ff.r ?? 2 });
      continue;
    }

    // Tongue and slot: one assembled feature, so the released tongue on the outer panel
    // and the slot it passes through on the panel beneath are guaranteed to meet. Both
    // are cut as trapezoids — the overlap narrows toward the fold, so the near and far
    // ends genuinely do not share an x (`xFar`).
    const tw = ff.w ?? 8;
    const reach = ff.reach ?? 0;
    const xNear = ff.x;
    const xFar = ff.xFar ?? ff.x;
    const yNear = ff.y;
    const yFar = flatY(g, xFar, ff.depth + reach, ff.side);

    if (ff.kind === 'tongueCut') {
      // A separate release-cut subpath, not part of the dart slit — left open at the
      // hinge (the fold-ward edge) so the tongue folds flat rather than detaching.
      outline +=
        ` M ${f1(xNear - tw / 2)},${f1(yNear)}` +
        ` L ${f1(xFar - tw / 2)},${f1(yFar)}` +
        ` L ${f1(xFar + tw / 2)},${f1(yFar)}` +
        ` L ${f1(xNear + tw / 2)},${f1(yNear)}`;
      scoreLines.push({
        d: `M ${f1(xNear - tw / 2)},${f1(yNear)} L ${f1(xNear + tw / 2)},${f1(yNear)}`
      });
    } else {
      slots.push({
        x: f1(Math.min(xNear, xFar) - tw / 2),
        y: f1(Math.min(yNear, yFar)),
        w: f1(tw + Math.abs(xFar - xNear)),
        h: f1(Math.abs(yFar - yNear))
      });
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

  // WP33 §9.40 — the post-nudge x is the only place this fact should exist. `notes.ts`
  // used to recompute the pre-nudge `mounts` x itself (mirroring the maths above) so its
  // assembly-steps copy could drift up to 15 mm from the slot actually cut. Recording the
  // resolved x here, on the model, means notes.ts reads the same number the slot used.
  const mountPositions: { x: number; label: string }[] = [];

  for (const m of mounts) {
    // WP27 §27.2 — a mount has real freedom along the crown (no two frames put their
    // bridges the same distance apart anyway, per the comment above), so it is the one
    // that moves when a seam lands on it, not the other way round. Bounded to ±15 mm of
    // its intended position so the slot still lands close enough to the real bridge.
    const mx = nudgeAway(m.x, seamXms, SEAM_CLEAR + 8, m.x - 15, m.x + 15);
    slots.push({ x: f1(mx - 8), y: f1(g.yc - 2.5), w: 16, h: 5 });
    extraLabels.push({
      x: f1(mx),
      y: f1(g.yc - 8),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: m.label
    });
    mountPositions.push({ x: mx, label: m.label });
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
    // WP27 §27.2 — a strut has real freedom too: its own `span` fraction, not a fixed
    // point, so it is the one that yields to a seam rather than the seam searching for
    // a gap. Bounded to the same `span` window every strut is placed within. Pushed
    // AFTER nudging — `strutFrac` is what `isometric.ts` and `warnings.ts` place the
    // strut from, so it has to be where the hole actually ended up, not the pre-nudge
    // intent, or the preview would draw a strut the flat pattern doesn't agree with
    // (the exact class of bug WP29 fixed for dart fasteners).
    const x = nudgeAway(g.L * fr, seamXms, SEAM_CLEAR + 8, g.L * span[0], g.L * span[1]);
    strutFrac.push(x / g.L);
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
  //
  // WP27 §27.2 (decision C10): `x`/`xm` come straight from `seamXs`/`seamXms`, computed
  // once at the top of this function — no search, no drift. A seam is always exactly at
  // its tile boundary.
  for (let i = 1; i < panelCount; i++) {
    const x = seamXs[i - 1]!;
    const xm = seamXms[i - 1]!;
    seams.push({
      d: `M ${f1(x)},${f1(yFreeT(x) - 5)} L ${f1(x)},${f1(yFreeB(x) + 5)}`
    });
    lapLines.push({
      d:
        `M ${f1(x + LAP)},${f1(yFreeT(x + LAP) - 5)}` +
        ` L ${f1(x + LAP)},${f1(yFreeB(x + LAP) + 5)}`
    });

    // WP27 §27.2, point 2 — where this seam coincides with a dart, the dart's own
    // fastener (bumped for four thicknesses in `assembly.ts`) closes the lap and the
    // dart together, and drilling this row too would put two hole columns a few mm
    // apart instead of one. Otherwise, a plain fastener row through both panel layers,
    // same for every join: the panel lap is a separate joint from the dart lap, so it
    // never grew a tongue-and-slot of its own, and the old `slot` join's clip (removed
    // with it, see parts.ts) was the only reason this used to cut slots here instead of
    // holes.
    const mergedDart = mergedDartAt(s, g, xm);
    if (mergedDart === null) {
      const rowN = Math.max(3, Math.floor(g.Wd / 30));
      for (let j = 0; j <= rowN; j++) {
        const y = yFreeT(xm) + 7 + ((yFreeB(xm) - yFreeT(xm) - 14) * j) / rowN;
        holes.push({
          cx: f1(xm),
          cy: f1(y),
          r: s.join === 'rivet' ? 1.6 : 2
        });
      }
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
      text:
        mergedDart === null
          ? `PANEL ${i}: WHEEL SIDE OF THE JOINT, WATER RUNS OVER IT`
          : `PANEL ${i}: FOUR-LAYER CORNER AT DART ${mergedDart} — ITS FASTENER CLOSES THIS SEAM TOO`
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
    mounts: mountPositions,
    viewBox,
    bboxW,
    bboxH
  };
}
