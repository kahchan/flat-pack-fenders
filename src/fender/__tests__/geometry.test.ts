import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { geo } from '../geometry';
import type { FenderConfig, Geometry } from '../types';

/**
 * golden.json is generated from the ORIGINAL design source (a verbatim transcription of
 * renderVals(), kept unrefactored on purpose), not from this port. Agreement between the
 * two is therefore meaningful rather than circular.
 *
 * A wrong number here does not fail loudly at runtime — it produces a plausible-looking
 * pattern that comes out the wrong size in physical material. These are the only tests
 * standing between a slip and wasted stock.
 */

type Case = {
  config: FenderConfig;
  geo: Record<string, number>;
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

/** Full float equality — the fixture carries IEEE doubles, so nothing is lost. */
const EXACT: (keyof Geometry)[] = [
  'bsd',
  'tyreRcalc',
  'tyreR',
  'R',
  'cov',
  'th',
  'aNose',
  'L',
  'a',
  'skirt',
  'skirtTrue',
  't',
  'rBend',
  'setback',
  'BA',
  'bendComp',
  'hem',
  'proj',
  'drop',
  'crown0',
  'crownTail',
  'knee',
  'Wd',
  'yc',
  'n',
  'pitch',
  'removal',
  'notch',
  'lap'
];

describe.each(CASES)('geo(%s)', (_name, c) => {
  const actual = geo(c.config);

  it.each(EXACT)('%s matches the design source', (key) => {
    expect(actual[key]).toBeCloseTo(c.geo[key] as number, 10);
  });
});

describe('geometry invariants', () => {
  it('bend compensation is negative — folds shorten the flat pattern', () => {
    for (const [name, c] of CASES) {
      if (c.config.thick > 0) {
        expect(c.geo.bendComp, `${name} bendComp`).toBeLessThan(0);
      }
    }
  });

  it('very nearly collapses to the ideal pattern at zero thickness', () => {
    const g = geo({
      ...(CASES[0]![1].config as FenderConfig),
      thick: 0,
      hem: false
    });

    // With no thickness the lap is exactly the geometric surplus, nothing added
    // (WP23 §23.2 — the dart itself is always a plain slit; `notch` stays 0).
    expect(g.notch).toBe(0);
    expect(g.lap).toBeCloseTo(g.removal / g.n, 10);

    // But bendComp does NOT reach zero, and the design's engineering note says it does.
    // rBend = max(t, 0.2) keeps a 0.2 mm bend radius alive even at t = 0, leaving
    // bendComp = a·0.2 - 2·(0.2·tan(a/2)) ≈ -0.016 mm per fold. That is 16 microns —
    // physically irrelevant, unmeasurable with any tool that cuts this material — so the
    // port keeps the source's behaviour rather than "fixing" geometry to match prose.
    // The note's wording is what needs correcting. See PLAN §9.9.
    expect(g.bendComp).toBeLessThan(0);
    expect(Math.abs(g.bendComp)).toBeLessThan(0.02);
    expect(g.skirt).toBeCloseTo(g.skirtTrue, 1);
  });

  // WP23 §23.2 — a dartless skirt (no darts at all) is a real branch, not an error.
  // The UI's own flaps slider can't reach this (min 4), but geo() is a pure function
  // and must not divide by zero if something ever calls it with fewer.
  it('a dartless skirt (flaps <= 1) never divides by zero', () => {
    const base = CASES[0]![1].config as FenderConfig;
    for (const flaps of [0, 1]) {
      const g = geo({ ...base, flaps });
      expect(Number.isFinite(g.pitch)).toBe(true);
      expect(Number.isFinite(g.lap)).toBe(true);
      expect(g.lap).toBe(0);
      expect(g.notch).toBe(0);
    }
  });

  it('developed length is the arc, not the chord', () => {
    for (const [name, c] of CASES) {
      const g = geo(c.config);
      expect(g.L, `${name} L`).toBeCloseTo(g.R * g.th, 9);
    }
  });

  it('measured radius overrides the BSD estimate', () => {
    const base = CASES[0]![1].config as FenderConfig;
    expect(geo({ ...base, measuredR: 0 }).tyreR).toBe(geo(base).tyreRcalc);
    expect(geo({ ...base, measuredR: 311 }).tyreR).toBe(311);
    expect(geo({ ...base, measuredR: 311 }).R).toBe(311 + base.clear);
  });

  it('skirt never collapses below the 2 mm floor', () => {
    const base = CASES[0]![1].config as FenderConfig;
    expect(geo({ ...base, skirt: 0, thick: 4, angle: 85 }).skirt).toBe(2);
  });
});
