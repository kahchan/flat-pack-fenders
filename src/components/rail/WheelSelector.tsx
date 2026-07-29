import { WHEELS } from '../../fender/defaults';
import { OptionButton } from './OptionButton';
import type { ConfigKey, FenderConfig, WheelKey } from '../../fender/types';

interface WheelSelectorProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

/** Design source lines 281-288. */
export function WheelSelector({ config, setField }: WheelSelectorProps) {
  return (
    <div className="rail-group">
      <div className="rail-group-label">Wheel</div>
      <div className="option-grid">
        {(Object.keys(WHEELS) as WheelKey[]).map((k) => (
          <OptionButton
            key={k}
            label={WHEELS[k].label}
            selected={config.wheel === k}
            emphasis="dark"
            compact
            onClick={() => setField('wheel', k)}
          />
        ))}
      </div>
    </div>
  );
}
