import { f0 } from '../../fender/defaults';
import { DrawingLabels } from './DrawingLabels';
import type { BlankModel, FenderConfig, Geometry, TilingModel } from '../../fender/types';

interface SheetAProps {
  config: FenderConfig;
  g: Geometry;
  blank: BlankModel;
  tiling: TilingModel;
}

/** Sheet A — the fender blank. Design source lines 103-146. */
export function SheetA({ config, g, blank, tiling }: SheetAProps) {
  const blankSizeLabel = `${f0(g.L)} × ${f0(g.Wd)} mm developed`;
  const tileCountLabel = `${tiling.sheetCount} sheets A4 landscape`;

  return (
    <section>
      <div className="section-heading">
        <h2>Sheet A — fender blank</h2>
        <span className="meta">{blankSizeLabel}</span>
        <span className="meta meta--accent">{tileCountLabel}</span>
      </div>
      <div className="panel panel--scroll">
        <svg
          viewBox={blank.viewBox}
          style={{ width: '100%', height: 'auto', display: 'block', minWidth: 720 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {tiling.rects.map((t, i) => (
            <rect
              key={i}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill="none"
              stroke="var(--draw-seam)"
              strokeWidth={0.7}
              strokeDasharray="7 5"
              opacity={0.45}
            />
          ))}
          {config.nest && (
            <g transform={tiling.nestTransform ?? undefined}>
              <path
                d={blank.outline}
                fill="none"
                stroke="var(--draw-ghost)"
                strokeWidth={1}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            </g>
          )}
          <path d={blank.outline} fill="var(--draw-blank-fill)" stroke="var(--draw-cut)" strokeWidth={1.2} strokeLinejoin="round" />
          {blank.foldLines.map((f, i) => (
            <path key={i} d={f.d} fill="none" stroke="var(--draw-fold)" strokeWidth={0.9} strokeDasharray="11 6" />
          ))}
          {blank.scoreLines.map((c, i) => (
            <path key={i} d={c.d} fill="none" stroke="var(--draw-fold)" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.85} />
          ))}
          {blank.holes.map((h, i) => (
            <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="var(--draw-cut)" strokeWidth={0.9} />
          ))}
          {blank.slots.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={1.5} fill="none" stroke="var(--draw-cut)" strokeWidth={0.9} />
          ))}
          {blank.seams.map((sm, i) => (
            <path key={i} d={sm.d} fill="none" stroke="var(--draw-seam)" strokeWidth={1.4} strokeDasharray="14 7" />
          ))}
          {blank.lapLines.map((lp, i) => (
            <path key={i} d={lp.d} fill="none" stroke="var(--draw-seam)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
          ))}
          {blank.lapArrows.map((a, i) => (
            <path key={i} d={a.d} fill="none" stroke="var(--draw-seam)" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <DrawingLabels labels={blank.labels} scale={2.4} />
        </svg>
      </div>
      <div className="legend-row">
        <span>—— cut line</span>
        <span className="legend--fold">– – fold / score (don&rsquo;t cut)</span>
        <span className="legend--seam">– – A4 tile edge · panel seam</span>
        <span className="legend--ghost">– – nested second fender</span>
        <span className="legend--seam">· · · panel lap edge</span>
      </div>
    </section>
  );
}
