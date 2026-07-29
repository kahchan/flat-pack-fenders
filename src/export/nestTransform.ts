/**
 * Maps a point through the tail-to-nose nest transform shared by the screen ghost, the
 * print tiles and both exports: `translate(L, Wd·2+10) rotate(180)` — see `tiling.ts`'s
 * `nestTransform` string, PLAN §9.4. SVG can reuse that string verbatim as a `<g
 * transform>`, but DXF has no group-transform primitive, so `buildDxf` bakes the same
 * transform into each point directly, before the Y-flip and any parts-sheet offset are
 * applied downstream.
 *
 * SVG transform lists apply right-to-left to a point, so `rotate(180)` (negate both
 * axes) happens first, then `translate(L, Wd·2+10)`.
 */
export function nestPoint([x, y]: [number, number], L: number, Wd: number): [number, number] {
  return [L - x, Wd * 2 + 10 - y];
}
