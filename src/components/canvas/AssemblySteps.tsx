import type { AssemblyStep } from '../../fender/types';

interface AssemblyStepsProps {
  steps: AssemblyStep[];
}

/** Design source lines 242-252. Heading now lives in the `DrawingSection` accordion
 * header that wraps this (WP22 §22.3). */
export function AssemblySteps({ steps }: AssemblyStepsProps) {
  return (
    <section>
      <ol className="assembly-steps">
        {steps.map((s) => (
          <li key={s.n}>
            <span className="step-n mono">{s.n}</span>
            <span className="step-body">
              <b>{s.title}</b>: {s.body}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
