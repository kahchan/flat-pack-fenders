import { EditableValue } from './EditableValue';
import { clampSliderEdit, type SliderItem } from '../../lib/controlText';
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
            <div className="slider-item__value-group">
              {item.key === 'measuredR' && (config.measuredR as number) > 0 && (
                <button
                  type="button"
                  className="slider-item__estimate-reset"
                  onClick={() => setField('measuredR' as ConfigKey, 0 as FenderConfig[ConfigKey])}
                >
                  Use estimate
                </button>
              )}
              <EditableValue
                id={`slider-value-${item.key}`}
                display={item.display}
                editValue={item.editValue}
                onCommit={(raw) => {
                  const clamped = clampSliderEdit(item, raw);
                  if (clamped !== null) setField(item.key, clamped as FenderConfig[typeof item.key]);
                }}
              />
            </div>
          </div>
          <input
            id={`slider-${item.key}`}
            type="range"
            min={item.min}
            max={item.max}
            step={item.step}
            value={item.editValue}
            onChange={(e) => setField(item.key, Number(e.target.value) as FenderConfig[typeof item.key])}
          />
          <div className="slider-item__hint">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}
