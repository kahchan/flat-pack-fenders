import type { BlankModel, PrintTile } from '../../fender/types';

interface PrintTilesProps {
  tiles: PrintTile[];
  blank: BlankModel;
}

/** Print tile previews, WP22 §22.3's "Print pages" section — the heading (with sheet
 * count) now lives in the `DrawingSection` accordion header that wraps this. */
export function PrintTiles({ tiles, blank }: PrintTilesProps) {
  return (
    <section>
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
