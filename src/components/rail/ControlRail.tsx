import { ActionButtons } from './ActionButtons';
import { JoinSelector } from './JoinSelector';
import { OptionToggles } from './OptionToggles';
import { PresetStrip } from './PresetStrip';
import { SideSelector } from './SideSelector';
import { SliderGroups } from './SliderGroups';
import { SpecTable } from './SpecTable';
import { StockSelector } from './StockSelector';
import { WheelSelector } from './WheelSelector';
import type { ConfigKey, DrawingModel, FenderConfig } from '../../fender/types';

interface ControlRailProps {
  model: DrawingModel;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
  applyPreset: (id: string) => void;
  reset: () => void;
  /** WP8: the phone bottom sheet shows its own compact `PresetChipStrip` in the peek
   * header, so it embeds this same rail content with the desktop preset cards suppressed
   * rather than showing presets twice. Desk and the tablet drawer both want them. */
  showPresets?: boolean;
}

/** The fixed 392px right-hand rail. Design source lines 259-372. */
export function ControlRail({ model, setField, applyPreset, reset, showPresets = true }: ControlRailProps) {
  const { config, geo: g, xsec, specs } = model;

  return (
    <aside className="control-rail screen-only">
      <div>
        <div className="rail-kicker">Open source · v0.3</div>
        <h1 className="rail-title">Flat-pack fender</h1>
        <p className="rail-lede">
          One flat blank, darted flaps that pull it into a U, separate struts and mudflap. Print at
          1:1, cut, fasten.
        </p>
      </div>

      <div className="rail-divider" />

      {showPresets && <PresetStrip config={config} onApply={applyPreset} />}

      <SideSelector config={config} setField={setField} />
      <WheelSelector config={config} setField={setField} />

      <SliderGroups config={config} g={g} finished={xsec.finished} setField={setField} />

      <JoinSelector config={config} setField={setField} />
      <StockSelector config={config} g={g} setField={setField} />
      <OptionToggles config={config} setField={setField} />

      <div className="rail-divider" />

      <ActionButtons model={model} onReset={reset} />

      <div className="rail-divider" />

      <SpecTable specs={specs} />
    </aside>
  );
}
