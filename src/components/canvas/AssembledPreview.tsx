import type { IsoModel } from '../../fender/types';

interface AssembledPreviewProps {
  iso: IsoModel;
  assembledLabel: string;
  spin: number;
  onSpinChange: (spin: number) => void;
}

/** Isometric preview + rotate slider. Design source lines 38-78. */
export function AssembledPreview({ iso, assembledLabel, spin, onSpinChange }: AssembledPreviewProps) {
  const spinLabel = `${spin > 0 ? '+' : ''}${spin}°`;

  return (
    <>
      <div className="section-heading">
        <h2>Assembled</h2>
        <span className="meta">{assembledLabel}</span>
      </div>

      <div className="panel">
        <svg
          viewBox={iso.viewBox}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: iso.aspect,
            maxHeight: '68vh',
            display: 'block',
            margin: '0 auto'
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          {iso.wheel.map((w, i) => (
            <path key={i} d={w.d} fill="none" stroke="var(--draw-ghost)" strokeWidth={0.9} strokeDasharray="5 4" />
          ))}
          {iso.facets.map((f, i) => (
            <path key={i} d={f.d} fill={f.fill} stroke={f.fill} strokeWidth={0.3} />
          ))}
          {iso.seams.map((sm, i) => (
            <path key={i} d={sm.d} fill="none" stroke="var(--draw-iso-seam)" strokeWidth={0.9} opacity={0.6} />
          ))}
          {iso.slots.map((sl, i) => (
            <path
              key={i}
              d={sl.d}
              fill="none"
              stroke="var(--draw-iso-seam)"
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.8}
            />
          ))}
          {iso.holes.map((h, i) => (
            <circle
              key={i}
              cx={h.cx}
              cy={h.cy}
              r={h.r}
              fill="var(--draw-iso-seam)"
              stroke="var(--draw-label-dim)"
              strokeWidth={0.4}
              opacity={0.9}
            />
          ))}
          {iso.mudflap.map((m, i) => (
            <path
              key={i}
              d={m.d}
              fill="var(--draw-iso-mudflap)"
              stroke="var(--draw-cut)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
          {iso.struts.map((t, i) => (
            <path
              key={i}
              d={t.d}
              fill="var(--draw-iso-strut)"
              stroke="var(--draw-iso-strut-edge)"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          ))}
          {iso.outline.map((o, i) => (
            <path key={i} d={o.d} fill="none" stroke="var(--draw-cut)" strokeWidth={2.6} strokeLinejoin="round" />
          ))}
          {iso.edges.map((e, i) => (
            <path key={i} d={e.d} fill="none" stroke="var(--draw-cut)" strokeWidth={1} />
          ))}
        </svg>

        <div className="rotate-row">
          <span className="rotate-label">Rotate</span>
          <input
            type="range"
            min={-80}
            max={80}
            step={1}
            value={spin}
            onChange={(e) => onSpinChange(Number(e.target.value))}
          />
          <span className="rotate-value mono">{spinLabel}</span>
        </div>
      </div>
    </>
  );
}
