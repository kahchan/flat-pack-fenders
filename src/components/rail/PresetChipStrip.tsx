import { presetMatchesConfig } from '../../lib/presetMatch';
import { PRESETS } from '../../state/presets';
import type { FenderConfig, Side } from '../../fender/types';

interface PresetChipStripProps {
  config: FenderConfig;
  onApply: (id: string) => void;
}

const GROUPS: { side: Side; label: string }[] = [
  { side: 'front', label: 'Front' },
  { side: 'rear', label: 'Rear' }
];

/**
 * Compact, thumbnail-free preset row for the bottom sheet's 96px peek state (PLAN §4).
 * The full `PresetStrip` cards (92px tall) don't fit the peek budget alongside the drag
 * handle and spec line, so peek gets this text-only variant; the full-size `PresetStrip`
 * still renders inside the sheet body (via `ControlRail`) once dragged past peek.
 *
 * Front/rear grouping (PLAN FEEDBACK WP16 §16.3) has to fit inside that same 96px
 * budget, so unlike the desk rail's stacked `PresetStrip` groups, the group label here
 * is an inline divider within the one scrollable row rather than a heading above it.
 */
export function PresetChipStrip({ config, onApply }: PresetChipStripProps) {
  return (
    <div className="preset-chip-strip">
      {GROUPS.map((g) => {
        const presets = PRESETS.filter((p) => p.config.side === g.side);
        if (presets.length === 0) return null;
        return (
          <span key={g.side} className="preset-chip-strip__group">
            <span className="preset-chip-strip__label">{g.label}</span>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip${presetMatchesConfig(preset, config) ? ' preset-chip--selected' : ''}`}
                onClick={() => onApply(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </span>
        );
      })}
    </div>
  );
}
