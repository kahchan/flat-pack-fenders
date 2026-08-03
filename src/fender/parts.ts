import {
  PARTS_PH,
  PW,
  STRUT_FOLD_INSET,
  STRUT_STRAP_PADDLE_L,
  STRUT_STRAP_PADDLE_W,
  STRUT_STRAP_SLOT_GAP,
  STRUT_STRAP_SLOT_L,
  STRUT_STRAP_SLOT_W,
  STRUT_STRAP_TRANS_L,
  STRUT_W,
  f0,
  f1
} from './defaults';
import { geo } from './geometry';
import { packRects, type PackRect } from './packer';
import type { FenderConfig, Geometry, Hole, Label, PackedPart, PartsModel, PartsPage, Path, Slot, StrutEndKey } from './types';

/** Vertical room reserved below each packed part for its own label (PLAN §12). The
 * continuous layout (below, unchanged) puts labels to the *right* of each part because
 * it has a whole column of empty width to spare; the packed layout puts them *below*
 * instead, because two parts can sit side by side on the same page and a label to the
 * right would run straight into the neighbour. */
const LABEL_ROW_H = 8;

/** One part's LOCAL geometry — as if it sat unrotated at its own origin (0,0) — plus
 * the natural (pre-rotation, pre-label-margin) size the packer rotates. */
interface LocalPart {
  id: string;
  outline: Path;
  folds: Path[];
  holes: Hole[];
  slots: Slot[];
  label: Label;
  /** Natural width/height of the part itself, excluding the label margin. */
  w: number;
  h: number;
}

/** Strap-end paddle (PLAN FEEDBACK WP21 §21.1): vertical offset of the strut's own
 * centreline within the part's bounding box, and the box's total height. Zero/`STRUT_W`
 * for a bolt end, unchanged from before WP21. */
function strutEndGeometry(strutEnd: StrutEndKey) {
  const r = STRUT_W / 2;
  const strap = strutEnd === 'strap';
  const halfPaddle = STRUT_STRAP_PADDLE_W / 2;
  const offset = strap ? halfPaddle - r : 0;
  return { strap, r, offset, cy: r + offset, h: strap ? STRUT_STRAP_PADDLE_W : STRUT_W };
}

function localStrut(index: number, len: number, strutEnd: StrutEndKey): LocalPart {
  const { strap, r, offset, cy, h } = strutEndGeometry(strutEnd);
  const xTrans = len - STRUT_STRAP_TRANS_L - STRUT_STRAP_PADDLE_L;
  const xPaddle = len - STRUT_STRAP_PADDLE_L;

  const outline: Path = strap
    ? {
        d:
          `M ${f1(r)},${f1(offset)} h ${f1(xTrans - r)}` +
          ` L ${f1(xPaddle)},0` +
          ` L ${f1(len)},0` +
          ` L ${f1(len)},${f1(h)}` +
          ` L ${f1(xPaddle)},${f1(h)}` +
          ` L ${f1(xTrans)},${f1(offset + STRUT_W)}` +
          ` h ${f1(-(xTrans - r))}` +
          ` a ${r} ${r} 0 0 1 0 ${f1(-STRUT_W)} Z`
      }
    : {
        d:
          `M ${r},0 h ${f1(len - STRUT_W)}` +
          ` a ${r} ${r} 0 0 1 0 ${STRUT_W}` +
          ` h ${f1(-(len - STRUT_W))}` +
          ` a ${r} ${r} 0 0 1 0 ${-STRUT_W} Z`
      };
  // The far-end fold still sits `STRUT_FOLD_INSET` mm in from the tip, same as a bolt
  // end — it now falls inside the flare, so it's drawn spanning the full local height
  // there rather than just the strip's `STRUT_W`.
  const folds: Path[] = strap
    ? [
        {
          d: `M ${STRUT_FOLD_INSET},${f1(offset)} v ${STRUT_W}` + ` M ${f1(len - STRUT_FOLD_INSET)},0 v ${f1(h)}`
        }
      ]
    : [
        {
          d: `M ${STRUT_FOLD_INSET},0 v ${STRUT_W}` + ` M ${f1(len - STRUT_FOLD_INSET)},0 v ${STRUT_W}`
        }
      ];
  const holes: Hole[] = [
    { cx: f0(12), cy: f1(cy), r: 2.5 },
    { cx: f1(len / 2), cy: f1(cy), r: 2 }
  ];
  if (!strap) {
    holes.push({ cx: f1(len - 12), cy: f1(cy), r: 2.5 }, { cx: f1(len - 22), cy: f1(cy), r: 2.5 });
  }
  // Two slots, symmetrically margined within the flat paddle zone (`xPaddle`..`len`),
  // `STRUT_STRAP_SLOT_GAP` mm apart centre to centre.
  const slotMargin = (STRUT_STRAP_PADDLE_L - STRUT_STRAP_SLOT_GAP) / 2;
  const slots: Slot[] = strap
    ? [xPaddle + slotMargin, xPaddle + slotMargin + STRUT_STRAP_SLOT_GAP].map((scx) => ({
        x: f1(scx - STRUT_STRAP_SLOT_W / 2),
        y: f1(cy - STRUT_STRAP_SLOT_L / 2),
        w: STRUT_STRAP_SLOT_W,
        h: STRUT_STRAP_SLOT_L
      }))
    : [];
  const label: Label = {
    x: 0,
    y: f1(h + 5),
    size: 5,
    anchor: 'start',
    text: `STRUT ${index + 1}, ${f0(len)} × ${STRUT_W}${strap ? ', STRAP END' : ''}`
  };
  return { id: `strut-${index}`, outline, folds, holes, slots, label, w: len, h };
}

