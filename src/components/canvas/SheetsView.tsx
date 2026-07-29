import { CrossSectionView } from './CrossSectionView';
import { EngineeringNotes } from './EngineeringNotes';
import { SheetA } from './SheetA';
import { SheetB } from './SheetB';
import type { DrawingModel } from '../../fender/types';

interface SheetsViewProps {
  model: DrawingModel;
}

/** "Construction sheets" tab. Design source lines 100-198. */
export function SheetsView({ model }: SheetsViewProps) {
  return (
    <div className="sheets-stack">
      <SheetA config={model.config} g={model.geo} blank={model.blank} tiling={model.tiling} />
      <SheetB config={model.config} parts={model.parts} />
      <CrossSectionView xsec={model.xsec} />
      <EngineeringNotes notes={model.notes} />
    </div>
  );
}
