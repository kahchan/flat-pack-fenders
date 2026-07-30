import { presetMatchesConfig } from '../../lib/presetMatch';
import { PresetCard } from './PresetCard';
import { PRESETS, type Preset } from '../../state/presets';
import type { FenderConfig, Side } from '../../fender/types';

interface PresetStripProps {
  config: FenderConfig;
  onApply: (id: string) => void;
}

const GROUPS: { side: Side; label: string }[] = [
  { side: 'front', label: 'Front' },
  { side: 'rear', label: 'Rear' }
];

const bySide = (side: Side): Preset[] => PRESETS.filter((p) => p.config.side === side);

/**
 * Horizontal-scroll preset strip, PLAN §5 — placed in the rail per WP7's brief, not the
 * WP10 slot the plan's table originally listed it under.
 *
 * Split into Front/Rear groups (PLAN FEEDBACK WP16 §16.3): six presets in one flat row
 * read as complete at three, and grouping by the side each preset actually configures
 * is also just a more honest label than one undifferentiated row. Grouped by
 * `preset.config.side` rather than a hardcoded list, so a future preset lands in the
 * right group automatically.
 */
export function PresetStrip({ config, onApply }: PresetStripProps) {
  return (
    <div className="rail-group">
      <div className="rail-group-label">Presets</div>
      <div className="preset-groups">
        {GROUPS.map((g) => {
          const presets = bySide(g.side);
          if (presets.length === 0) return null;
          return (
            <div className="preset-group" key={g.side}>
              <div className="preset-group-label">{g.label}</div>
              <div className="preset-strip">
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={presetMatchesConfig(preset, config)}
                    onClick={() => onApply(preset.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
