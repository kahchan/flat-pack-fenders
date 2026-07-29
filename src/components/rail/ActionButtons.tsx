import { useCallback } from 'react';
import { Button } from '../ui/Button';
import { downloadText, exportFilename } from '../../lib/download';
import { buildDxf } from '../../export/dxf';
import { buildSvg } from '../../export/svg';
import type { DrawingModel } from '../../fender/types';

interface ActionButtonsProps {
  model: DrawingModel;
  onReset: () => void;
}

/** Print / Reset / Export SVG / Export DXF. Design source lines 347-356. Both exports
 * are 1 unit = 1 mm; layout matches — cut lines separated from folds by Inkscape layer. */
export function ActionButtons({ model, onReset }: ActionButtonsProps) {
  const exportSvg = useCallback(() => {
    downloadText(exportFilename(model.baseName, 'svg'), buildSvg(model), 'image/svg+xml');
  }, [model]);

  const exportDxf = useCallback(() => {
    downloadText(exportFilename(model.baseName, 'dxf'), buildDxf(model), 'application/dxf');
  }, [model]);

  return (
    <>
      <div className="action-row">
        <Button variant="primary" size="lg" onClick={() => window.print()}>
          Print pattern
        </Button>
        <Button variant="ghost" size="lg" onClick={onReset}>
          Reset
        </Button>
      </div>
      <div className="action-row">
        <Button variant="secondary" size="lg" onClick={exportSvg}>
          Export SVG
        </Button>
        <Button variant="secondary" size="lg" onClick={exportDxf}>
          Export DXF
        </Button>
      </div>
      <p className="rail-footnote">
        Both export at 1 unit = 1 mm, cut lines separated from fold lines by layer, ready for a
        laser or plotter.
      </p>
      <p className="rail-footnote">
        Print at 100%, margins &ldquo;none&rdquo; — never &ldquo;fit to page&rdquo;. Every sheet
        carries a 100 mm ruler; measure it before cutting.
      </p>
    </>
  );
}
