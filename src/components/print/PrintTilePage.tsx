import { PRINT_STROKE, RULER_CAPTION } from '../../lib/printStrokes';
import { DrawingLabels } from '../canvas/DrawingLabels';
import type { BlankModel, FenderConfig, PrintTile } from '../../fender/types';

interface PrintTilePageProps {
  tile: PrintTile;
  config: FenderConfig;
  blank: BlankModel;
  nestTransform: string | null;
}

/**
 * One A4-landscape page per print tile. Every tile draws the whole blank at 1:1 — the
 * SVG's own `viewBox` is the window onto it, exactly as the tile grid intends — so
 * every page repeats the same geometry. Design source lines 377-405.
 *
 * PLAN §9.4: when nesting is on, the second blank is drawn as real cut geometry
 * (outline, folds, scores, holes, slots under `tiling.nestTransform`), appended after
 * the primary drawing — not the dashed screen-only ghost from `SheetA.tsx`.
 */
export function PrintTilePage({ tile, config, blank, nestTransform }: PrintTilePageProps) {
  return (
    <div className="print-page">
      <div className="print-page__label">{tile.label}</div>
      <div className="print-page__meta">{tile.meta}</div>
      <svg width="267mm" height="180mm" viewBox={tile.viewBox} style={{ display: 'block' }}>
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
        {config.nest && nestTransform && (
          <g transform={nestTransform}>
            <path d={blank.outline} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.outline} strokeLinejoin="round" />
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
          </g>
        )}
      </svg>
    </div>
  );
}
