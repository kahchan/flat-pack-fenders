import { PW } from '../../fender/defaults';
import { packedPartTransform } from '../../fender/parts';
import { PRINT_STROKE } from '../../lib/printStrokes';
import { DrawingLabels } from '../canvas/DrawingLabels';
import type { PartsPage } from '../../fender/types';

interface SheetBPageSvgProps {
  page: PartsPage;
  /** Real content height to draw, mm — the page's own `height` (PARTS_PH) when Sheet B
   * has a whole page to itself, or a shorter packed slot height when it shares one with
   * Sheet A's last tile row (PLAN FEEDBACK WP15 §15.3). Either way this is a window
   * height, not a scale — `width`/`height` attrs always match the viewBox. */
  height: number;
}

/**
 * Struts, mudflap & hardware packed onto a PW × height page (PLAN §12), at true 1:1 (1
 * unit = 1 mm, viewBox is the page/slot, not the content — see PLAN §9.18, the bug this
 * pagination replaces).
 */
export function SheetBPageSvg({ page, height }: SheetBPageSvgProps) {
  return (
    <svg
      width={`${PW}mm`}
      height={`${height}mm`}
      viewBox={`-2 0 ${PW} ${height}`}
      style={{ display: 'block' }}
      preserveAspectRatio="xMinYMin slice"
    >
      {page.parts.map((part, i) => (
        <g key={i} transform={packedPartTransform(part)}>
          <path
            d={part.outline.d}
            fill="none"
            stroke="var(--draw-cut)"
            strokeWidth={PRINT_STROKE.outline}
            strokeLinejoin="round"
          />
          {part.folds.map((f, j) => (
            <path
              key={j}
              d={f.d}
              fill="none"
              stroke="var(--draw-fold-print)"
              strokeWidth={PRINT_STROKE.fold}
              strokeDasharray="8 4"
            />
          ))}
          {part.holes.map((h, j) => (
            <circle key={j} cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.hole} />
          ))}
          {part.slots.map((sl, j) => (
            <rect key={j} x={sl.x} y={sl.y} width={sl.w} height={sl.h} rx={1.5} fill="none" stroke="var(--draw-cut)" strokeWidth={PRINT_STROKE.hole} />
          ))}
          <DrawingLabels labels={[part.label]} fill="var(--draw-label)" />
        </g>
      ))}
    </svg>
  );
}
