import { useMemo, useState } from 'react';
import { CanvasPane } from './components/canvas/CanvasPane';
import { PrintOutput } from './components/print/PrintOutput';
import { BottomSheet } from './components/rail/BottomSheet';
import { ControlRail } from './components/rail/ControlRail';
import { RailDrawer } from './components/rail/RailDrawer';
import { RailPill } from './components/rail/RailPill';
import { useBreakpoint } from './components/responsive/useBreakpoint';
import { buildModel } from './fender/index';
import { useFenderConfig } from './state/useFenderConfig';

/**
 * Three layouts off one shared component tree, PLAN §4:
 *
 * - **Desk (≥1100px):** exactly the original two-pane shell — canvas left, fixed 392px
 *   `ControlRail` right. Untouched by WP8.
 * - **Tablet (760-1099px):** canvas full width; `ControlRail` moves into `RailDrawer`, an
 *   overlay opened by the floating `RailPill`.
 * - **Phone (<760px):** canvas full width, single column; `ControlRail` moves into
 *   `BottomSheet`, whose peek is the shared `ControlHeader` (WP22 B4) standing in for the
 *   rail's own header (suppressed via `showHeader={false}`).
 */
export function App() {
  const { config, setField, applyPreset, reset, spin, setSpin } = useFenderConfig();
  const model = useMemo(() => buildModel(config, spin), [config, spin]);
  const breakpoint = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="app-shell screen-only" data-theme="light">
        <CanvasPane model={model} spin={spin} onSpinChange={setSpin} />

        {breakpoint === 'desk' && (
          <ControlRail model={model} setField={setField} applyPreset={applyPreset} reset={reset} />
        )}

        {breakpoint === 'tablet' && (
          <>
            <RailPill specLine={model.assembledLabel} onOpen={() => setDrawerOpen(true)} />
            <RailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
              <ControlRail model={model} setField={setField} applyPreset={applyPreset} reset={reset} />
            </RailDrawer>
          </>
        )}

        {breakpoint === 'phone' && (
          <BottomSheet config={config} applyPreset={applyPreset}>
            <ControlRail
              model={model}
              setField={setField}
              applyPreset={applyPreset}
              reset={reset}
              showHeader={false}
            />
          </BottomSheet>
        )}
      </div>
      <PrintOutput model={model} />
    </>
  );
}
