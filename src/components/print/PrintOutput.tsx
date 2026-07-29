import { PrintInstructionsPage } from './PrintInstructionsPage';
import { PrintSheetBPage } from './PrintSheetBPage';
import { PrintTilePage } from './PrintTilePage';
import type { DrawingModel } from '../../fender/types';

interface PrintOutputProps {
  model: DrawingModel;
}

/**
 * The whole print tree — one page per Sheet A tile, then Sheet B, then assembly
 * instructions. Rendered always; hidden by `.print-only` in global.css (flipped back on
 * for `@media print`) so `window.print()` needs no async step. Design source lines
 * 375-434.
 */
export function PrintOutput({ model }: PrintOutputProps) {
  const { config, blank, parts, tiling, steps, printSpecLine } = model;
  return (
    <div className="print-only">
      {tiling.tiles.map((tile, i) => (
        <PrintTilePage key={i} tile={tile} config={config} blank={blank} nestTransform={tiling.nestTransform} />
      ))}
      <PrintSheetBPage parts={parts} />
      <PrintInstructionsPage printSpecLine={printSpecLine} steps={steps} />
    </div>
  );
}
