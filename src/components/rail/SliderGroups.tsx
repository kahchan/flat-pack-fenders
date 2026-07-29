import { useMemo } from 'react';
import { buildSliderGroups } from '../../lib/controlText';
import type { ConfigKey, FenderConfig, Geometry } from '../../fender/types';

interface SliderGroupsProps {
  config: FenderConfig;
  g: Geometry;
  finished: number;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

/** The five slider groups: Tyre & clearance, Fender, Coverage, Flaps, Struts & mudflap.
 * Design source lines 290-304. */
export function SliderGroups({ config, g, finished, setField }: SliderGroupsProps) {
  const groups = useMemo(() => buildSliderGroups(config, g, finished), [config, g, finished]);

  return (
    <div className="slider-groups">
      {groups.map((group) => (
        <div key={group.title} className="rail-group">
          <div className="rail-group-label">{group.title}</div>
          <div className="slider-group">
            {group.items.map((item) => (
              <div key={item.key} className="slider-item">
                <div className="slider-item__head">
                  <label htmlFor={`slider-${item.key}`}>{item.label}</label>
                  <span className="slider-item__value mono">{item.display}</span>
                </div>
                <input
                  id={`slider-${item.key}`}
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={config[item.key] as number}
                  onChange={(e) => setField(item.key, Number(e.target.value) as FenderConfig[typeof item.key])}
                />
                <div className="slider-item__hint">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
