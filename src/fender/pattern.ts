import { OVERLAP, TONGUE_L, TONGUE_W, f0, f1 } from './defaults';
import { crownAt, geo } from './geometry';
import type { BlankModel, FenderConfig, Geometry, Hole, Label, Path, Slot } from './types';

/** Margin around the blank in the on-screen viewBox, mm. */
const VIEW_MARGIN = 22;

interface Event {
  x: number;
  dart?: boolean;
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

  const edge = (isTop: boolean): [number, number][] => {
    const free = isTop ? yFreeT : yFreeB;
    const fold = isTop ? yFoldT : yFoldB;
    const pts: [number, number][] = [];
    for (const e of events) {
      if (e.dart) {
        pts.push([e.x - g.notch / 2, free(e.x)], [e.x, fold(e.x)], [e.x + g.notch / 2, free(e.x)]);
      } else {
        pts.push([e.x, free(e.x)]);
      }
    }
    return pts;
  };

  const seg = (pts: [number, number][]) => pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ');

  let outline = `M ${seg(edge(true))} L ${seg(edge(false).reverse())}`;
  if (s.tongue) {
    outline +=
      ` L 0,${f1(g.yc + TONGUE_W / 2)}` +
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
  const extraLabels: Label[] = [];

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
      text: `HEM ${f0(g.hem)} MM — FOLD BACK 180°`
    });
  }

  // ── Dart fastenings ────────────────────────────────────────────────────────
  const off = g.notch / 2 + 6;
  for (let i = 1; i < g.n; i++) {
    const xc = i * g.pitch;

    if (s.join === 'none') {
      // Nothing pierced. One tie runs round the girth in a scored channel instead.
      scoreLines.push({
        d: `M ${f1(xc)},${f1(yFreeT(xc))} L ${f1(xc)},${f1(yFreeB(xc))}`
      });
      continue;
    }

    for (const dir of [-1, 1]) {
      const x = xc + dir * off;
      const tT = (t: number) => yFreeT(x) + g.skirt * t;
      const tB = (t: number) => yFreeB(x) - g.skirt * t;

      if (s.join === 'zip') {
        for (const t of [0.3, 0.78]) {
          holes.push({ cx: f1(x), cy: f1(tT(t)), r: 2 }, { cx: f1(x), cy: f1(tB(t)), r: 2 });
        }
      } else if (s.join === 'rivet') {
        for (const t of [0.4, 0.78]) {
          holes.push({ cx: f1(x), cy: f1(tT(t)), r: 1.6 }, { cx: f1(x), cy: f1(tB(t)), r: 1.6 });
        }
      } else {
        const h = Math.min(12, g.skirt * 0.5);
        slots.push(
          { x: f1(x - 1.5), y: f1(tT(0.28)), w: 3, h: f1(h) },
          { x: f1(x - 1.5), y: f1(tB(0.28) - h), w: 3, h: f1(h) }
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
  // Butting two panels edge to edge leaves nothing to fasten. Each panel is cut OVERLAP
  // past its seam and laps UNDER the next, so one row of fasteners passes through both
  // layers. Lap direction matters more than fastener choice: forward panel on top.
  let panelCount = 1;
  if (s.stock === 'a4') {
    panelCount = Math.max(1, Math.ceil(g.L / 250));
    const panelL = g.L / panelCount;

    for (let i = 1; i < panelCount; i++) {
      const x = i * panelL;
      seams.push({
        d: `M ${f1(x)},${f1(yFreeT(x) - 5)} L ${f1(x)},${f1(yFreeB(x) + 5)}`
      });
      lapLines.push({
        d:
          `M ${f1(x + OVERLAP)},${f1(yFreeT(x + OVERLAP) - 5)}` +
          ` L ${f1(x + OVERLAP)},${f1(yFreeB(x + OVERLAP) + 5)}`
      });

      const xm = x + OVERLAP / 2;
      const rowN = Math.max(3, Math.floor(g.Wd / 30));
      for (let j = 0; j <= rowN; j++) {
        const y = yFreeT(xm) + 7 + ((yFreeB(xm) - yFreeT(xm) - 14) * j) / rowN;
        if (s.join === 'slot') slots.push({ x: f1(xm - 1.5), y: f1(y - 6), w: 3, h: 12 });
        else
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
        text: `SEAM ${i} — CUT PANEL ${i} TO HERE +${OVERLAP} MM LAP`
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
      text: `CENTRELINE · BLANK ${f0(g.L)} × ${f0(g.Wd)} mm · ${g.n} FLAPS`
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
      text: s.mudflap > 0 ? 'TAIL · MUDFLAP' : 'TAIL'
    }
  ];

  if (s.tongue) {
    labels.push({
      x: f1(-TONGUE_L + 2),
      y: f1(g.yc - 8),
      size: 4.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'start',
      text: s.side === 'front' ? 'TONGUE · FORK ARCH' : 'TONGUE · CHAINSTAY BRIDGE'
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
  const bboxH = s.nest ? g.Wd * 2 + 10 : g.Wd;
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
    labels,
    panelCount,
    strutFrac,
    viewBox,
    bboxW,
    bboxH
  };
}
