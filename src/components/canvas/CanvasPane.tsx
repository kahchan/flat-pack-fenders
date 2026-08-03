import { useRef, useState } from 'react';
import { hasVisibleWarnings, warningsKey } from '../../lib/warningsDismiss';
import { AssembledPreview } from './AssembledPreview';
import { AssemblyView } from './AssemblyView';
import { DrawingSection } from './DrawingSection';
import { PrintTiles } from './PrintTiles';
import { SectionNav, type SectionNavItem } from './SectionNav';
import { SheetsView } from './SheetsView';
import { WarningsBanner } from './WarningsBanner';
import { SpecTable } from '../rail/SpecTable';
import type { DrawingModel } from '../../fender/types';

interface CanvasPaneProps {
  model: DrawingModel;
  spin: number;
  onSpinChange: (spin: number) => void;
}

/**
 * The left, scrolling half of the desk layout: assembled preview, warnings, and the
 * section nav + accordion (WP22 §22.3) that replaced `SheetTabs`.
 *
 * Warning dismissal is view state, not part of `FenderConfig` (§9.7's reset already
 * leaves it untouched deliberately) and isn't in `useFenderConfig`'s contract, so it
 * lives here rather than being threaded down from App.
 */
export function CanvasPane({ model, spin, onSpinChange }: CanvasPaneProps) {
  const [dismissedKey, setDismissedKey] = useState('');
  const visible = hasVisibleWarnings(model.warnings, dismissedKey);

  const sheetsRef = useRef<HTMLDetailsElement>(null);
  const printRef = useRef<HTMLDetailsElement>(null);
  const stepsRef = useRef<HTMLDetailsElement>(null);
  const specsRef = useRef<HTMLDetailsElement>(null);

  const navItems: SectionNavItem[] = [
    { key: 'sheets', label: 'Sheets', ref: sheetsRef },
    { key: 'print', label: 'Print pages', ref: printRef },
    { key: 'steps', label: 'Instructions', ref: stepsRef },
    { key: 'specs', label: 'Specs', ref: specsRef }
  ];

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

      <SectionNav items={navItems} />

      <DrawingSection sectionRef={sheetsRef} label="Construction sheets" defaultOpen>
        <SheetsView model={model} />
      </DrawingSection>

      <DrawingSection
        sectionRef={printRef}
        label="Print pages"
        meta={`${model.printLayout.pageCount} sheets`}
      >
        <PrintTiles tiles={model.tiling.tiles} blank={model.blank} />
      </DrawingSection>

      <DrawingSection
        sectionRef={stepsRef}
        label="Instructions"
        meta={`${model.steps.length} steps`}
      >
        <AssemblyView steps={model.steps} />
      </DrawingSection>

      <DrawingSection sectionRef={specsRef} label="Specs">
        <SpecTable specs={model.specs} />
      </DrawingSection>
    </div>
  );
}
