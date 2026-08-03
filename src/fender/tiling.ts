import { LAP, OV, PH, PW, TONGUE_L, WHEELS, f0, f1 } from './defaults';
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
  const cols = Math.max(1, Math.ceil((bboxW + 12 - overlapX) / stepX));
  const rows = Math.max(1, Math.ceil((bboxH + 12 - OV) / stepY));
  const x0 = (s.tongue ? -TONGUE_L : 0) - 6;

  // PLAN FEEDBACK WP15 §15.3 — every row before the last is necessarily full (there is
  // more content below it), but the last row's real content is often much shorter than
  // PH: it only needs to reach the bottom of the blank, not the bottom of a nominal PH
  // tile. `buildPrintLayout` (src/fender/printLayout.ts) uses the leftover room this
  // frees to pack the last row alongside Sheet B on shared physical pages, instead of
  // giving it a whole page no matter how little of it is used.
  const lastRowH = Math.max(1, Math.min(PH, bboxH + 12 - (rows - 1) * stepY));

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
        ruler: `M ${f1(ox + 8)},${f1(oy + PH - 10)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
        rulerX: f1(ox + 8),
        rulerY: f1(oy + PH - 14)
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
    ruler: `M ${f1(ox + 8)},${f1(oy + h - 10)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
    rulerX: f1(ox + 8),
    rulerY: f1(oy + h - 14)
  };
}
