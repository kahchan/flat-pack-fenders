import type { BlankModel, PrintTile } from '../../fender/types';

interface PrintTilesProps {
  tiles: PrintTile[];
  blank: BlankModel;
  tileCountLabel: string;
}

/** Print tile previews for the Assembly tab. Design source lines 204-240. */
export function PrintTiles({ tiles, blank, tileCountLabel }: PrintTilesProps) {
  return (
    <section>
      <div className="section-heading">
        <h2>Print sheets, A4 landscape, 1:1</h2>
        <span className="meta">{tileCountLabel}</span>
        <span className="meta meta--faint">15 mm safe margin</span>
      </div>
      <div className="print-tiles-list">
        {tiles.map((t, i) => (
          <div key={i} className="print-tile-card">
            <div className="print-tile-card__head">
              <span>{t.label}</span>
              <span>{t.meta}</span>
            </div>
            <svg viewBox={t.viewBox} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
              <path d={t.frame} fill="none" stroke="var(--draw-frame)" strokeWidth={0.5} strokeDasharray="5 4" />
              <path d={t.ruler} fill="none" stroke="var(--draw-cut)" strokeWidth={0.7} />
              <path d={blank.outline} fill="none" stroke="var(--draw-cut)" strokeWidth={1} strokeLinejoin="round" />
              {blank.seams.map((sm, j) => (
                <path key={j} d={sm.d} fill="none" stroke="var(--draw-cut)" strokeWidth={0.7} strokeDasharray="10 5" />
              ))}
              {blank.lapLines.map((lp, j) => (
                <path key={j} d={lp.d} fill="none" stroke="var(--draw-cut)" strokeWidth={0.5} strokeDasharray="3 3" />
              ))}
              {blank.lapArrows.map((a, j) => (
                <path key={j} d={a.d} fill="none" stroke="var(--draw-seam)" strokeWidth={0.7} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {blank.foldLines.map((f, j) => (
                <path key={j} d={f.d} fill="none" stroke="var(--draw-fold-print)" strokeWidth={0.7} strokeDasharray="9 5" />
              ))}
              {blank.holes.map((h, j) => (
                <circle key={j} cx={h.cx} cy={h.cy} r={h.r} fill="none" stroke="var(--draw-cut)" strokeWidth={0.7} />
              ))}
              {blank.slots.map((s, j) => (
                <rect key={j} x={s.x} y={s.y} width={s.w} height={s.h} rx={1.5} fill="none" stroke="var(--draw-cut)" strokeWidth={0.7} />
              ))}
            </svg>
          </div>
        ))}
      </div>
    </section>
  );
}
