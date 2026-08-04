import { useMemo } from 'react';
import { hemHint } from '../../lib/controlText';
import { OptionButton } from './OptionButton';
import type { ConfigKey, FenderConfig } from '../../fender/types';

interface OptionTogglesProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

type ToggleKey = 'tongue' | 'hem';

/** Design source lines 330-343. WP20 §20.1 (decision B2): the "Nest a second fender"
 * toggle is gone with the feature — it was a ghost outline for planning stock layout,
 * but the printed tile grid doubled with it on, silently costing six extra sheets at
 * the default. WP21 §21.2 (decision B3): the "Sacrificial strut end" toggle is gone the
 * same way, replaced by `StrutEndSelector`'s bolt/strap choice in the Struts & mudflap
 * cluster — a two-way selector, not a toggle, since strap isn't an on/off variant of the
 * bolt end, it's a different part shape. */
export function OptionToggles({ config, setField }: OptionTogglesProps) {
  const toggles: { k: ToggleKey; label: string; note: string }[] = useMemo(
    () => [
      { k: 'tongue', label: 'Frame-mount tongue', note: 'Slotted tab at the nose: slides to take up tolerance' },
      { k: 'hem', label: 'Hemmed skirt edge', note: hemHint(config) }
    ],
    [config]
  );

  return (
    <div className="rail-group">
      <div className="rail-cluster-label">Options</div>
      <div className="option-list">
        {toggles.map((o) => {
          const on = config[o.k];
          return (
            <OptionButton
              key={o.k}
              label={o.label}
              note={o.note}
              selected={on}
              emphasis="dark"
              onClick={() => setField(o.k, !on)}
              trailing={
                <span className={`toggle-btn__state${on ? ' toggle-btn__state--on' : ''}`}>
                  {on ? 'ON' : 'OFF'}
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
