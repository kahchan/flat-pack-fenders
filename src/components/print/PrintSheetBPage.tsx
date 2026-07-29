import { PARTS_PH, PW } from '../../fender/defaults';
import { partsFitNote } from '../../lib/controlText';
import { PRINT_STROKE } from '../../lib/printStrokes';
import { DrawingLabels } from '../canvas/DrawingLabels';
import type { PartsModel } from '../../fender/types';

interface PrintSheetBPageProps {
  parts: PartsModel;
}

/** Sheet B print page — struts, mudflap & hardware. Design source lines 407-424. */
export function PrintSheetBPage({ parts }: PrintSheetBPageProps) {
  return (
    <div className="print-page">
      <div className="print-page__sheetb-title">
        Sheet B — struts, mudflap &amp; hardware · 1:1 · {partsFitNote(parts)}
      </div>
      {/*
        1 unit = 1 mm, always. The viewBox extent is the PAGE, not the content.

        The design used the content's own extent with `meet`, which scales to fit — so a
        parts sheet taller than the page silently printed small. On the default config
        that was 78%, on a sheet whose whole purpose is cutting struts to length. Fixing
        the fit check alone would not have helped: the scaling happens here.

        Anything past the page edge is now clipped instead, which is visible, and
        `fitsA4` warns before you print. See PLAN §9.18.
      */}
      <svg
        width={`${PW}mm`}
        height={`${PARTS_PH}mm`}
        viewBox={`-2 0 ${PW} ${PARTS_PH}`}
        style={{ display: 'block', marginTop: '4mm' }}
        preserveAspectRatio="xMinYMin slice"
      >
        {parts.outlines.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="var(--draw-cut)"
            strokeWidth={PRINT_STROKE.outline}
            strokeLinejoin="round"
          />
        ))}
        {parts.folds.map((f, i) => (
          <path
            key={i}
            d={f.d}
            fill="none"
            stroke="var(--draw-fold-print)"
            strokeWidth={PRINT_STROKE.fold}
            strokeDasharray="8 4"
          />
        ))}
        {parts.holes.map((h, i) => (
          <circle
            key={i}
            cx={h.cx}
            cy={h.cy}
            r={h.r}
            fill="none"
            stroke="var(--draw-cut)"
            strokeWidth={PRINT_STROKE.hole}
          />
        ))}
        {parts.slots.map((s, i) => (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={2}
            fill="none"
            stroke="var(--draw-cut)"
            strokeWidth={PRINT_STROKE.slot}
          />
        ))}
        <DrawingLabels labels={parts.labels} fill="var(--draw-label)" />
      </svg>
    </div>
  );
}
