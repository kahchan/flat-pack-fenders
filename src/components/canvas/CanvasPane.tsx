import { useState } from 'react';
import { hasVisibleWarnings, warningsKey } from '../../lib/warningsDismiss';
import { AssembledPreview } from './AssembledPreview';
import { AssemblyView } from './AssemblyView';
import { SheetTabs } from './SheetTabs';
import { SheetsView } from './SheetsView';
import { WarningsBanner } from './WarningsBanner';
import type { Tab } from '../../state/useFenderConfig';
import type { DrawingModel } from '../../fender/types';

interface CanvasPaneProps {
  model: DrawingModel;
  spin: number;
  onSpinChange: (spin: number) => void;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}

/**
 * The left, scrolling half of the desk layout: assembled preview, warnings, tabs, and
 * either the construction sheets or the assembly/print pages.
 *
 * Warning dismissal is view state, not part of `FenderConfig` (§9.7's reset already
 * leaves it untouched deliberately) and isn't in `useFenderConfig`'s contract, so it
 * lives here rather than being threaded down from App.
 */
export function CanvasPane({ model, spin, onSpinChange, tab, onTabChange }: CanvasPaneProps) {
  const [dismissedKey, setDismissedKey] = useState('');
  const visible = hasVisibleWarnings(model.warnings, dismissedKey);

  return (
    <div className="canvas-pane screen-only">
      <AssembledPreview
        iso={model.iso}
        assembledLabel={model.assembledLabel}
        spin={spin}
        onSpinChange={onSpinChange}
      />

      <WarningsBanner
        warnings={model.warnings}
        visible={visible}
        onDismiss={() => setDismissedKey(warningsKey(model.warnings))}
      />

      <SheetTabs tab={tab} onChange={onTabChange} />

      {tab === 'sheets' ? <SheetsView model={model} /> : <AssemblyView model={model} />}
    </div>
  );
}
