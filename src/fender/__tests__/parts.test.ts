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

  it('fitsA4 checks BOTH dimensions, unlike the design (PLAN §9.18)', () => {
    // The fixture records the design's width-only test. Sheet B prints into 267 × 172 mm,
    // and the design scaled anything taller down to fit while still reporting a 1:1 fit —
    // 78% on the default config, on the sheet you cut struts to length from.
    expect(p.fitsA4).toBe(p.width <= PW && p.height <= PARTS_PH);
    if (g.fitsA4 && p.height > PARTS_PH) {
      // This case is one the design would have silently mis-scaled.
      expect(p.fitsA4).toBe(false);
    }
    // Never more permissive than the design was.
    if (!g.fitsA4) expect(p.fitsA4).toBe(false);
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
});
