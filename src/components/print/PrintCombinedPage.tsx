import { PRINT_CAPTION_H, PW } from '../../fender/defaults';
import { croppedTile } from '../../fender/tiling';
import { SheetATileSvg } from './SheetATileSvg';
import { SheetBPageSvg } from './SheetBPageSvg';
import type { BlankModel, FenderConfig, PartsModel, PrintPage, TilingModel } from '../../fender/types';

interface PrintCombinedPageProps {
  page: PrintPage;
  tiling: TilingModel;
  parts: PartsModel;
  config: FenderConfig;
  blank: BlankModel;
  pageIndex: number;
  pageCount: number;
}

/**
 * One physical A4 page holding one or more slots — the shrunk last Sheet-A tile row
 * and/or Sheet B's own pages, packed together by `buildPrintLayout`'s reuse of the
 * Sheet-B packer (PLAN FEEDBACK WP15 §15.3) instead of each claiming a whole page no
 * matter how little of it is used. Every slot still draws at true 1:1 — stacking only
 * changes WHERE on the physical sheet a slot's content sits, never how big it is.
 */
export function PrintCombinedPage({ page, tiling, parts, config, blank, pageIndex, pageCount }: PrintCombinedPageProps) {
  return (
    <div className="print-page print-page--combined">
      <div className="print-page__meta">
        Combined page {pageIndex + 1} of {pageCount}
      </div>
      {page.slots.map((slot, i) => {
        const captionTop = `-${PRINT_CAPTION_H}mm`;
        if (slot.kind === 'sheetA') {
          const tile = croppedTile(tiling.tiles[slot.index]!, slot.h);
          return (
            <div key={i} className="print-slot" style={{ top: `${slot.y}mm` }}>
              <div className="print-slot__caption" style={{ top: captionTop }}>
                {tile.label}
              </div>
              <SheetATileSvg
                tile={tile}
                width={`${PW}mm`}
                height={`${slot.h}mm`}
                config={config}
                blank={blank}
                nestTransform={tiling.nestTransform}
              />
            </div>
          );
        }
        const partsPage = parts.pages[slot.index]!;
        return (
          <div key={i} className="print-slot" style={{ top: `${slot.y}mm` }}>
            <div className="print-slot__caption" style={{ top: captionTop }}>
              Sheet B, struts, mudflap &amp; hardware, 1:1, page {slot.index + 1} of {parts.pages.length}
            </div>
            <SheetBPageSvg page={partsPage} height={slot.h} />
          </div>
        );
      })}
    </div>
  );
}
