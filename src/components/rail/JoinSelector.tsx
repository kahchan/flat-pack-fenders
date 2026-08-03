import { OptionButton } from './OptionButton';
import { f0, f1 } from '../../fender/defaults';
import { flapsForLap, geo, joinFits, skirtForLap } from '../../fender/geometry';
import type { ConfigKey, FenderConfig, JoinKey } from '../../fender/types';

interface JoinSelectorProps {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
}

const JOINS: { k: JoinKey; label: string; note: string }[] = [
  { k: 'none', label: 'Hole-free', note: 'scored channel, tie round the girth' },
  { k: 'cinch', label: 'Cinch tie', note: 'one hole per panel, outside the lap' },
  { k: 'rivet', label: 'Rivets', note: '3.2 mm holes, straight through the lap' },
  { k: 'zip', label: 'Zip ties', note: '4 mm holes top and bottom, no tools' },
  { k: 'slot', label: 'Punched tab', note: 'integral tongue through a slot, no hardware' }
];

/**
 * WP23 §23.3/§23.4 (decision C3): every join is always shown, never disabled — each
 * carries whichever it fits or needs, computed from the actual lap this config has,
 * not a canned string. Design source lines 306-316.
 */
export function JoinSelector({ config, setField }: JoinSelectorProps) {
  const g = geo(config);
  const fits = joinFits(g);

  return (
    <div className="rail-group">
      <div className="rail-group-label">Flap join</div>
      <div className="option-list">
        {JOINS.map((o) => {
          const fit = fits.find((f) => f.join === o.k)!;
          let note = o.note;
          if (!fit.fits) {
            const maxFlaps = flapsForLap(g, fit.needed);
            const neededSkirt = skirtForLap(g, fit.needed);
            const remedies = [
              maxFlaps !== null && maxFlaps < config.flaps ? `${maxFlaps} sections` : null,
              neededSkirt !== null ? `a ${f0(neededSkirt)} mm skirt` : null
            ].filter((r): r is string => r !== null);
            note = `needs ${f0(fit.needed)} mm of lap, you have ${f1(g.lap)} mm${
              remedies.length > 0 ? `: ${remedies.join(' or ')} would do it` : ''
            }`;
          }
          return (
            <OptionButton
              key={o.k}
              label={o.label}
              note={note}
              selected={config.join === o.k}
              emphasis="dark"
              onClick={() => setField('join', o.k)}
            />
          );
        })}
      </div>
    </div>
  );
}
