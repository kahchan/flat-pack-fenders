import { PRINT_STROKE, RULER_CAPTION } from '../../lib/printStrokes';
import { DrawingLabels } from '../canvas/DrawingLabels';
import type { BlankModel, PrintTile } from '../../fender/types';

interface SheetATileSvgProps {
  tile: PrintTile;
  /** SVG `width`/`height` attrs, e.g. `"267mm"` — always equal to the viewBox's own mm
   * extent, so nothing here is ever a scale, only a window (PLAN FEEDBACK WP15 §15.3:
   * the last tile row draws a SHORTER window, never a shrunk one). */
  width: string;
  height: string;
  blank: BlankModel;
}

/**
 * The actual cut/fold/hole geometry for one Sheet-A print tile, at true 1:1 — shared by
 * the full-height tiles (`PrintTilePage`) and the shrunk last-row tiles packed onto a
 * combined page (`PrintCombinedPage`), which differ only in how much of the tile's
 * nominal PH height is actually visible. Design source lines 377-405.
 */
export function SheetATileSvg({ tile, width, height, blank }: SheetATileSvgProps) {
  return (
    <svg width={width} height={height} viewBox={tile.viewBox} style={{ display: 'block' }}>
      <path d={tile.frame} fill="none" stroke="var(--draw-frame)" strokeWidth={PRINT_STROKE.frame} strokeDasharray="4 3" />
      <path d={tile.ruler} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.ruler} />
      <text x={tile.rulerX} y={tile.rulerY} fontSize={4} fill="var(--draw-label)" fontFamily="var(--font-mono)">
        {RULER_CAPTION}
      </text>
      <path d={blank.outline} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.outline} strokeLinejoin="round" />
      {blank.seams.map((sm, i) => (
        <path key={i} d={sm.d} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.seam} strokeDasharray="10 5" />
      ))}
      {blank.lapLines.map((lp, i) => (
        <path key={i} d={lp.d} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.lap} strokeDasharray="3 3" />
      ))}
      {blank.lapArrows.map((a, i) => (
        <path key={i} d={a.d} fill="none" stroke="var(--draw-seam)" strokeWidth={PRINT_STROKE.seam} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {blank.foldLines.map((f, i) => (
        <path key={i} d={f.d} fill="none" stroke="var(--draw-fold-print)" strokeWidth={PRINT_STROKE.fold} strokeDasharray="8 4" />
      ))}
      {blank.scoreLines.map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke="var(--draw-fold-print)" strokeWidth={PRINT_STROKE.score} strokeDasharray="3 2" />
      ))}
      {blank.holes.map((h, i) => (
        <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.hole} />
      ))}
      {blank.slots.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={1.5} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.slot} />
      ))}
      <DrawingLabels labels={blank.labels} />
    </svg>
  );
}
