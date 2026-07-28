import { DEFAULTS } from './fender/defaults';
import { geo } from './fender/geometry';
import { buildBlank } from './fender/pattern';

/**
 * Placeholder shell. WP7 replaces this with the real two-pane layout.
 * For now it renders the computed geometry so the stack is verifiably wired up.
 */
export function App() {
  const g = geo(DEFAULTS);
  const blank = buildBlank(DEFAULTS);

  const rows: [string, string][] = [
    ['Fender radius', `${g.R.toFixed(2)} mm`],
    ['Developed length', `${g.L.toFixed(2)} mm`],
    ['Developed width', `${g.Wd.toFixed(2)} mm`],
    ['Flap pitch', `${g.pitch.toFixed(2)} mm`],
    ['Dart width', `${g.notch.toFixed(2)} mm`],
    ['Bend allowance', `${g.bendComp.toFixed(2)} mm per fold`],
    ['Total take-up', `${g.removal.toFixed(2)} mm`],
    ['Panels', String(blank.panelCount)],
    ['Holes', String(blank.holes.length)],
    ['Slots', String(blank.slots.length)]
  ];

  return (
    <main style={{ padding: 'var(--space-8)', maxWidth: 720 }}>
      <h1
        style={{
          fontSize: 'var(--text-heading-lg-size)',
          letterSpacing: '-0.01em',
          margin: 0
        }}
      >
        Flat-pack fender
      </h1>
      <p
        style={{
          color: 'var(--color-fg-muted)',
          fontSize: 'var(--text-body-sm-size)'
        }}
      >
        Scaffold and geometry core are in place. UI lands in WP7.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          background: 'var(--color-border)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginTop: 'var(--space-6)'
        }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              background: 'var(--color-surface)',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>{label}</span>
            <span className="mono" style={{ fontSize: 14 }}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <svg
        viewBox={blank.viewBox}
        style={{
          width: '100%',
          marginTop: 'var(--space-6)',
          background: 'var(--draw-paper)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <path
          d={blank.outline}
          fill="var(--draw-blank-fill)"
          stroke="var(--draw-cut)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {blank.foldLines.map((f, i) => (
          <path
            key={i}
            d={f.d}
            fill="none"
            stroke="var(--draw-fold)"
            strokeWidth={0.9}
            strokeDasharray="11 6"
          />
        ))}
      </svg>
    </main>
  );
}
