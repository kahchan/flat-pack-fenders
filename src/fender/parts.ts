import { PARTS_PH, PW, STRUT_FOLD_INSET, STRUT_W, f0, f1 } from './defaults';
import { geo } from './geometry';
import type { FenderConfig, Geometry, Hole, Label, PartsModel, Path, Slot } from './types';

/**
 * Sheet B — struts, mudflap, butt straps / clips.
 *
 * Layout order is preserved from the design source: struts first, then the mudflap,
 * then the join hardware (butt straps or slot-and-tab clips), stacked top to bottom.
 * `slots` stays empty — the source declares `partsSlots` and returns it, but no branch
 * ever pushes into it. Ported faithfully; see the WP2 report for the finding.
 */
export function buildParts(s: FenderConfig, g: Geometry = geo(s)): PartsModel {
  const outlines: Path[] = [];
  const folds: Path[] = [];
  const holes: Hole[] = [];
  const slots: Slot[] = [];
  const labels: Label[] = [];

  const r = STRUT_W / 2;
  let py = 12;

  for (let i = 0; i < s.struts; i++) {
    const y = py + i * (STRUT_W + 9);
    outlines.push({
      d:
        `M ${r},${f1(y)} h ${f1(s.strutLen - STRUT_W)}` +
        ` a ${r} ${r} 0 0 1 0 ${STRUT_W}` +
        ` h ${f1(-(s.strutLen - STRUT_W))}` +
        ` a ${r} ${r} 0 0 1 0 ${-STRUT_W} Z`
    });
    folds.push({
      d:
        `M ${STRUT_FOLD_INSET},${f1(y)} v ${STRUT_W}` +
        ` M ${f1(s.strutLen - STRUT_FOLD_INSET)},${f1(y)} v ${STRUT_W}`
    });
    // The source pushes a bare literal `cx: 12` here (untyped JS); f0(12) === '12'
    // reproduces that exact text while satisfying Hole.cx's frozen string type.
    holes.push(
      { cx: f0(12), cy: f1(y + r), r: 2.5 },
      { cx: f1(s.strutLen / 2), cy: f1(y + r), r: 2 }
    );
    if (s.fuse) {
      holes.push({ cx: f1(s.strutLen - 12), cy: f1(y + r), r: 3.2 });
    } else {
      holes.push(
        { cx: f1(s.strutLen - 12), cy: f1(y + r), r: 2.5 },
        { cx: f1(s.strutLen - 22), cy: f1(y + r), r: 2.5 }
      );
    }
    labels.push({
      x: f1(s.strutLen + 8),
      y: f1(y + r + 2),
      size: 5,
      text: `STRUT ${i + 1} · ${f0(s.strutLen)} × ${STRUT_W}${s.fuse ? ' · FUSE END' : ''}`
    });
  }
  py += s.struts * (STRUT_W + 9) + 14;

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
      text: `MUDFLAP · ${f0(w)} × ${f0(h)} mm · lap 16 mm under the tail`
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
        text: `${extraLabel} × ${extraCount} · 34 × 14 mm`
      });
    }
  }

  const width = Math.max(s.strutLen + 96, g.crownTail + 150);
  const height = py + Math.max(1, Math.ceil(extraCount / 6)) * 22 + 10;
  const viewBox = `-2 0 ${f1(width)} ${f1(height)}`;

  // Both dimensions, deliberately diverging from the design, which tested width alone.
  // Sheet B prints into 267 × 172 mm; a taller sheet used to be scaled down silently
  // while the app still said "fits A4 at full size". On the default config that was 78%,
  // and struts are a part you cut to length. See PLAN §9.18.
  const fitsA4 = width <= PW && height <= PARTS_PH;

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
    extraCount,
    extraLabel
  };
}
