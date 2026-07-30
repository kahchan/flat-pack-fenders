import { OV, PH, PW, TONGUE_L, WHEELS, f0, f1 } from './defaults';
import { geo } from './geometry';
import { buildBlank } from './pattern';
import type { BlankModel, FenderConfig, Geometry, PrintTile, TileRect, TilingModel } from './types';

/**
 * A4 print tiling for Sheet A.
 *
 * PLAN §9.4 — the design computes `rows` from `g.Wd` alone, but the on-screen viewBox
 * (and this port's `BlankModel.bboxH`) uses `nest ? Wd*2+10 : Wd`. With nesting on, the
 * nested second fender never reached the printed sheets. Fixed here: `rows` comes from
 * `blank.bboxH`, not `g.Wd`. Everything else — cols, tile placement, ruler — is
 * unchanged from the source.
 */
export function buildTiling(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g)
): TilingModel {
  const { bboxW, bboxH } = blank;
  const stepX = PW - OV;
  const stepY = PH - OV;
  const cols = Math.max(1, Math.ceil((bboxW + 12 - OV) / stepX));
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
        label: `Sheet A — tile ${r + 1}·${c + 1} of ${rows}·${cols}`,
        meta: `${WHEELS[s.wheel].label} · ${f0(g.cov)}° · 1:1`,
        viewBox: `${f1(ox)} ${f1(oy)} ${PW} ${PH}`,
        frame: `M ${f1(ox)},${f1(oy)} h ${PW} v ${PH} h ${-PW} Z`,
        ruler: `M ${f1(ox + 8)},${f1(oy + PH - 10)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
        rulerX: f1(ox + 8),
        rulerY: f1(oy + PH - 14)
      });
    }
  }

  const sheetCount = rows * cols + 2; // + Sheet B + instructions
  const nestTransform = s.nest ? `translate(${f1(g.L)}, ${f1(g.Wd * 2 + 10)}) rotate(180)` : null;

  return { cols, rows, sheetCount, lastRowH, rects, tiles, nestTransform };
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
