import type { ReactNode } from 'react';

type Emphasis = 'dark' | 'tinted' | 'plain';

interface OptionButtonProps {
  label: string;
  note?: ReactNode;
  selected: boolean;
  emphasis: Emphasis;
  compact?: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}

/**
 * The rail's recurring pill-button-with-note shape — side/wheel selectors, join/stock
 * options, and the boolean toggles are all this same control with different colour
 * treatments (design source: dark fill for side/wheel, coral tint for join/stock/on
 * toggles).
 */
export function OptionButton({
  label,
  note,
  selected,
  emphasis,
  compact = false,
  onClick,
  trailing
}: OptionButtonProps) {
  const classes = [
    'option-btn',
    compact ? 'option-btn--compact' : '',
    selected && emphasis === 'dark' ? 'option-btn--dark' : '',
    selected && emphasis === 'tinted' ? 'option-btn--tinted' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={onClick}>
      {trailing ? (
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <span>
            <span className="option-btn__label">{label}</span>
            {note && <span className="option-btn__note">{note}</span>}
          </span>
          {trailing}
        </span>
      ) : (
        <>
          <span className="option-btn__label">{label}</span>
          {note && <span className="option-btn__note">{note}</span>}
        </>
      )}
    </button>
  );
}
