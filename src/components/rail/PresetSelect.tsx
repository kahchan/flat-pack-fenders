import { presetMatchesConfig } from '../../lib/presetMatch';
import { PRESETS } from '../../state/presets';
import type { FenderConfig, Side } from '../../fender/types';

interface PresetSelectProps {
  config: FenderConfig;
  onApply: (id: string) => void;
  className?: string;
}

const GROUPS: { side: Side; label: string }[] = [
  { side: 'front', label: 'Front' },
  { side: 'rear', label: 'Rear' }
];

/**
 * B5: `PresetStrip` and `PresetChipStrip` both delete, replaced by one dropdown control
 * shown at every breakpoint (`ControlHeader`). A plain `<select>` rather than a custom
 * listbox: presets are a flat named list, and the native control gets keyboard/a11y
 * behaviour for free. Falls back to a blank selection when the live config doesn't
 * match any preset exactly — same "custom" state `PresetStrip`'s cards used to show.
 */
export function PresetSelect({ config, onApply, className }: PresetSelectProps) {
  const matched = PRESETS.find((p) => presetMatchesConfig(p, config));

  return (
    <select
      className={className ? `preset-select ${className}` : 'preset-select'}
      value={matched?.id ?? ''}
      onChange={(e) => e.target.value && onApply(e.target.value)}
      aria-label="Preset"
    >
      {!matched && (
        <option value="" disabled>
          Custom
        </option>
      )}
      {GROUPS.map((g) => {
        const presets = PRESETS.filter((p) => !p.ungrouped && p.config.side === g.side);
        if (presets.length === 0) return null;
        return (
          <optgroup key={g.side} label={g.label}>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {PRESETS.filter((p) => p.ungrouped).map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
    </select>
  );
}
