import { PrintCombinedPage } from './PrintCombinedPage';
import { PrintInstructionsPage } from './PrintInstructionsPage';
import { PrintTilePage } from './PrintTilePage';
import type { DrawingModel } from '../../fender/types';

interface PrintOutputProps {
  model: DrawingModel;
}

/**
 * The whole print tree — one full page per Sheet A tile row before the last, then
 * combined pages packing the last row with Sheet B (PLAN FEEDBACK WP15 §15.3), then
 * assembly instructions. Rendered always; hidden by `.print-only` in global.css
 * (flipped back on for `@media print`) so `window.print()` needs no async step. Design
 * source lines 375-434.
 */
export function PrintOutput({ model }: PrintOutputProps) {
  const { blank, parts, tiling, printLayout, steps, printSpecLine } = model;
  return (
    <div className="print-only">
      {printLayout.fullTileIndices.map((i) => (
        <PrintTilePage key={`tile-${i}`} tile={tiling.tiles[i]!} blank={blank} />
      ))}
      {printLayout.pages.map((page, i) => (
        <PrintCombinedPage
          key={`combined-${i}`}
          page={page}
          tiling={tiling}
          parts={parts}
          blank={blank}
          pageIndex={i}
          pageCount={printLayout.pages.length}
        />
      ))}
      <PrintInstructionsPage printSpecLine={printSpecLine} steps={steps} />
    </div>
  );
}
