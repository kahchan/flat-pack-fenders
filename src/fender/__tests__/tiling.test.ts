import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { PH } from '../defaults';
import { buildTiling, croppedTile } from '../tiling';
import type { FenderConfig } from '../types';

type RectFixture = { x: string; y: string; w: number; h: number };
type TileFixture = {
  label: string;
  meta: string;
  viewBox: string;
  frame: string;
  ruler: string;
  rulerX: string;
  rulerY: string;
};
type Case = {
  config: FenderConfig;
  tiling: {
    cols: number;
    rows: number;
    rowsSource: number;
    rowsFixed: number;
    rects: RectFixture[];
    tiles: TileFixture[];
  };
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

describe.each(CASES)('buildTiling(%s)', (_name, c) => {
  const t = buildTiling(c.config);
  const g = c.tiling;

  it('cols matches', () => {
    expect(t.cols).toBe(g.cols);
  });

  // WP20 §20.1 removed nesting, which is the only thing that used to make `rowsFixed`
  // (from `bboxH`) diverge from `rowsSource` (from `g.Wd` alone) — `bboxH` is always
  // `g.Wd` now, so the two are the same figure by construction; both are still emitted
  // in the fixture as a record of that.
  it('rows matches', () => {
    expect(t.rows).toBe(g.rowsFixed);
    expect(g.rowsFixed).toBe(g.rowsSource);
  });

  it('tile rects match exactly, in order', () => {
    expect(t.rects).toEqual(g.rects);
  });

  it('print tiles match exactly, in order', () => {
    expect(t.tiles).toEqual(g.tiles);
  });

  // PLAN FEEDBACK WP15 §15.3 — new, not in the design source, so not golden-pinned
  // (same precedent as WP12's parts.pages: dedicated invariant tests instead). Every
  // row before the last needs the full page; only the last can be shorter.
  it('lastRowH is a real content height, at most PH', () => {
    expect(t.lastRowH).toBeGreaterThan(0);
    expect(t.lastRowH).toBeLessThanOrEqual(PH);
  });
});

describe('tiling invariants', () => {
  const base = CASES[0]![1].config;

  it('every tile is a real A4 (267 × 180 mm) rect', () => {
    const t = buildTiling(base);
    for (const r of t.rects) {
      expect(r.w).toBe(267);
      expect(r.h).toBe(180);
    }
  });

  it('lastRowH tracks real content height, well under PH for a config with room to spare', () => {
    const t = buildTiling(base);
    expect(t.rows).toBe(1);
    // Even a single-row Sheet A can be much shorter than a full page — this is exactly
    // the "one tile row gets its own page no matter how little of it is used" case.
    expect(t.lastRowH).toBeLessThan(PH);
    expect(t.lastRowH).toBeGreaterThan(0);
  });

  it('croppedTile shortens the viewBox/frame/ruler to the given height without moving x or the top edge', () => {
    const t = buildTiling(base);
    const tile = t.tiles[0]!;
    const [ox, oy, w] = tile.viewBox.split(' ');
    const shrunk = croppedTile(tile, 40);
    const [sox, soy, sw, sh] = shrunk.viewBox.split(' ');
    expect(sox).toBe(ox);
    expect(soy).toBe(oy);
    expect(sw).toBe(w);
    expect(sh).toBe('40.0');
    expect(shrunk.label).toBe(tile.label); // same tile, just a shorter window
  });

  // WP19 §19.1: `a4` stock's tile step is `LAP` (247 mm), `single`'s is the plain
  // registration `OV` (255 mm) — the two stock choices tile at different steps now.
  it('a4 stock tiles at a shorter step than single stock, for the same blank width', () => {
    const single = buildTiling({ ...base, stock: 'single' });
    const a4 = buildTiling({ ...base, stock: 'a4' });
    expect(a4.cols).toBeGreaterThanOrEqual(single.cols);
  });
});
