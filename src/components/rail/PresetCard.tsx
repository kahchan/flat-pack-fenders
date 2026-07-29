import { useMemo } from 'react';
import { buildCrossSection } from '../../fender/crossSection';
import { geo } from '../../fender/geometry';
import type { Preset } from '../../state/presets';

interface PresetCardProps {
  preset: Preset;
  selected: boolean;
  onClick: () => void;
}

/**
 * One preset card: a live mini cross-section rendered straight from
 * `crossSection.ts` at the preset's own config — no image assets (PLAN §5).
 */
export function PresetCard({ preset, selected, onClick }: PresetCardProps) {
  const xsec = useMemo(() => buildCrossSection(preset.config, geo(preset.config)), [preset.config]);

  return (
    <button
      type="button"
      className={`preset-card${selected ? ' preset-card--selected' : ''}`}
      onClick={onClick}
    >
      <svg className="preset-card__thumb" viewBox={xsec.viewBox} preserveAspectRatio="xMidYMid meet">
        {xsec.paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw * 1.6} strokeDasharray={p.dash} />
        ))}
      </svg>
      <span className="preset-card__name">{preset.name}</span>
      <span className="preset-card__spec mono">{preset.spec}</span>
    </button>
  );
}
