import { describe, expect, test } from 'vitest';
import { DEFAULTS } from '../defaults';
import { JOIN_LAP_NEEDED, geo, joinFits } from '../geometry';
import { ZIP_INNER_DEPTH, ZIP_LAP_MARGIN, ZIP_R, buildAssembly, depthFraction } from '../assembly';
import type { FenderConfig } from '../types';

const RIVET_R = 1.6;
const RIVET_DEPTH = 6.4;
/** Ordinary sheet practice: edge distance ≥ 1.5× hole ⌀, hole pitch ≥ 2× hole ⌀ — the
 * two rules §34.1 found the round-3 holes violating. */
const EDGE_FLOOR = (r: number) => 1.5 * (2 * r);
const PITCH_FLOOR = (r: number) => 2 * (2 * r);

/**
 * WP34 — the test the plan's §34.1 defect shipped without: for every config where `zip`
 * reports as fitting, the three ligaments that actually decide whether the stitch holds
 * (free edge, hole-to-hole, across-lap on both holes) really do clear their minimums.
 * Checking `joinFits()`'s boolean alone — as the round-3/4 tests did — would have passed
 * on the 1.0 mm hole-to-hole ligament that shipped, because nothing upstream of it was
 * wrong; the geometry just was never measured this way.
 */
describe('WP34 §34.1/§34.4 — zip and rivet hole ligaments', () => {
  const skirts = [18, 20, 26, 32, 40, 50, 60, 80];
  const flapsRange = [4, 6, 8, 12, 16, 20, 28];

  test('every fitting zip config clears free-edge, hole-to-hole, and across-lap on both holes', () => {
    let checked = 0;
    for (const skirt of skirts) {
      for (const flaps of flapsRange) {
        const cfg: FenderConfig = { ...DEFAULTS, skirt, flaps, join: 'zip' };
        const g = geo(cfg);
        const fit = joinFits(g).find((f) => f.join === 'zip')!;
        if (!fit.fits) continue;
        checked++;

        const holes = buildAssembly(cfg, g)
          .features.filter((f) => f.kind === 'hole' && f.dart === 1 && f.side === 0)
          .sort((a, b) => a.depth - b.depth);
        expect(holes.map((h) => h.depth)).toEqual([6, ZIP_INNER_DEPTH]);
        expect(holes.every((h) => h.r === ZIP_R)).toBe(true);

        // Free edge: the outer hole is the shallower one, so it is the binding case.
        const outer = holes[0]!;
        const freeEdgeLigament = outer.depth - ZIP_R;
        expect(freeEdgeLigament, `skirt=${skirt} flaps=${flaps}`).toBeGreaterThanOrEqual(
          EDGE_FLOOR(ZIP_R) - 1e-9
        );

        // Hole-to-hole: edge-to-edge gap between the pair.
        const inner = holes[1]!;
        const pitch = inner.depth - outer.depth;
        const holeToHoleLigament = pitch - 2 * ZIP_R;
        expect(holeToHoleLigament, `skirt=${skirt} flaps=${flaps}`).toBeGreaterThanOrEqual(
          PITCH_FLOOR(ZIP_R) - 2 * ZIP_R - 1e-9
        );

        // Across the lap, on BOTH holes: the local overlap at depth `d` is `u(d)·lap`
        // (develop.ts), split evenly either side of the dart centre.
        for (const h of holes) {
          const u = depthFraction(g, h.depth);
          const acrossLapLigament = (u * g.lap) / 2 - ZIP_R;
          expect(acrossLapLigament, `skirt=${skirt} flaps=${flaps} depth=${h.depth}`).toBeGreaterThanOrEqual(
            ZIP_LAP_MARGIN - 1e-6
          );
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  // §34.4's table, read straight: at 8 sections a 20 mm skirt has 8.0 mm of lap where
  // 15.7 mm is needed, and a 26 mm skirt has 10.4 mm where 11.4 mm is needed — both
  // short, so `zip` must not report as fitting at either depth.
  test('zip does not report as fitting on a skirt too shallow for the inner hole (§34.4 table, 8 sections)', () => {
    for (const skirt of [20, 26]) {
      const cfg: FenderConfig = { ...DEFAULTS, skirt, flaps: 8, join: 'zip' };
      const g = geo(cfg);
      const fit = joinFits(g).find((f) => f.join === 'zip')!;
      expect(fit.fits, `skirt=${skirt}`).toBe(false);
    }
  });

  test('every fitting rivet config clears its free-edge ligament', () => {
    let checked = 0;
    for (const skirt of skirts) {
      for (const flaps of flapsRange) {
        const cfg: FenderConfig = { ...DEFAULTS, skirt, flaps, join: 'rivet' };
        const g = geo(cfg);
        const fit = joinFits(g).find((f) => f.join === 'rivet')!;
        if (!fit.fits) continue;
        checked++;

        const holes = buildAssembly(cfg, g).features.filter(
          (f) => f.kind === 'hole' && f.dart === 1 && f.side === 0
        );
        expect(holes).toHaveLength(1);
        const hole = holes[0]!;
        expect(hole.depth).toBe(RIVET_DEPTH);
        expect(hole.r).toBe(RIVET_R);

        const freeEdgeLigament = hole.depth - RIVET_R;
        expect(freeEdgeLigament, `skirt=${skirt} flaps=${flaps}`).toBeGreaterThanOrEqual(
          EDGE_FLOOR(RIVET_R) - 1e-9
        );

        // Rivet keeps its constant JOIN_LAP_NEEDED, so the across-lap ligament at its
        // one hole is bounded below by the same margin that constant was chosen to give.
        const u = depthFraction(g, hole.depth);
        const acrossLapLigament = (u * g.lap) / 2 - RIVET_R;
        expect(acrossLapLigament, `skirt=${skirt} flaps=${flaps}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('rivet keeps its constant lap requirement (not derived, unlike zip)', () => {
    expect(JOIN_LAP_NEEDED.rivet).toBe(7);
  });
});
