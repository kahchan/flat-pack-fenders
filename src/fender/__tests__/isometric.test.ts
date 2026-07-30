import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildIsometric, NS } from '../isometric';
import { buildBlank } from '../pattern';
import { DEFAULTS } from '../defaults';
import { geo } from '../geometry';
import type { FenderConfig } from '../types';

type PathFixture = { d: string };
type HoleFixture = { cx: string; cy: string; r: number };
type FacetFixture = { d: string; fill: string };
type IsoFixture = {
  facetCount: number;
  firstFacet: FacetFixture;
  lastFacet: FacetFixture;
  edges: string[];
  outline: string;
  wheelCount: number;
  wheel: string[];
  seamCount: number;
  firstSeam: PathFixture | null;
  lastSeam: PathFixture | null;
  holeCount: number;
  firstHole: HoleFixture | null;
  lastHole: HoleFixture | null;
  slotCount: number;
  firstSlot: PathFixture | null;
  lastSlot: PathFixture | null;
  strutCount: number;
  firstStrut: PathFixture | null;
  lastStrut: PathFixture | null;
  mudflapCount: number;
  mudflap: PathFixture | null;
  viewBox: string;
  aspect: string;
};
type Case = {
  config: FenderConfig;
  iso: Record<string, IsoFixture>;
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);
const SPINS = [18, -45];

// The fixture (extract-golden.mjs) is a verbatim transcription: its `mix(t)` interpolates
// two literal RGB triples and emits `rgb(r,g,b)`. The port can't hardcode those triples
// (hard rule: colours are tokens) and `rgb(var(--draw-facet-...))` alone can't express a
// numeric blend between two custom properties, so buildIsometric() emits a CSS
// `color-mix()` expression instead, with the blend weight (not the colour) computed
// numerically. To verify the two are the same ramp, parse the weight back out of our
// `color-mix()` string and recompute the same rgb() a browser would render, then compare
// channel-by-channel against the fixture's literal rgb(). A tolerance of 1 covers the
// fixture's full-precision `t` vs. our `f1()`-quantised (1 decimal place) percentage.
const DARK: [number, number, number] = [26, 34, 50];
const LIT: [number, number, number] = [244, 240, 232];

function litWeight(fill: string): number {
  const m = fill.match(/--draw-facet-lit\)\)\s*([\d.]+)%/);
  if (!m) throw new Error(`fill is not a color-mix() expression: ${fill}`);
  return Number(m[1]) / 100;
}

