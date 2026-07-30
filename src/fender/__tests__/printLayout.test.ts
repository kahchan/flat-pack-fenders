import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildParts } from '../parts';
import { buildPrintLayout } from '../printLayout';
import { buildTiling } from '../tiling';
import type { FenderConfig } from '../types';

type Case = { config: FenderConfig };

const CASES = Object.entries(golden as unknown as Record<string, Case>);

// PLAN FEEDBACK WP15 §15.3 — new, not in the design source (same precedent as WP12's
// parts.pages: dedicated invariant tests, not a golden fixture — see tiling.test.ts's
// lastRowH tests for the same reasoning).
describe.each(CASES)('buildPrintLayout(%s)', (_name, c) => {
  const tiling = buildTiling(c.config);
  const parts = buildParts(c.config);
  const layout = buildPrintLayout(tiling, parts);

  it('accounts for every Sheet-A tile exactly once, across full pages and combined pages', () => {
    const lastRowStart = (tiling.rows - 1) * tiling.cols;
    const fromFull = new Set(layout.fullTileIndices);
    const fromCombined = new Set(
      layout.pages.flatMap((p) => p.slots.filter((s) => s.kind === 'sheetA').map((s) => s.index))
    );
    expect(fromFull.size).toBe(layout.fullTileIndices.length); // no duplicates
    expect(fromCombined.size).toBe(tiling.cols); // one slot per column, last row only
    for (let i = 0; i < lastRowStart; i++) expect(fromFull.has(i)).toBe(true);
    for (let c2 = 0; c2 < tiling.cols; c2++) expect(fromCombined.has(lastRowStart + c2)).toBe(true);
  });

  it('accounts for every Sheet-B page exactly once', () => {
    const fromCombined = layout.pages.flatMap((p) => p.slots.filter((s) => s.kind === 'sheetB').map((s) => s.index));
    expect(fromCombined.slice().sort((a, b) => a - b)).toEqual(parts.pages.map((_, i) => i));
  });

  it('never overlaps two slots stacked on the same physical page', () => {
    for (const p of layout.pages) {
      const sorted = [...p.slots].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.y).toBeGreaterThanOrEqual(sorted[i - 1]!.y + sorted[i - 1]!.h);
      }
    }
  });

  it('every slot fits the page height it was packed onto', () => {
    for (const p of layout.pages) {
      for (const s of p.slots) {
        expect(s.y + s.h).toBeLessThanOrEqual(180 + 1e-9); // PH
      }
    }
  });

  it('pageCount is full tiles + combined pages + the instructions page', () => {
    expect(layout.pageCount).toBe(layout.fullTileIndices.length + layout.pages.length + 1);
  });

  it('never needs MORE physical pages than printing every tile/parts-page on its own would', () => {
    const oldPageCount = tiling.tiles.length + parts.pages.length + 1;
    expect(layout.pageCount).toBeLessThanOrEqual(oldPageCount);
  });
});

describe('buildPrintLayout invariants', () => {
  const base = CASES[0]![1].config;

  it('drops the page count for a config whose last Sheet-A row is much shorter than a full page', () => {
    // Nesting is the motivating case from PLAN FEEDBACK WP15 §15.3: it forces a second
    // tile row that is mostly empty (just the tail of the nested pair), which the old
    // one-page-per-row behaviour printed as a whole extra page per column.
    const tiling = buildTiling({ ...base, nest: true });
    const parts = buildParts({ ...base, nest: true });
    const layout = buildPrintLayout(tiling, parts);
    const oldPageCount = tiling.tiles.length + parts.pages.length + 1;
    expect(layout.pageCount).toBeLessThan(oldPageCount);
  });

  it('a page holding only one slot has no wasted stacking logic — it just fills the page', () => {
    const tiling = buildTiling({ ...base, nest: false, stock: 'single' });
    const parts = buildParts({ ...base, nest: false, struts: 1, mudflap: 0, join: 'none' });
    const layout = buildPrintLayout(tiling, parts);
    for (const p of layout.pages) expect(p.slots.length).toBeGreaterThan(0);
  });
});
