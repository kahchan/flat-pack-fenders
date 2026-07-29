/**
 * A small 2D rectangle packer for Sheet B (PLAN §12). First-fit-decreasing: rects are
 * sorted by decreasing longest side, then placed shelf by shelf (a "shelf" is a
 * horizontal row spanning the page, as tall as the tallest rect placed on it so far).
 *
 * Per-rect 0°/90° rotation is allowed. Rotating the whole sheet doesn't help (PLAN §12
 * explains why — the sheet's own aspect ratio is worse rotated), but rotating one long
 * thin part frees column width for its neighbours, which a strip-packing shelf algorithm
 * captures naturally.
 *
 * Pure — no DOM, no React. This is a "handful of rectangles, not a cutting-stock
 * problem" (PLAN §12), so a simple heuristic is deliberately preferred over an optimal
 * (and much more complex) packing algorithm.
 */

export interface PackRect {
  id: string;
  w: number;
  h: number;
}

export interface PackedRect {
  id: string;
  page: number;
  x: number;
  y: number;
  /** Placed (post-rotation) width/height — swapped from the input when `rotated`. */
  w: number;
  h: number;
  rotated: boolean;
  /** True when this rect fits the page in neither orientation. Still placed (its own
   * page, natural orientation, top-left) so every input gets exactly one placement —
   * the caller decides whether that's warning-worthy (PLAN §12: a strut longer than the
   * page in both dimensions is a real constraint; needing two pages is not). */
  overflow: boolean;
}

interface Shelf {
  page: number;
  y: number;
  height: number;
  usedWidth: number;
}

export function packRects(rects: PackRect[], pageW: number, pageH: number): PackedRect[] {
  const order = [...rects].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const shelves: Shelf[] = [];
  const pageUsedHeight: number[] = [0];
  const placed: PackedRect[] = [];

  for (const rect of order) {
    const natural = { w: rect.w, h: rect.h, rotated: false };
    const rotated = { w: rect.h, h: rect.w, rotated: true };
    const orientations = [natural, rotated];

    // First-fit against every existing shelf, natural orientation before rotated.
    let onShelf = false;
    for (const shelf of shelves) {
      for (const o of orientations) {
        if (o.w <= pageW - shelf.usedWidth && o.h <= shelf.height) {
          placed.push({ id: rect.id, page: shelf.page, x: shelf.usedWidth, y: shelf.y, w: o.w, h: o.h, rotated: o.rotated, overflow: false });
          shelf.usedWidth += o.w;
          onShelf = true;
          break;
        }
      }
      if (onShelf) break;
    }
    if (onShelf) continue;

    const fitsAnyPage = (o: { w: number; h: number }) => o.w <= pageW && o.h <= pageH;
    const candidates = orientations.filter(fitsAnyPage);

    if (candidates.length === 0) {
      // Reuse the current page if it's still empty, rather than stranding it blank and
      // skipping straight to the next one.
      const currentPage = pageUsedHeight.length - 1;
      const page = pageUsedHeight[currentPage] === 0 ? currentPage : pageUsedHeight.length;
      if (page === pageUsedHeight.length) pageUsedHeight.push(natural.h);
      else pageUsedHeight[page] = Math.max(pageUsedHeight[page]!, natural.h);
      placed.push({ id: rect.id, page, x: 0, y: 0, w: natural.w, h: natural.h, rotated: false, overflow: true });
      continue;
    }

    // New shelf needed. Prefer natural orientation — rotation is a tool for when it's
    // needed, not a default — but use rotation to stay on the current page if that's
    // the difference between fitting and not.
    const currentPage = pageUsedHeight.length - 1;
    const remaining = pageH - pageUsedHeight[currentPage]!;
    const fitsRemaining = (o: { h: number }) => o.h <= remaining;
    const chosen =
      candidates.find((o) => !o.rotated && fitsRemaining(o)) ??
      candidates.find((o) => fitsRemaining(o)) ??
      candidates.find((o) => !o.rotated) ??
      candidates[0]!;

    let page = currentPage;
    if (!fitsRemaining(chosen)) {
      page += 1;
      pageUsedHeight.push(0);
    }
    const y = pageUsedHeight[page]!;
    shelves.push({ page, y, height: chosen.h, usedWidth: chosen.w });
    pageUsedHeight[page] = y + chosen.h;
    placed.push({ id: rect.id, page, x: 0, y, w: chosen.w, h: chosen.h, rotated: chosen.rotated, overflow: false });
  }

  return placed;
}
