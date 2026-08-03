import { pathPolys } from './pathPolys';
import type { DrawingModel, Hole } from '../fender/types';

/**
 * Distance Sheet B (parts) sits below Sheet A (blank), mm. Must match `svg.ts`'s
 * `PARTS_GAP` — both exports need to agree on where the parts sheet is.
 */
const PARTS_GAP = 30;

type Layer = 'CUT' | 'FOLD' | 'HOLES';

/**
 * `LWPOLYLINE`/`CIRCLE` output on layers CUT / FOLD / HOLES (colours 7 / 5 / 1), at
 * 1 unit = 1 mm. Y is negated relative to the SVG (DXF is Y-up, SVG is Y-down) —
 * `(-(y + offset)).toFixed(3)`, ported unchanged from the design source's `buildDxf()`
 * (fender.html:602-622). Entity geometry, rounding and ordering are byte-identical to
 * the source; only the header below is new — see PLAN §9.3.
 *
 * PLAN §9.3: the source claimed "R12 ASCII", but `LWPOLYLINE` is R14+ and the file had
 * no `HEADER`/`TABLES` section — stricter R12 readers would reject it. Fixed by adding
 * a minimal `HEADER` declaring `$ACADVER` = AC1015 (AutoCAD 2000 / R2000, the version
 * `LWPOLYLINE` actually requires) and a `TABLES` section with the three layers used
 * below. The "R12 ASCII" wording in the matching engineering note lives in
 * `src/fender/notes.ts`, not here — corrected there per PLAN §9.3.
 *
 */
export function buildDxf(model: DrawingModel): string {
  const { geo: g, blank, parts } = model;
  const dy = g.Wd + PARTS_GAP;

  const out: string[] = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',
    '0', 'ENDSEC',

    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '3',
    '0', 'LAYER', '2', 'CUT', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'FOLD', '70', '0', '62', '5', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'HOLES', '70', '0', '62', '1', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',

    '0', 'SECTION', '2', 'ENTITIES'
  ];

  const poly = (pts: [number, number][], layer: Layer, closed: boolean, off: number) => {
    out.push(
      '0', 'LWPOLYLINE',
      '8', layer,
      '100', 'AcDbEntity',
      '100', 'AcDbPolyline',
      '90', String(pts.length),
      '70', closed ? '1' : '0'
    );
    pts.forEach((pp) => out.push('10', pp[0].toFixed(3), '20', (-(pp[1] + off)).toFixed(3)));
  };

  const circle = (c: Hole, layer: Layer, off: number) =>
    out.push(
      '0', 'CIRCLE',
      '8', layer,
      '10', (+c.cx).toFixed(3),
      '20', (-(+c.cy + off)).toFixed(3),
      '30', '0.0',
      '40', (+c.r).toFixed(3)
    );

  const closed = (d: string) => /z\s*$/i.test(d.trim());

  pathPolys(blank.outline).forEach((pts) => poly(pts, 'CUT', true, 0));
  blank.slots.forEach((sl) =>
    poly(
      [
        [+sl.x, +sl.y],
        [+sl.x + +sl.w, +sl.y],
        [+sl.x + +sl.w, +sl.y + +sl.h],
        [+sl.x, +sl.y + +sl.h]
      ],
      'CUT',
      true,
      0
    )
  );
  blank.foldLines
    .concat(blank.scoreLines)
    .forEach((f) => pathPolys(f.d).forEach((pts) => poly(pts, 'FOLD', false, 0)));
  blank.seams.forEach((f) => pathPolys(f.d).forEach((pts) => poly(pts, 'FOLD', false, 0)));
  blank.holes.forEach((c) => circle(c, 'HOLES', 0));
  parts.outlines.forEach((o) => pathPolys(o.d).forEach((pts) => poly(pts, 'CUT', closed(o.d), dy)));
  parts.folds.forEach((f) => pathPolys(f.d).forEach((pts) => poly(pts, 'FOLD', false, dy)));
  parts.holes.forEach((c) => circle(c, 'HOLES', dy));

  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}
