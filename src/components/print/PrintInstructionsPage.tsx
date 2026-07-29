import type { AssemblyStep } from '../../fender/types';

interface PrintInstructionsPageProps {
  printSpecLine: string;
  steps: AssemblyStep[];
}

/** Assembly instructions print page, steps in two columns. Design source lines 425-433. */
export function PrintInstructionsPage({ printSpecLine, steps }: PrintInstructionsPageProps) {
  return (
    <div className="print-page print-page--instructions">
      <div className="print-instructions-title">Flat-pack fender — assembly</div>
      <div className="print-instructions-spec">{printSpecLine}</div>
      <ol className="print-instructions-list">
        {steps.map((s) => (
          <li key={s.n}>
            <b>{s.title}</b> — {s.body}
          </li>
        ))}
      </ol>
    </div>
  );
}
