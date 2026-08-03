import type { SliderItem } from '../../lib/controlText';
import type { ConfigKey, FenderConfig } from '../../fender/types';

interface SliderListProps {
  items: SliderItem[];
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

/**
 * A flat list of sliders. WP22 §22.2 replaced the five fixed groups with an
 * essentials/fine-tuning split — this component no longer owns the grouping (that's
 * `ControlRail`'s cluster headings), it just renders whichever items it's handed.
 */
export function SliderGroups({ items, config, setField }: SliderListProps) {
  return (
    <div className="slider-group">
      {items.map((item) => (
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
  );
}
