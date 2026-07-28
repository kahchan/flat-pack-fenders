import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildTiling } from '../tiling';
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
});
