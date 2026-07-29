import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildParts } from '../parts';
import { PARTS_PH, PW } from '../defaults';
import type { FenderConfig } from '../types';

type HoleFixture = { cx: number | string; cy: number | string; r: number };
type LabelFixture = { x: number | string; y: number | string; size: number; text: string };
type Case = {
  config: FenderConfig;
  parts: {
    outlines: string[];
    folds: string[];
    holes: HoleFixture[];
    slots: unknown[];
    labels: LabelFixture[];
    viewBox: string;
    width: number;
    height: number;
    fitsA4: boolean;
    extraCount: number;
    extraLabel: string;
  };
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

// The fixture is a verbatim JS transcription: the source pushes one strut hole with a
// bare numeric literal (`cx: 12`), which JSON preserves as a number. Hole.cx/cy are
// frozen as `string` in the contract, so the port always emits a string. Normalise both
// sides to string before comparing — same pattern as the colour-token mismatch in
// crossSection.test.ts.
const normHole = (h: HoleFixture) => ({ cx: String(h.cx), cy: String(h.cy), r: h.r });

describe.each(CASES)('buildParts(%s)', (_name, c) => {
  const p = buildParts(c.config);
  const g = c.parts;

  // Exact string equality, in push order — struts, then mudflap, then butt straps/clips.
  it('outlines match exactly, in order', () => {
    expect(p.outlines.map((o) => o.d)).toEqual(g.outlines);
  });

  it('fold lines match exactly, in order', () => {
    expect(p.folds.map((f) => f.d)).toEqual(g.folds);
  });

  it('holes match exactly, in order', () => {
    expect(p.holes.map(normHole)).toEqual(g.holes.map(normHole));
  });

  // `slots` is always empty: the source declares `partsSlots` but never pushes into it.
  it('slots stay empty, faithfully', () => {
    expect(p.slots).toEqual([]);
    expect(g.slots).toEqual([]);
  });

  it('labels match, ignoring the unset fill (source never colours parts labels)', () => {
    expect(p.labels.map((l) => ({ x: l.x, y: l.y, size: l.size, text: l.text }))).toEqual(g.labels);
    expect(p.labels.every((l) => l.fill === undefined)).toBe(true);
  });

  it('viewBox, width and height match', () => {
    expect(p.viewBox).toBe(g.viewBox);
    expect(p.width).toBeCloseTo(g.width, 10);
    expect(p.height).toBeCloseTo(g.height, 10);
  });

  it('fitsA4 means "packs onto one page" (PLAN §12), not the old width/height check', () => {
    expect(p.fitsA4).toBe(p.pages.length <= 1);
  });

  it('every part from buildParts appears exactly once across the packed pages', () => {
    const packedCount = p.pages.reduce((n, page) => n + page.parts.length, 0);
    const expectedCount = p.outlines.length; // struts + mudflap + hardware, same tally
    expect(packedCount).toBe(expectedCount);
  });

  it('no packed part overlaps another on the same page, and none crosses a page edge', () => {
    for (const page of p.pages) {
      for (const part of page.parts) {
        const w = part.rotated ? part.h : part.w;
        const h = part.rotated ? part.w : part.h;
        expect(part.x).toBeGreaterThanOrEqual(0);
        expect(part.y).toBeGreaterThanOrEqual(0);
        expect(part.x + w).toBeLessThanOrEqual(page.width + 1e-6);
        expect(part.y + h).toBeLessThanOrEqual(page.height + 1e-6);
      }
      for (let i = 0; i < page.parts.length; i++) {
        for (let j = i + 1; j < page.parts.length; j++) {
          const a = page.parts[i]!;
          const b = page.parts[j]!;
          const aw = a.rotated ? a.h : a.w;
          const ah = a.rotated ? a.w : a.h;
          const bw = b.rotated ? b.h : b.w;
          const bh = b.rotated ? b.w : b.h;
          const overlap = a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('extraCount and extraLabel match', () => {
    expect(p.extraCount).toBe(g.extraCount);
    expect(p.extraLabel).toBe(g.extraLabel);
  });
});

describe('parts invariants', () => {
  const base = CASES[0]![1].config;

  it('one strut per config.struts', () => {
    const three = buildParts({ ...base, struts: 3 });
    // 3 outlines from struts + optional mudflap (present in `base`).
    expect(three.outlines.length).toBe(3 + (base.mudflap > 0 ? 1 : 0));
  });

  it('rivet join produces butt straps with four holes each, no fold lines', () => {
    const rivet = buildParts({ ...base, join: 'rivet' });
    expect(rivet.extraLabel).toBe('BUTT STRAP');
    const strapFoldCount = rivet.folds.length - base.struts - (base.mudflap > 0 ? 1 : 0);
    expect(strapFoldCount).toBe(0);
  });

  it('slot join produces clips with fold lines, no extra holes', () => {
    const slotCfg = { ...base, join: 'slot' as const, flaps: 12 };
    const slot = buildParts(slotCfg);
    expect(slot.extraLabel).toBe('CLIP');
    expect(slot.extraCount).toBe(slotCfg.flaps - 1);
  });

  it('zip and none joins need no extra parts', () => {
    expect(buildParts({ ...base, join: 'zip' }).extraCount).toBe(0);
    expect(buildParts({ ...base, join: 'none' }).extraCount).toBe(0);
  });

  // PLAN §12: adding `pages` must not disturb the single continuous layout that
  // `export/svg.ts` and `export/dxf.ts` read (`outlines`/`folds`/`holes`/`labels`/
  // `viewBox`/`width`/`height`) — a laser bed isn't A4, so exports keep laying parts out
  // in one column regardless of how the packed pages look. svg.test.ts/dxf.test.ts
  // already assert this end to end (byte-identical golden output); this pins the
  // narrower claim that adding pages didn't touch the fields they read.
  it('adding `pages` does not change the continuous-layout fields exports read', () => {
    for (const [, c] of CASES) {
      const parts = buildParts(c.config);
      expect(parts.outlines.map((o) => o.d)).toEqual(c.parts.outlines);
      expect(parts.folds.map((f) => f.d)).toEqual(c.parts.folds);
      expect(parts.viewBox).toBe(c.parts.viewBox);
      expect(parts.width).toBeCloseTo(c.parts.width, 10);
      expect(parts.height).toBeCloseTo(c.parts.height, 10);
    }
  });

  it('every part packs onto at least one page and pages tile PW × PARTS_PH', () => {
    const parts = buildParts(base);
    expect(parts.pages.length).toBeGreaterThan(0);
    for (const page of parts.pages) {
      expect(page.width).toBe(PW);
      expect(page.height).toBe(PARTS_PH);
    }
  });
});
