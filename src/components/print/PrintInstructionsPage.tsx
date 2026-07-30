import type { AssemblyStep } from '../../fender/types';

interface PrintInstructionsPageProps {
  printSpecLine: string;
  steps: AssemblyStep[];
}

/**
 * Assembly instructions print page, steps in two columns — the page someone reads
 * while building the thing, so it uses the same label treatment, rule and type tokens
 * as the rest of the app (`--text-label-*`, `--color-*`) rather than its own one-off
 * styling (PLAN FEEDBACK WP15 §15.4). Design source lines 425-433.
 */
export function PrintInstructionsPage({ printSpecLine, steps }: PrintInstructionsPageProps) {
  return (
    <div className="print-page print-page--instructions">
      <div className="print-instructions-kicker">Assembly</div>
      <div className="print-instructions-title">Flat-pack fender</div>
      <div className="print-instructions-rule" />
      <div className="print-instructions-spec mono">{printSpecLine}</div>
      <ol className="print-instructions-list">
        {steps.map((s) => (
          <li key={s.n}>
            <span className="print-instructions-list__n mono">{s.n}</span>
            <span>
              <b>{s.title}</b> — {s.body}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
