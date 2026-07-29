import { AssemblySteps } from './AssemblySteps';
import { PrintTiles } from './PrintTiles';
import type { DrawingModel } from '../../fender/types';

interface AssemblyViewProps {
  model: DrawingModel;
}

/** "Assembly & print pages" tab. Design source lines 200-255. */
export function AssemblyView({ model }: AssemblyViewProps) {
  const tileCountLabel = `${model.tiling.sheetCount} sheets A4 landscape`;

  return (
    <div className="assembly-stack">
      <PrintTiles tiles={model.tiling.tiles} blank={model.blank} tileCountLabel={tileCountLabel} />
      <AssemblySteps steps={model.steps} />
    </div>
  );
}
