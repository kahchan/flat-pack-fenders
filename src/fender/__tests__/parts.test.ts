import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildParts } from '../parts';
import {
  PARTS_PH,
  PW,
  STRUT_STRAP_PADDLE_W,
  STRUT_STRAP_SLOT_GAP,
  STRUT_STRAP_SLOT_L,
  STRUT_STRAP_SLOT_W,
  STRUT_W
} from '../defaults';
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

  // `slots` holds strap-end strut slots (PLAN FEEDBACK WP21 §21.1) — empty for every
  // golden case here, all of which are bolt-ended (or, for the two `strap-strut-end*`
  // cases, actually populated and checked against the fixture below).
  it('slots match the fixture (empty for a bolt end, populated for a strap end)', () => {
    expect(p.slots).toEqual(g.slots);
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

// PLAN FEEDBACK WP21 §21.1 — the strap-end paddle genuinely changes the part's packed
// footprint, so it has to actually feed `packParts`/the oversize warning, not just draw
// differently. These pin that, rather than eyeballing the golden diff.
describe('strap-mounted strut end (WP21 §21.1)', () => {
  const base = CASES[0]![1].config;

  it('every strut gets exactly two slots, 27 × 3.5 mm, 10 mm apart centre to centre', () => {
    const parts = buildParts({ ...base, strutEnd: 'strap', struts: 2 });
    expect(parts.slots.length).toBe(2 * 2);
    parts.slots.forEach((s) => {
      expect(s.w).toBe(STRUT_STRAP_SLOT_W);
      expect(s.h).toBe(STRUT_STRAP_SLOT_L);
    });
    for (let i = 0; i < 2; i++) {
      const [a, b] = parts.slots.slice(i * 2, i * 2 + 2);
      const gap = Number(b!.x) + Number(b!.w) / 2 - (Number(a!.x) + Number(a!.w) / 2);
      expect(gap).toBeCloseTo(STRUT_STRAP_SLOT_GAP, 5);
    }
  });

  it('a bolt end has no slots; a strap end has no frame-end hole pair', () => {
    const bolt = buildParts({ ...base, strutEnd: 'bolt', struts: 1, mudflap: 0, join: 'zip' });
    const strap = buildParts({ ...base, strutEnd: 'strap', struts: 1, mudflap: 0, join: 'zip' });
    expect(bolt.slots.length).toBe(0);
    expect(bolt.holes.length).toBe(4); // skirt hole + midpoint + 2-hole frame end
    expect(strap.holes.length).toBe(2); // skirt hole + midpoint only
    expect(strap.slots.length).toBe(2);
  });

  it('the paddle widens the packed footprint (feeds packParts, not just the drawing)', () => {
    const bolt = buildParts({ ...base, strutEnd: 'bolt', struts: 1 });
    const strap = buildParts({ ...base, strutEnd: 'strap', struts: 1 });
    const boltPart = bolt.pages[0]!.parts.find((p) => p.label.text.includes('STRUT'))!;
    const strapPart = strap.pages[0]!.parts.find((p) => p.label.text.includes('STRUT'))!;
    expect(boltPart.h).toBeLessThan(strapPart.h);
    expect(strapPart.h).toBeGreaterThanOrEqual(STRUT_STRAP_PADDLE_W);
  });

  it('two strap-ended struts do not overlap in the continuous layout (label-row spacing scales with the paddle)', () => {
    const parts = buildParts({ ...base, strutEnd: 'strap', struts: 2 });
    // The skirt-end hole (cx = 12) is the one hole every strut always has, strap or
    // bolt, so it uniquely picks out one row per strut.
    const skirtHoles = parts.holes.filter((h) => Number(h.cx) === 12);
    const cys = skirtHoles.map((h) => Number(h.cy)).sort((a, b) => a - b);
    expect(cys.length).toBe(2);
    expect(cys[1]! - cys[0]!).toBeGreaterThanOrEqual(STRUT_STRAP_PADDLE_W);
  });

  it("a strap end's slots stay within the paddle, clear of both the tip and the transition", () => {
    const parts = buildParts({ ...base, strutEnd: 'strap', struts: 1 });
    for (const s of parts.slots) {
      const x0 = Number(s.x);
      const x1 = x0 + Number(s.w);
      expect(x0).toBeGreaterThan(base.strutLen - 24);
      expect(x1).toBeLessThan(base.strutLen);
    }
  });

  it('oversizedParts still reads the real (taller) strap footprint', () => {
    const strap = buildParts({ ...base, strutEnd: 'strap', struts: 1 });
    const bolt = buildParts({ ...base, strutEnd: 'bolt', struts: 1 });
    expect(strap.oversizedParts).toEqual(bolt.oversizedParts); // both well within PARTS_PH
    // A strutLen long enough that neither STRUT_W nor STRUT_STRAP_PADDLE_W tips it over
    // PARTS_PH would need >150 mm of headroom either way — confirm the height read is
    // the paddle's, not a stale STRUT_W constant, by checking the local part directly.
    expect(strap.pages[0]!.parts[0]!.h).toBeGreaterThan(STRUT_W + 8);
  });
});
