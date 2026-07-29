import type { AssemblyStep } from '../../fender/types';

interface AssemblyStepsProps {
  steps: AssemblyStep[];
}

/** Design source lines 242-252. */
export function AssemblySteps({ steps }: AssemblyStepsProps) {
  return (
    <section>
      <h2
        style={{
          fontSize: 'var(--text-label-size)',
          letterSpacing: 'var(--text-label-track)',
          textTransform: 'uppercase',
          margin: '0 0 16px',
          fontWeight: 'var(--text-label-weight)'
        }}
      >
        Assembly
      </h2>
      <ol className="assembly-steps">
        {steps.map((s) => (
          <li key={s.n}>
            <span className="step-n mono">{s.n}</span>
            <span className="step-body">
              <b>{s.title}</b> — {s.body}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
