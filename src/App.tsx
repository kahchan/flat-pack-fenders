import { useMemo } from 'react';
import { CanvasPane } from './components/canvas/CanvasPane';
import { ControlRail } from './components/rail/ControlRail';
import { buildModel } from './fender/index';
import { useFenderConfig } from './state/useFenderConfig';

/**
 * The desk (≥1100px) layout: scrolling canvas left, fixed 392px control rail right,
 * both 100vh. WP8 adds the tablet drawer and phone bottom sheet around this.
 */
export function App() {
  const { config, setField, applyPreset, reset, spin, setSpin, tab, setTab } = useFenderConfig();
  const model = useMemo(() => buildModel(config, spin), [config, spin]);

  return (
    <div className="app-shell screen-only" data-theme="light">
      <CanvasPane model={model} spin={spin} onSpinChange={setSpin} tab={tab} onTabChange={setTab} />
      <ControlRail model={model} setField={setField} applyPreset={applyPreset} reset={reset} />
    </div>
  );
}
