import { useMemo } from 'react';
import { CanvasPane } from './components/canvas/CanvasPane';
import { PrintOutput } from './components/print/PrintOutput';
import { ControlRail } from './components/rail/ControlRail';
import { buildModel } from './fender/index';
import { useFenderConfig } from './state/useFenderConfig';

/**
 * The desk (≥1100px) layout: scrolling canvas left, fixed 392px control rail right,
 * both 100vh. WP8 adds the tablet drawer and phone bottom sheet around this.
 *
 * `PrintOutput` renders alongside the screen shell, always in the DOM — `.print-only`
 * (global.css) hides it on screen and shows it under `@media print`, so `window.print()`
 * needs no async step. See PLAN §9.4 / WP9.
 */
export function App() {
  const { config, setField, applyPreset, reset, spin, setSpin, tab, setTab } = useFenderConfig();
  const model = useMemo(() => buildModel(config, spin), [config, spin]);

  return (
    <>
      <div className="app-shell screen-only" data-theme="light">
        <CanvasPane model={model} spin={spin} onSpinChange={setSpin} tab={tab} onTabChange={setTab} />
        <ControlRail model={model} setField={setField} applyPreset={applyPreset} reset={reset} />
      </div>
      <PrintOutput model={model} />
    </>
  );
}
