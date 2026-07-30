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
    sheetCount: number;
    rects: RectFixture[];
    tiles: TileFixture[];
    nestTransform: string | null;
  };
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

describe.each(CASES)('buildTiling(%s)', (_name, c) => {
  const t = buildTiling(c.config);
  const g = c.tiling;

  it('cols matches (unaffected by the §9.4 divergence)', () => {
    expect(t.cols).toBe(g.cols);
  });

  // PLAN §9.4: the design source computes `rows` from `g.Wd` alone (rowsSource) — with
  // nesting on, the on-screen bbox is twice as tall, so the nested pair never reached the
  // printed sheets. This port computes `rows` from `bboxH` instead (rowsFixed) so the
  // printed tiles cover both nested fenders. Assert against rowsFixed, not rowsSource.
  it('rows matches the FIXED behaviour (bboxH), not the source (g.Wd)', () => {
    expect(t.rows).toBe(g.rowsFixed);
    if (c.config.nest) {
      // The divergence only bites when nesting is on — that's the whole bug.
      expect(g.rowsFixed).toBeGreaterThan(g.rowsSource);
    } else {
      expect(g.rowsFixed).toBe(g.rowsSource);
    }
  });

  it('sheetCount matches rows × cols + Sheet B + instructions', () => {
    expect(t.sheetCount).toBe(g.sheetCount);
    expect(t.sheetCount).toBe(t.rows * t.cols + 2);
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

  it('nestTransform matches (null when nest is off, transform string when on)', () => {
    expect(t.nestTransform).toBe(g.nestTransform);
    if (c.config.nest) {
      expect(t.nestTransform).toMatch(/^translate\(-?[\d.]+, -?[\d.]+\) rotate\(180\)$/);
    } else {
      expect(t.nestTransform).toBeNull();
    }
  });
});

describe('tiling invariants', () => {
  const base = CASES[0]![1].config;

  it('nesting doubles the printed rows for the default config', () => {
    const flat = buildTiling({ ...base, nest: false });
    const nested = buildTiling({ ...base, nest: true });
    expect(nested.rows).toBe(flat.rows * 2);
    expect(nested.cols).toBe(flat.cols);
    expect(nested.sheetCount).toBe(flat.cols * nested.rows + 2);
  });

  it('every tile is a real A4 (267 × 180 mm) rect', () => {
    const t = buildTiling(base);
    for (const r of t.rects) {
      expect(r.w).toBe(267);
      expect(r.h).toBe(180);
    }
  });

  it('lastRowH tracks real content height, well under PH for a config with room to spare', () => {
    const flat = buildTiling({ ...base, nest: false });
    expect(flat.rows).toBe(1);
    // Even a single-row Sheet A can be much shorter than a full page — this is exactly
    // the "one tile row gets its own page no matter how little of it is used" case, not
    // only a multi-row one.
    expect(flat.lastRowH).toBeLessThan(PH);
    expect(flat.lastRowH).toBeGreaterThan(0);
  });

  it('nesting shrinks the SECOND row further once it forces rows from 1 to 2', () => {
    const flat = buildTiling({ ...base, nest: false });
    const nested = buildTiling({ ...base, nest: true });
    expect(nested.rows).toBe(flat.rows + 1);
    expect(nested.lastRowH).toBeLessThan(PH);
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

  it('a config that benefits from §15.3 packing has real content well under PH on its last row', () => {
    // The motivating case: nesting pushes rows from 1 to 2, but the second row is only
    // the tail end of the nested pair — a sliver of content, not another full page.
    const t = buildTiling({ ...base, nest: true });
    expect(t.rows).toBeGreaterThan(1);
    expect(t.lastRowH).toBeLessThan(PH * 0.5);
  });
});
