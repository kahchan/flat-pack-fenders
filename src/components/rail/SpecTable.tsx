import type { SpecRow } from '../../fender/types';

interface SpecTableProps {
  specs: SpecRow[];
}

/** The 11-row spec table. Design source lines 360-370. */
export function SpecTable({ specs }: SpecTableProps) {
  return (
    <div className="spec-table">
      {specs.map((s) => (
        <div key={s.label} className="spec-row">
          <div>
            <div className="spec-row__label">{s.label}</div>
            <div className="spec-row__note">{s.note}</div>
          </div>
          <div className="spec-row__value mono">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