function localMudflap(w: number, h: number): LocalPart {
  const rr = Math.min(18, w / 3);
  const outline: Path = {
    d:
      `M 0,0 h ${f1(w)} v ${f1(h - rr)}` +
      ` q 0,${f1(rr)} ${f1(-rr)},${f1(rr)}` +
      ` h ${f1(-(w - 2 * rr))}` +
      ` q ${f1(-rr)},0 ${f1(-rr)},${f1(-rr)} Z`
  };
  const folds: Path[] = [{ d: `M 0,16 h ${f1(w)}` }];
  const holes: Hole[] = [-0.3, 0, 0.3].map((k) => ({ cx: f1(w / 2 + w * k), cy: f1(8), r: 2 }));
  const label: Label = {
    x: 0,
    y: f1(h + 5),
    size: 5,
    anchor: 'start',
    text: `MUDFLAP, ${f0(w)} × ${f0(h)} mm, lap 16 mm under the tail`
  };
  return { id: 'mudflap', outline, folds, holes, slots: [], label, w, h };
}

function localExtra(index: number, join: 'rivet' | 'slot', labelText: string | null): LocalPart {
  const w = 34;
  const h = 14;
  const outline: Path = { d: `M 0,0 h ${w} v ${h} h ${-w} Z` };
  const holes: Hole[] = [];
  const folds: Path[] = [];
  if (join === 'rivet') {
    for (const cx of [8, 26]) {
      for (const cy of [4.5, 9.5]) holes.push({ cx: f1(cx), cy: f1(cy), r: 1.6 });
    }
  } else {
    folds.push({ d: `M 6,0 v ${h} M 28,0 v ${h}` });
  }
  const label: Label = { x: 0, y: f1(h + 5), size: 5, anchor: 'start', text: labelText ?? '' };
  return { id: `extra-${index}`, outline, folds, holes, slots: [], label, w, h };
}

/**
 * `translate`/`rotate` for one packed part's `<g>` wrapper. Rotation is counter-
 * clockwise (`rotate(-90)`) so a rotated label reads bottom-to-top, never upside down
 * (PLAN §12) — derived so the rotated part's bounding box still lands at exactly
 * `(x, y)`, `h` wide × `w` tall: `rotate(-90)` maps local `(0,0)-(w,h)` to
 * `(0,0)-(h,-w)`, so translating by `(x, y + w)` slides that box to `(x,y)-(x+h,y+w)`.
 */
export function packedPartTransform(part: Pick<PackedPart, 'x' | 'y' | 'w' | 'rotated'>): string {
  return part.rotated ? `translate(${f1(part.x)},${f1(part.y + part.w)}) rotate(-90)` : `translate(${f1(part.x)},${f1(part.y)})`;
}

