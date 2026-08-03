import { PH, PRINT_CAPTION_H, PW } from './defaults';
import { packRects } from './packer';
import type { PartsModel, PrintLayout, TilingModel } from './types';

/**
 * Combines Sheet A's last tile row with Sheet B onto shared physical pages (PLAN
 * FEEDBACK WP15 §15.3).
 *
 * Every Sheet-A row before the last is necessarily a full `PH`-tall page — there is
 * more blank below it. The last row (`tiling.lastRowH`) and Sheet B's own pages (each
 * packed to `PARTS_PH`, not their real content height) are usually much shorter than
 * that, so both get handed to the SAME shelf packer WP12 built for Sheet B
 * (`packRects`) — reused here rather than writing a second one — treating each as a
 * `PW`-wide, real-height rectangle to place on `PW × PH` physical pages.
 *
 * Every rect this function builds is exactly `PW` wide, i.e. already the full page
 * width — `packer.ts`'s rotated orientation would be `PW` tall, which can never fit a
 * `PH`-tall page (`PW > PH`), so nothing here is ever rotated. That's what makes
 * reusing the generic packer safe without any rotation-aware rendering: a Sheet-A tile
 * or Sheet-B page rotated 90° would be meaningless without also rotating its content,
 * which this function never has to do.
 */
export function buildPrintLayout(tiling: TilingModel, parts: PartsModel): PrintLayout {
  const lastRowStart = (tiling.rows - 1) * tiling.cols;
  const fullTileIndices: number[] = [];
  for (let i = 0; i < lastRowStart; i++) fullTileIndices.push(i);

  // Each rect's height includes PRINT_CAPTION_H, reserving room for its own caption
  // above its content — stripped back out below once placed, so `slot.h`/`slot.y`
  // describe the CONTENT band only, and the caption sits at `slot.y - PRINT_CAPTION_H`.
  const rects: { id: string; w: number; h: number }[] = [];
  for (let c = 0; c < tiling.cols; c++) {
    rects.push({ id: `A${lastRowStart + c}`, w: PW, h: tiling.lastRowH + PRINT_CAPTION_H });
  }
  parts.pages.forEach((page, i) => {
    // `part.h` is the pre-rotation LOCAL size (PLAN §12's `PackedPart.h` doc comment) —
    // a rotated part's real vertical extent on the page is its (pre-rotation) `w`
    // instead. WP21 §21.1 exposed this: a strap-ended strut's taller paddle can push a
    // wide, short part like the mudflap into rotating to still fit `PARTS_PH`, and the
    // unrotated `h` understated the page's real used height enough to overflow `PH`.
    const usedH = page.parts.reduce((m, p) => Math.max(m, p.y + (p.rotated ? p.w : p.h)), 0);
    rects.push({ id: `B${i}`, w: PW, h: Math.max(1, usedH) + PRINT_CAPTION_H });
  });

  const placed = packRects(rects, PW, PH);
  const pageCount = placed.reduce((m, p) => Math.max(m, p.page + 1), 0);
  const pages: PrintLayout['pages'] = Array.from({ length: pageCount }, () => ({ slots: [] }));
  for (const p of placed) {
    const kind = p.id.startsWith('A') ? 'sheetA' : 'sheetB';
    const index = Number(p.id.slice(1));
    pages[p.page]!.slots.push({ kind, index, y: p.y + PRINT_CAPTION_H, h: p.h - PRINT_CAPTION_H });
  }

  return {
    fullTileIndices,
    pages,
    pageCount: fullTileIndices.length + pages.length + 1 // + the instructions page
  };
}
