import { presetMatchesConfig } from '../../lib/presetMatch';
import { PresetCard } from './PresetCard';
import { PRESETS } from '../../state/presets';
import type { FenderConfig } from '../../fender/types';

interface PresetStripProps {
  config: FenderConfig;
  onApply: (id: string) => void;
}

/**
 * Horizontal-scroll preset strip, PLAN §5 — placed in the rail per WP7's brief, not the
 * WP10 slot the plan's table originally listed it under.
 */
export function PresetStrip({ config, onApply }: PresetStripProps) {
  return (
    <div className="rail-group">
      <div className="rail-group-label">Presets</div>
      <div className="preset-strip">
        {PRESETS.map((preset) => (
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
}