function packParts(locals: LocalPart[]): PartsPage[] {
  const byId = new Map(locals.map((p) => [p.id, p]));
  const rects: PackRect[] = locals.map((p) => ({ id: p.id, w: p.w, h: p.h + LABEL_ROW_H }));
  const placed = packRects(rects, PW, PARTS_PH);

  const pageCount = placed.reduce((max, p) => Math.max(max, p.page + 1), 0);
  const pages: PartsPage[] = Array.from({ length: pageCount }, () => ({ parts: [], width: PW, height: PARTS_PH }));

  for (const p of placed) {
    const local = byId.get(p.id)!;
    // `w`/`h` are the padded unit's natural (pre-rotation) size — geometry + label row —
    // which is what both the rotation transform pivots around and what a caller needs to
    // know the part's real reserved footprint for overlap/bounds checks.
    pages[p.page]!.parts.push({
      outline: local.outline,
      folds: local.folds,
      holes: local.holes,
      slots: local.slots,
      label: local.label,
      x: p.x,
      y: p.y,
      w: local.w,
      h: local.h + LABEL_ROW_H,
      rotated: p.rotated
    });
  }

  return pages;
}

/**
 * Sheet B — struts, mudflap, butt straps / clips.
 *
 * Layout order is preserved from the design source: struts first, then the mudflap,
 * then the join hardware (butt straps or slot-and-tab clips), stacked top to bottom.
 * `slots` holds the strap-end strut slots (PLAN FEEDBACK WP21 §21.1) — empty for a
 * bolt-ended strut, same as the source's declared-but-unused `partsSlots` before it.
 */