function parseRgb(fill: string): [number, number, number] {
  const m = fill.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) throw new Error(`fixture fill is not rgb(): ${fill}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function expectSameRamp(ourFill: string, fixtureFill: string) {
  expect(ourFill).toMatch(
    /^color-mix\(in srgb, rgb\(var\(--draw-facet-lit\)\) [\d.]+%, rgb\(var\(--draw-facet-dark\)\) [\d.]+%\)$/
  );
  const t = litWeight(ourFill);
  const [fr, fg, fb] = parseRgb(fixtureFill);
  const recomputed = DARK.map((c, i) => Math.round(c + (LIT[i] - c) * t));
  expect(recomputed[0]).toBeCloseTo(fr, 0);
  expect(recomputed[1]).toBeCloseTo(fg, 0);
  expect(recomputed[2]).toBeCloseTo(fb, 0);
}

for (const [name, c] of CASES) {
  describe.each(SPINS)(`buildIsometric(${name}, spin=%s)`, (spin) => {
    const iso = buildIsometric(c.config, undefined, spin);
    const fixture = c.iso[String(spin)]!;

    it('facet count, first/last facet d and shading ramp match', () => {
      expect(iso.facets).toHaveLength(fixture.facetCount);
      expect(iso.facets[0]!.d).toBe(fixture.firstFacet.d);
      expect(iso.facets[iso.facets.length - 1]!.d).toBe(fixture.lastFacet.d);
      expectSameRamp(iso.facets[0]!.fill, fixture.firstFacet.fill);
      expectSameRamp(iso.facets[iso.facets.length - 1]!.fill, fixture.lastFacet.fill);
    });

    it('edges (rails + caps) and outline match exactly, in order', () => {
      expect(iso.edges.map((e) => e.d)).toEqual(fixture.edges);
      expect(iso.outline[0]!.d).toBe(fixture.outline);
    });

    it('wheel ghost matches exactly, in order', () => {
      expect(iso.wheel).toHaveLength(fixture.wheelCount);
      expect(iso.wheel.map((w) => w.d)).toEqual(fixture.wheel);
    });

    it('seams match, in order', () => {
      expect(iso.seams).toHaveLength(fixture.seamCount);
      expect(iso.seams[0] ?? null).toEqual(fixture.firstSeam);
      expect(iso.seams[iso.seams.length - 1] ?? null).toEqual(fixture.lastSeam);
    });

    it('holes match, in order (dart fasteners then strut fasteners)', () => {
      expect(iso.holes).toHaveLength(fixture.holeCount);
      expect(iso.holes[0] ?? null).toEqual(fixture.firstHole);
      expect(iso.holes[iso.holes.length - 1] ?? null).toEqual(fixture.lastHole);
    });

    it('slots match, in order', () => {
      expect(iso.slots).toHaveLength(fixture.slotCount);
      expect(iso.slots[0] ?? null).toEqual(fixture.firstSlot);
      expect(iso.slots[iso.slots.length - 1] ?? null).toEqual(fixture.lastSlot);
    });

    it('struts match, in order', () => {
      expect(iso.struts).toHaveLength(fixture.strutCount);
      expect(iso.struts[0] ?? null).toEqual(fixture.firstStrut);
      expect(iso.struts[iso.struts.length - 1] ?? null).toEqual(fixture.lastStrut);
    });

    it('mudflap matches (absent when config.mudflap is 0)', () => {
      expect(iso.mudflap).toHaveLength(fixture.mudflapCount);
      expect(iso.mudflap[0] ?? null).toEqual(fixture.mudflap);
    });

    it('viewBox and aspect match', () => {
      expect(iso.viewBox).toBe(fixture.viewBox);
      expect(iso.aspect).toBe(fixture.aspect);
    });
  });
}

describe('isometric invariants', () => {
  const base = CASES[0]![1].config;

  it('facet count is 3 quads per segment, fixed at NS segments, independent of config', () => {
    for (const [, c] of CASES) {
      expect(buildIsometric(c.config).facets).toHaveLength(NS * 3);
    }
  });

  it('spin changes the projection: spin=0 and the default (18) differ', () => {
    const flat = buildIsometric(base, undefined, 0);
    const defaulted = buildIsometric(base);
    expect(defaulted.outline[0]!.d).not.toBe(flat.outline[0]!.d);
    expect(defaulted.edges.map((e) => e.d)).not.toEqual(flat.edges.map((e) => e.d));
  });

  it('omitting spin uses the source default of 18°', () => {
    expect(buildIsometric(base)).toEqual(buildIsometric(base, undefined, 18));
  });

  it('mudflap is present iff config.mudflap > 0', () => {
    expect(buildIsometric({ ...base, mudflap: 0 }).mudflap).toEqual([]);
    expect(buildIsometric({ ...base, mudflap: 100 }).mudflap.length).toBe(1);
  });

  it('slots appear only for the slot join; zip/rivet add fastener holes that slot/none do not', () => {
    const none = buildIsometric({ ...base, join: 'none' });
    const slot = buildIsometric({ ...base, join: 'slot' });
    const zip = buildIsometric({ ...base, join: 'zip' });
    const rivet = buildIsometric({ ...base, join: 'rivet' });

    expect(none.slots).toEqual([]);
    expect(zip.slots).toEqual([]);
    expect(rivet.slots).toEqual([]);
    expect(slot.slots.length).toBeGreaterThan(0);

    // Neither 'slot' nor 'none' pierce the seam (ts === [] for both) — holes come only
    // from the struts, so the two configs must have identical hole counts.
    expect(slot.holes.length).toBe(none.holes.length);
    expect(zip.holes.length).toBeGreaterThan(none.holes.length);
    expect(rivet.holes.length).toBeGreaterThan(none.holes.length);
  });

  it('two strut fastener holes and one strut quad per side, per strut in blank.strutFrac', () => {
    const blank = buildBlank(base, geo(base));
    const iso = buildIsometric(base, geo(base), 18, blank);
    expect(iso.struts.length).toBe(blank.strutFrac.length * 2);
  });

  it('the isometric struts use the SAME arc positions as the blank, not a recomputation', () => {
    const g = geo(base);
    const realBlank = buildBlank(base, g);
    const drifted = { ...realBlank, strutFrac: realBlank.strutFrac.map((fr) => fr * 0.5) };
    const real = buildIsometric(base, g, 18, realBlank);
    const withDrifted = buildIsometric(base, g, 18, drifted);
    expect(withDrifted.struts.map((p) => p.d)).not.toEqual(real.struts.map((p) => p.d));
  });
});

// PLAN §14 — the wheel ghost is drawn from tyreR/tyre/spin alone, never from
// crown/skirt/clear, so it must render byte-identical while those change; the viewBox
// is floored on that same wheel extent, so a config that stays within it must not move.
describe('buildIsometric viewBox envelope (PLAN §14)', () => {
  it('the wheel ghost is independent of crown, skirt and clearance', () => {
    const a = buildIsometric(DEFAULTS);
    const wideCrown = buildIsometric({ ...DEFAULTS, crown: 140 });
    const deepSkirt = buildIsometric({ ...DEFAULTS, skirt: 70 });
    const bigClear = buildIsometric({ ...DEFAULTS, clear: 40 });

    expect(wideCrown.wheel).toEqual(a.wheel);
    expect(deepSkirt.wheel).toEqual(a.wheel);
    expect(bigClear.wheel).toEqual(a.wheel);
  });

  it('the wheel ghost does change with tyre width, since that IS the wheel', () => {
    const a = buildIsometric(DEFAULTS);
    const wideTyre = buildIsometric({ ...DEFAULTS, tyre: 90 });
    expect(wideTyre.wheel).not.toEqual(a.wheel);
  });

  it('viewBox width holds steady for a crown change that stays within the wheel envelope', () => {
    // No struts/mudflap and a small arc, so the model's own content stays under the
    // wheel-anchored floor across this crown range, demonstrating the floor holds.
    const small: FenderConfig = {
      ...DEFAULTS,
      lead: 10,
      trail: 10,
      mudflap: 0,
      struts: 0,
      strutLen: 0,
      skirt: 0,
      crown: 30
    };
    const wideCrown: FenderConfig = { ...small, crown: 90 };
    const bw = (vb: string) => Number(vb.split(' ')[2]);
    expect(bw(buildIsometric(wideCrown).viewBox)).toBe(bw(buildIsometric(small).viewBox));
  });

  it('widens once the fender genuinely exceeds the wheel envelope', () => {
    const small = buildIsometric({ ...DEFAULTS, crown: 30 });
    const huge = buildIsometric({ ...DEFAULTS, crown: 140 });
    expect(huge.viewBox).not.toBe(small.viewBox);
  });
});
