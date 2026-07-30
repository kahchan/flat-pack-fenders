import { OptionButton } from './OptionButton';
import { SIDE_COVERAGE } from '../../lib/sideDefaults';
import type { ConfigKey, FenderConfig, Side } from '../../fender/types';

interface SideSelectorProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

const SIDES: { k: Side; label: string; note: string }[] = [
  { k: 'front', label: 'Front', note: 'One fork-crown mount, struts to the blade eyelets' },
  { k: 'rear', label: 'Rear', note: 'Chainstay + seatstay bridge mounts, struts to the dropouts' }
];

/**
 * Design source lines 269-279. Switching side also jumps lead/trail to a sensible
 * starting coverage for that mount — see `SIDE_COVERAGE`'s doc comment for why the rear
 * pair diverges from the design's literal `60/200`.
 */
export function SideSelector({ config, setField }: SideSelectorProps) {
  const choose = (k: Side) => {
    setField('side', k);
    setField('lead', SIDE_COVERAGE[k].lead);
    setField('trail', SIDE_COVERAGE[k].trail);
  };

  return (
    <div className="rail-group">
      <div className="rail-group-label">Fender</div>
      <div className="option-grid">
        {SIDES.map((o) => (
          <OptionButton
            key={o.k}
            label={o.label}
            note={o.note}
            selected={config.side === o.k}
            emphasis="dark"
            onClick={() => choose(o.k)}
          />
        ))}
      </div>
    </div>
  );
}
