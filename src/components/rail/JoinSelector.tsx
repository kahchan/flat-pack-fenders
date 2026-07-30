import { OptionButton } from './OptionButton';
import type { ConfigKey, FenderConfig, JoinKey } from '../../fender/types';

interface JoinSelectorProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

const JOINS: { k: JoinKey; label: string; note: string }[] = [
  { k: 'zip', label: 'Zip ties', note: '4 mm holes top and bottom · no tools' },
  { k: 'rivet', label: 'Rivets', note: '3.2 mm holes · butt straps' },
  { k: 'slot', label: 'Slot & tab', note: 'no hardware · folded clips' },
  { k: 'none', label: 'Hole-free', note: 'scored channel · tie round the girth' }
];

/** Design source lines 306-316. */
export function JoinSelector({ config, setField }: JoinSelectorProps) {
  return (
    <div className="rail-group">
      <div className="rail-group-label">Flap join</div>
      <div className="option-list">
        {JOINS.map((o) => (
          <OptionButton
            key={o.k}
            label={o.label}
            note={o.note}
            selected={config.join === o.k}
            emphasis="dark"
            onClick={() => setField('join', o.k)}
          />
        ))}
      </div>
    </div>
  );
}
