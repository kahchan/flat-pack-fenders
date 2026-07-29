import { useMemo, useState } from 'react';
import { CanvasPane } from './components/canvas/CanvasPane';
import { PrintOutput } from './components/print/PrintOutput';
import { BottomSheet } from './components/rail/BottomSheet';
import { ControlRail } from './components/rail/ControlRail';
import { PresetChipStrip } from './components/rail/PresetChipStrip';
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
 *   `BottomSheet`, with a compact `PresetChipStrip` in its peek header standing in for
 *   the full-size preset cards (suppressed via `showPresets={false}`).
 *
 * `useBreakpoint` mounts exactly one of the three, so there's never more than one copy
 * of the interactive controls in the DOM.
 */
export function App() {
  const { config, setField, applyPreset, reset, spin, setSpin, tab, setTab } = useFenderConfig();
  const model = useMemo(() => buildModel(config, spin), [config, spin]);
  const breakpoint = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="app-shell screen-only" data-theme="light">
        <CanvasPane model={model} spin={spin} onSpinChange={setSpin} tab={tab} onTabChange={setTab} />

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
          <BottomSheet
            specLine={model.assembledLabel}
            presetSlot={<PresetChipStrip config={config} onApply={applyPreset} />}
          >
            <ControlRail
              model={model}
              setField={setField}
              applyPreset={applyPreset}
              reset={reset}
              showPresets={false}
            />
          </BottomSheet>
        )}
      </div>
      <PrintOutput model={model} />
    </>
  );
}
