import { useMemo, useState } from 'react';
import { ActionButtons } from './ActionButtons';
import { ControlHeader } from './ControlHeader';
import { JoinSelector } from './JoinSelector';
import { OptionToggles } from './OptionToggles';
import { SideSelector } from './SideSelector';
import { SliderGroups } from './SliderGroups';
import { StockSelector } from './StockSelector';
import { StrutEndSelector } from './StrutEndSelector';
import { WheelSelector } from './WheelSelector';
import { buildEssentialSliders, buildFineTuningClusters } from '../../lib/controlText';
import type { ConfigKey, DrawingModel, FenderConfig } from '../../fender/types';

interface ControlRailProps {
  model: DrawingModel;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
  applyPreset: (id: string) => void;
  reset: () => void;
  /** WP22: the phone bottom sheet shows its own `ControlHeader` in the peek, so it embeds
   * this same rail content with the rail's own header suppressed rather than showing it
   * twice. Desk and the tablet drawer both want it. */
  showHeader?: boolean;
}

/** The fixed 392px right-hand rail, restructured by WP22 §22.2-22.3: essentials always
 * visible, everything else behind one "Fine tuning" disclosure grouped into labelled
 * clusters (headings, not a second layer of collapsibles). */
export function ControlRail({ model, setField, applyPreset, reset, showHeader = true }: ControlRailProps) {
  const { config, geo: g, xsec } = model;
  const [fineTuningOpen, setFineTuningOpen] = useState(false);

  const essentials = useMemo(() => buildEssentialSliders(config, g), [config, g]);
  const clusters = useMemo(
    () => buildFineTuningClusters(config, g, xsec.finished),
    [config, g, xsec.finished]
  );

  const clusterItems = (title: string) => clusters.find((c) => c.title === title)?.items ?? [];

  return (
    <aside className="control-rail screen-only">
      {showHeader && <ControlHeader config={config} applyPreset={applyPreset} variant="rail" />}

      <div className="rail-divider" />

      <SideSelector config={config} setField={setField} />
      <WheelSelector config={config} setField={setField} />

      <div className="rail-group">
        <div className="rail-group-label">Fit</div>
        <SliderGroups items={essentials} config={config} setField={setField} />
      </div>

      <details
        className="fine-tuning"
        open={fineTuningOpen}
        onToggle={(e) => setFineTuningOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="rail-group-label">Fine tuning</summary>

        <div className="rail-group">
          <div className="rail-group-label">Shape</div>
          <SliderGroups items={clusterItems('Shape')} config={config} setField={setField} />
        </div>

        <div className="rail-group">
          <div className="rail-group-label">Coverage</div>
          <SliderGroups items={clusterItems('Coverage')} config={config} setField={setField} />
        </div>

        <div className="rail-group">
          <div className="rail-group-label">Construction</div>
          <SliderGroups items={clusterItems('Construction')} config={config} setField={setField} />
          <JoinSelector config={config} setField={setField} />
          <StockSelector config={config} g={g} setField={setField} />
        </div>

        <div className="rail-group">
          <div className="rail-group-label">Struts &amp; mudflap</div>
          <SliderGroups items={clusterItems('Struts & mudflap')} config={config} setField={setField} />
          <StrutEndSelector config={config} setField={setField} />
        </div>

        <OptionToggles config={config} setField={setField} />
      </details>

      <div className="rail-divider" />

      <ActionButtons model={model} onReset={reset} />
    </aside>
  );
}
