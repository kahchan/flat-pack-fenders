import { SheetATileSvg } from './SheetATileSvg';
import type { BlankModel, PrintTile } from '../../fender/types';

interface PrintTilePageProps {
  tile: PrintTile;
  blank: BlankModel;
}

/**
 * One full A4-landscape page per print tile, for every row except the last — the last
 * row is usually much shorter than a full page and shares one with Sheet B instead
 * (`PrintCombinedPage`, PLAN FEEDBACK WP15 §15.3).
 */
export function PrintTilePage({ tile, blank }: PrintTilePageProps) {
  return (
    <div className="print-page">
      <div className="print-page__label">{tile.label}</div>
      <div className="print-page__meta">{tile.meta}</div>
      <SheetATileSvg tile={tile} width="267mm" height="180mm" blank={blank} />
    </div>
  );
}
