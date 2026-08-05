import { DrawingLabels } from './DrawingLabels';
import type { XsecModel } from '../../fender/types';

interface CrossSectionViewProps {
  xsec: XsecModel;
}

/** Design source lines 172-182. */
export function CrossSectionView({ xsec }: CrossSectionViewProps) {
  return (
    <section>
      <h2
        style={{
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-label)',
          textTransform: 'uppercase',
          margin: '0 0 14px',
          fontWeight: 'var(--weight-semibold)'
        }}
      >
        Cross-section
      </h2>
      <div className="panel" style={{ padding: '28px 32px' }}>
        <svg
          viewBox={xsec.viewBox}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {xsec.paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} strokeDasharray={p.dash} />
          ))}
          <DrawingLabels labels={xsec.labels} />
        </svg>
      </div>
    </section>
  );
}
