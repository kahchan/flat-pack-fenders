import { OptionButton } from './OptionButton';
import { STRUT_STRAP_W } from '../../fender/defaults';
import type { ConfigKey, FenderConfig, StrutEndKey } from '../../fender/types';

interface StrutEndSelectorProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

const STRUT_ENDS: { k: StrutEndKey; label: string; note: string }[] = [
  { k: 'bolt', label: 'Bolt / zip-tie', note: 'Pair of holes at the frame end' },
  { k: 'strap', label: 'Strap', note: `Flared paddle, two slots for a ${STRUT_STRAP_W} mm hook-and-loop strap` }
];

/** Frame-end fastening for every strut (PLAN FEEDBACK WP21 §21.2) — replaces the
 * "Sacrificial strut end" toggle: bolt/strap is a choice of part shape, not an on/off
 * option. */
export function StrutEndSelector({ config, setField }: StrutEndSelectorProps) {
  return (
    <div className="rail-group">
      <div className="rail-cluster-label">Strut frame end</div>
      <div className="option-list">
        {STRUT_ENDS.map((o) => (
          <OptionButton
            key={o.k}
            label={o.label}
            note={o.note}
            selected={config.strutEnd === o.k}
            emphasis="dark"
            onClick={() => setField('strutEnd', o.k)}
          />
        ))}
      </div>
    </div>
  );
}
