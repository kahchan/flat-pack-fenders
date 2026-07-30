import { SheetATileSvg } from './SheetATileSvg';
import type { BlankModel, FenderConfig, PrintTile } from '../../fender/types';

interface PrintTilePageProps {
  tile: PrintTile;
  config: FenderConfig;
  blank: BlankModel;
  nestTransform: string | null;
}

/**
 * One full A4-landscape page per print tile, for every row except the last — the last
 * row is usually much shorter than a full page and shares one with Sheet B instead
 * (`PrintCombinedPage`, PLAN FEEDBACK WP15 §15.3).
 */
export function PrintTilePage({ tile, config, blank, nestTransform }: PrintTilePageProps) {
  return (
    <div className="print-page">
      <div className="print-page__label">{tile.label}</div>
      <div className="print-page__meta">{tile.meta}</div>
      <SheetATileSvg tile={tile} width="267mm" height="180mm" config={config} blank={blank} nestTransform={nestTransform} />
    </div>
  );
}
