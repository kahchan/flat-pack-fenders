import { useMemo } from 'react';
import { stockNotes } from '../../lib/controlText';
import { OptionButton } from './OptionButton';
import type { ConfigKey, FenderConfig, Geometry, StockKey } from '../../fender/types';

interface StockSelectorProps {
  config: FenderConfig;
  g: Geometry;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

/** Design source lines 318-328. */
export function StockSelector({ config, g, setField }: StockSelectorProps) {
  const notes = useMemo(() => stockNotes(g), [g]);
  const options: { k: StockKey; label: string; note: string }[] = [
    { k: 'single', label: 'One sheet', note: notes.single },
    { k: 'a4', label: 'A4 panels, lapped', note: notes.a4 }
  ];

  return (
    <div className="rail-group">
      <div className="rail-cluster-label">Stock</div>
      <div className="option-list">
        {options.map((o) => (
          <OptionButton
            key={o.k}
            label={o.label}
            note={o.note}
            selected={config.stock === o.k}
            emphasis="dark"
            onClick={() => setField('stock', o.k)}
          />
        ))}
      </div>
    </div>
  );
}
