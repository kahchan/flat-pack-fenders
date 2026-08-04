import { LAP, OV, PH, PRINT_CAPTION_H, PW, WHEELS, f0, f1, tileOriginX } from './defaults';
import { geo } from './geometry';
import { buildBlank } from './pattern';
import type { BlankModel, FenderConfig, Geometry, PrintTile, TileRect, TilingModel } from './types';

/**
 * A4 print tiling for Sheet A. `rows` comes from `blank.bboxH` (which, before WP20
 * removed nesting outright, could differ from `g.Wd` when a second fender was nested
 * onto the same sheet — see PLAN §9.4's original fix, now moot).
 */
export function buildTiling(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g)
): TilingModel {
  const { bboxW, bboxH } = blank;
  // WP19 §19.1: for `a4` stock the tile step IS the panel step (`LAP`, not the plain
  // registration `OV`) — one printed tile is one material panel. `single` stock has no
  // panels, so its tiles keep the smaller registration-only overlap.
  const overlapX = s.stock === 'a4' ? LAP : OV;
  const stepX = PW - overlapX;
  const stepY = PH - OV;
  // WP27 §27.3's other invariant: `panelCount === cols` used to be two independent
  // `ceil()` formulas that happened to agree on every shipped preset, with nothing
  // enforcing it. For `a4` stock a tile IS a panel (WP19 B1), so `cols` now just reads
  // `blank.panelCount` — the SAME number, not a second formula computing it again. Only
  // `single` stock (no panels at all) keeps its own tile-only ceiling.
  const cols = s.stock === 'a4' ? blank.panelCount : Math.max(1, Math.ceil((bboxW + 12 - overlapX) / stepX));
  const x0 = tileOriginX(s);

  // WP27 §27.3: `bboxH` is the plain outline height, but the panel-seam annotations
  // ("SEAM n: CUT PANEL n…", "PANEL n: WHEEL SIDE…") are deliberately drawn a few mm
  // below the free edge (`pattern.ts`'s `yFreeB(xm) + 9`), and the calibration ruler
  // needs its own clear band below whatever is drawn lowest. Both were clipped/
  // overprinted because the crop height was sized to `bboxH` alone — the label sat
  // right at the edge of the old `+12` fudge, and the ruler at a fixed `PH - 10` had no
  // idea the label was there at all. `contentH` is the real lowest extent (labels
  // included, +3 mm for glyph descent); `TAIL_MARGIN` (was a bare `12`) now reserves
  // enough room below it for the ruler mark AND its caption text to sit fully clear —
  // see the ruler's own vertical footprint below.
  const labelMaxY = blank.labels.reduce((m, l) => Math.max(m, Number(l.y)), 0);
  const contentH = Math.max(bboxH, labelMaxY + 3);
  // The ruler's tick line sits at `h - 5` and its caption baseline at `h - 9` (4 px
  // font, ~3 mm of ascent) — a ~10 mm band spanning roughly `[h - 12, h - 2]`. Reserving
  // 20 mm below `contentH` puts that whole band clear of the label by construction
  // rather than by however much room happened to be left over — except on the two
  // presets whose real content is tall enough that `lastRowH`'s own `PH -
  // PRINT_CAPTION_H` cap (below) bites before the full 20 mm is available; there the
  // margin narrows to whatever the cap leaves (never below ~4 mm on any shipped
  // preset), which is why the ruler sits close to the tile's bottom edge rather than
  // centred in a generous band — see this package's implementation notes.
  const TAIL_MARGIN = 20;
  const rows = Math.max(1, Math.ceil((contentH + TAIL_MARGIN - OV) / stepY));

  // PLAN FEEDBACK WP15 §15.3 — every row before the last is necessarily full (there is
  // more content below it), but the last row's real content is often much shorter than
  // PH: it only needs to reach the bottom of the blank, not the bottom of a nominal PH
  // tile. `buildPrintLayout` (src/fender/printLayout.ts) uses the leftover room this
  // frees to pack the last row alongside Sheet B on shared physical pages, instead of
  // giving it a whole page no matter how little of it is used.
  //
  // WP27 §27.3 side effect: `buildPrintLayout` always adds `PRINT_CAPTION_H` on top of
  // this before packing it onto a page (its own caption band), so the real ceiling a
  // slot can be packed at is `PH - PRINT_CAPTION_H`, not `PH` — a pre-existing gap the
  // old `+12` margin never reached, but the bigger `TAIL_MARGIN` above can. Capped here,
  // once, rather than in the packer, so `lastRowH` always means "fits a page, caption
  // included" everywhere it's read.
  const lastRowH = Math.max(1, Math.min(PH - PRINT_CAPTION_H, contentH + TAIL_MARGIN - (rows - 1) * stepY));

  const rects: TileRect[] = [];
  const tiles: PrintTile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = x0 + c * stepX;
      const oy = r * stepY - 6;
      rects.push({ x: f1(ox), y: f1(oy), w: PW, h: PH });
      tiles.push({
        // PLAN FEEDBACK WP17 (decision A3) — `·` is gone in both places, but not to the
        // same character: `r+1`/`c+1` is a row-by-column COORDINATE (like a dimension),
        // so it becomes `×`, not a comma; `label`/`meta`'s own separators are a list of
        // distinct facts, so those become commas, same as everywhere else in this pass.
        label: `Sheet A, tile ${r + 1}×${c + 1} of ${rows}×${cols}`,
        meta: `${WHEELS[s.wheel].label}, ${f0(g.cov)}°, 1:1`,
        viewBox: `${f1(ox)} ${f1(oy)} ${PW} ${PH}`,
        frame: `M ${f1(ox)},${f1(oy)} h ${PW} v ${PH} h ${-PW} Z`,
        ruler: `M ${f1(ox + 8)},${f1(oy + PH - 5)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
        rulerX: f1(ox + 8),
        rulerY: f1(oy + PH - 9)
      });
    }
  }

  return { cols, rows, lastRowH, rects, tiles };
}

/**
 * A print tile cropped to a shorter real content height (PLAN FEEDBACK WP15 §15.3) —
 * same window into the pattern, same x-position and top edge, just a shorter y-extent.
 * This changes WHICH millimetres of the pattern are visible, never how many print mm
 * equal one pattern mm, so it stays true 1:1 like every other print tile.
 */
export function croppedTile(tile: PrintTile, h: number): PrintTile {
  const [oxStr, oyStr] = tile.viewBox.split(' ');
  const ox = Number(oxStr);
  const oy = Number(oyStr);
  return {
    ...tile,
    viewBox: `${f1(ox)} ${f1(oy)} ${PW} ${f1(h)}`,
    frame: `M ${f1(ox)},${f1(oy)} h ${PW} v ${f1(h)} h ${-PW} Z`,
    ruler: `M ${f1(ox + 8)},${f1(oy + h - 5)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
    rulerX: f1(ox + 8),
    rulerY: f1(oy + h - 9)
  };
}
