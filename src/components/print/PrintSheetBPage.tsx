import { PARTS_PH, PW } from '../../fender/defaults';
import { packedPartTransform } from '../../fender/parts';
import { PRINT_STROKE } from '../../lib/printStrokes';
import { DrawingLabels } from '../canvas/DrawingLabels';
import type { PartsPage } from '../../fender/types';

interface PrintSheetBPageProps {
  page: PartsPage;
  pageIndex: number;
  pageCount: number;
}

/**
 * One Sheet B print page — struts, mudflap & hardware packed onto a PW × PARTS_PH page
 * (PLAN §12). One of these renders per `PartsModel.pages` entry, numbered like the
 * Sheet A tiles, each at true 1:1 (1 unit = 1 mm, viewBox is the page, not the content —
 * see PLAN §9.18, the bug this pagination replaces).
 */
export function PrintSheetBPage({ page, pageIndex, pageCount }: PrintSheetBPageProps) {
  return (
    <div className="print-page">
      <div className="print-page__sheetb-title">
        Sheet B — struts, mudflap &amp; hardware · 1:1 · page {pageIndex + 1} of {pageCount}
      </div>
      <svg
        width={`${PW}mm`}
        height={`${PARTS_PH}mm`}
        viewBox={`-2 0 ${PW} ${PARTS_PH}`}
        style={{ display: 'block', marginTop: '4mm' }}
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
            <DrawingLabels labels={[part.label]} fill="var(--draw-label)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
