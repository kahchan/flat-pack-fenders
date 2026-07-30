import { partsSizeLabel } from '../../lib/controlText';
import { DrawingLabels } from './DrawingLabels';
import type { FenderConfig, PartsModel } from '../../fender/types';

interface SheetBProps {
  config: FenderConfig;
  parts: PartsModel;
}

/** Sheet B — struts, mudflap & hardware. Design source lines 148-170. */
export function SheetB({ config, parts }: SheetBProps) {
  return (
    <section>
      <div className="section-heading">
        <h2>Sheet B, struts, mudflap &amp; hardware</h2>
        <span className="meta">{partsSizeLabel(config, parts)}</span>
      </div>
      <div className="panel">
        <svg
          viewBox={parts.viewBox}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {parts.outlines.map((p, i) => (
            <path key={i} d={p.d} fill="var(--draw-blank-fill)" stroke="var(--draw-cut)" strokeWidth={1.2} strokeLinejoin="round" />
          ))}
          {parts.folds.map((f, i) => (
            <path key={i} d={f.d} fill="none" stroke="var(--draw-fold)" strokeWidth={0.9} strokeDasharray="9 5" />
          ))}
          {parts.holes.map((h, i) => (
            <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="var(--draw-cut)" strokeWidth={0.9} />
          ))}
          {parts.slots.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={2} fill="none" stroke="var(--draw-cut)" strokeWidth={0.9} />
          ))}
          <DrawingLabels labels={parts.labels} fill="var(--draw-label-dim)" />
        </svg>
      </div>
    </section>
  );
}
