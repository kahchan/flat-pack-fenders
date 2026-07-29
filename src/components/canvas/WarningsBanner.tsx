import type { Warning } from '../../fender/types';

interface WarningsBannerProps {
  warnings: Warning[];
  visible: boolean;
  onDismiss: () => void;
}

/** Dismissible warnings banner. Dismissal keys on `Warning.id` (PLAN §9.8), handled by
 * the caller — this component only renders what it's told to. */
export function WarningsBanner({ warnings, visible, onDismiss }: WarningsBannerProps) {
  if (!visible) return null;

  return (
    <div className="warning-banner">
      <div className="warning-banner__head">
        <div className="warning-banner__title">Check before you cut</div>
        <button className="warning-banner__dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="warning-banner__list">
        {warnings.map((w) => (
          <div key={w.id} className="warning-banner__item">
            {w.text}
          </div>
        ))}
      </div>
    </div>
  );
}