export function buildParts(s: FenderConfig, g: Geometry = geo(s)): PartsModel {
  const outlines: Path[] = [];
  const folds: Path[] = [];
  const holes: Hole[] = [];
  const slots: Slot[] = [];
  const labels: Label[] = [];

  const { strap, r, offset, cy, h: strutH } = strutEndGeometry(s.strutEnd);
  const xTrans = s.strutLen - STRUT_STRAP_TRANS_L - STRUT_STRAP_PADDLE_L;
  const xPaddle = s.strutLen - STRUT_STRAP_PADDLE_L;
  const slotMargin = (STRUT_STRAP_PADDLE_L - STRUT_STRAP_SLOT_GAP) / 2;
  let py = 12;

  for (let i = 0; i < s.struts; i++) {
    const y = py + i * (strutH + 9);
    outlines.push({
      d: strap
        ? `M ${f1(r)},${f1(y + offset)} h ${f1(xTrans - r)}` +
          ` L ${f1(xPaddle)},${f1(y)}` +
          ` L ${f1(s.strutLen)},${f1(y)}` +
          ` L ${f1(s.strutLen)},${f1(y + strutH)}` +
          ` L ${f1(xPaddle)},${f1(y + strutH)}` +
          ` L ${f1(xTrans)},${f1(y + offset + STRUT_W)}` +
          ` h ${f1(-(xTrans - r))}` +
          ` a ${r} ${r} 0 0 1 0 ${f1(-STRUT_W)} Z`
        : `M ${r},${f1(y)} h ${f1(s.strutLen - STRUT_W)}` +
          ` a ${r} ${r} 0 0 1 0 ${STRUT_W}` +
          ` h ${f1(-(s.strutLen - STRUT_W))}` +
          ` a ${r} ${r} 0 0 1 0 ${-STRUT_W} Z`
    });
    folds.push({
      d: strap
        ? `M ${STRUT_FOLD_INSET},${f1(y + offset)} v ${STRUT_W}` +
          ` M ${f1(s.strutLen - STRUT_FOLD_INSET)},${f1(y)} v ${f1(strutH)}`
        : `M ${STRUT_FOLD_INSET},${f1(y)} v ${STRUT_W}` +
          ` M ${f1(s.strutLen - STRUT_FOLD_INSET)},${f1(y)} v ${STRUT_W}`
    });
    // The source pushes a bare literal `cx: 12` here (untyped JS); f0(12) === '12'
    // reproduces that exact text while satisfying Hole.cx's frozen string type.
    holes.push(
      { cx: f0(12), cy: f1(y + cy), r: 2.5 },
      { cx: f1(s.strutLen / 2), cy: f1(y + cy), r: 2 }
    );
    if (!strap) {
      holes.push(
        { cx: f1(s.strutLen - 12), cy: f1(y + cy), r: 2.5 },
        { cx: f1(s.strutLen - 22), cy: f1(y + cy), r: 2.5 }
      );
    } else {
      for (const scx of [xPaddle + slotMargin, xPaddle + slotMargin + STRUT_STRAP_SLOT_GAP]) {
        slots.push({
          x: f1(scx - STRUT_STRAP_SLOT_W / 2),
          y: f1(y + cy - STRUT_STRAP_SLOT_L / 2),
          w: STRUT_STRAP_SLOT_W,
          h: STRUT_STRAP_SLOT_L
        });
      }
    }
    labels.push({
      x: f1(s.strutLen + 8),
      y: f1(y + cy + 2),
      size: 5,
      text: `STRUT ${i + 1}, ${f0(s.strutLen)} × ${STRUT_W}${strap ? ', STRAP END' : ''}`
    });
  }
  py += s.struts * (strutH + 9) + 14;

  if (s.mudflap > 0) {
    const w = g.crownTail;
    const h = s.mudflap;
    const rr = Math.min(18, w / 3);
    outlines.push({
      d:
        `M 0,${f1(py)} h ${f1(w)} v ${f1(h - rr)}` +
        ` q 0,${f1(rr)} ${f1(-rr)},${f1(rr)}` +
        ` h ${f1(-(w - 2 * rr))}` +
        ` q ${f1(-rr)},0 ${f1(-rr)},${f1(-rr)} Z`
    });
    folds.push({ d: `M 0,${f1(py + 16)} h ${f1(w)}` });
    for (const k of [-0.3, 0, 0.3]) {
      holes.push({ cx: f1(w / 2 + w * k), cy: f1(py + 8), r: 2 });
    }
    labels.push({
      x: f1(w + 8),
      y: f1(py + 10),
      size: 5,
      text: `MUDFLAP, ${f0(w)} × ${f0(h)} mm, lap 16 mm under the tail`
    });
    py += s.mudflap + 16;
  }

  const extraCount = s.join === 'rivet' || s.join === 'slot' ? g.n - 1 : 0;
  const extraLabel = s.join === 'rivet' ? 'BUTT STRAP' : 'CLIP';
  for (let i = 0; i < extraCount; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = 2 + col * 42;
    const y = py + row * 22;
    const w = 34;
    const h = 14;
    outlines.push({ d: `M ${f1(x)},${f1(y)} h ${w} v ${h} h ${-w} Z` });
    if (s.join === 'rivet') {
      for (const cx of [8, 26]) {
        for (const cy of [4.5, 9.5]) {
          holes.push({ cx: f1(x + cx), cy: f1(y + cy), r: 1.6 });
        }
      }
    } else {
      folds.push({ d: `M ${f1(x + 6)},${f1(y)} v ${h} M ${f1(x + 28)},${f1(y)} v ${h}` });
    }
    if (i === 0) {
      labels.push({
        x: f1(x),
        y: f1(y - 3),
        size: 5,
        text: `${extraLabel} × ${extraCount}, 34 × 14 mm`
      });
    }
  }

  const width = Math.max(s.strutLen + 96, g.crownTail + 150);
  const height = py + Math.max(1, Math.ceil(extraCount / 6)) * 22 + 10;
  const viewBox = `-2 0 ${f1(width)} ${f1(height)}`;

  // PLAN §12 — the problem was packing, not size: the design's single-column layout
  // (still what `outlines`/`width`/`height` above describe, unchanged, for the laser
  // export path) wastes most of a page, and it isn't what `fitsA4` should mean anymore.
  const locals: LocalPart[] = [];
  for (let i = 0; i < s.struts; i++) locals.push(localStrut(i, s.strutLen, s.strutEnd));
  if (s.mudflap > 0) locals.push(localMudflap(g.crownTail, s.mudflap));
  for (let i = 0; i < extraCount; i++) {
    locals.push(localExtra(i, s.join as 'rivet' | 'slot', i === 0 ? `${extraLabel} × ${extraCount}, 34 × 14 mm` : null));
  }
  const pages = packParts(locals);

  // Only a part that fits a page in NEITHER orientation is a real constraint worth
  // warning about (a strut longer than PW mm, since PARTS_PH < PW) — needing a second
  // *page* is not, unlike the design's single-column width-only check.
  const fitsPage = (w: number, h: number) => (w <= PW && h <= PARTS_PH) || (h <= PW && w <= PARTS_PH);
  const oversizedParts = locals
    .filter((p) => !fitsPage(p.w, p.h + LABEL_ROW_H))
    .map((p) => Math.max(p.w, p.h + LABEL_ROW_H));
  const fitsA4 = pages.length <= 1 && oversizedParts.length === 0;

  return {
    outlines,
    folds,
    holes,
    slots,
    labels,
    viewBox,
    width,
    height,
    fitsA4,
    pages,
    oversizedParts,
    extraCount,
    extraLabel
  };
}
