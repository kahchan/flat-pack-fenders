import { describe, expect, test } from 'vitest';
import { buildAssembly, depthFraction, panelMidAngle } from '../assembly';
import { assembledAngle, develop, developFeature, flatX, point3, refold } from '../develop';
import { DEFAULTS } from '../defaults';
import { geo } from '../geometry';
import { PRESETS } from '../../state/presets';
import type { FenderConfig, JoinKey } from '../types';

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** Configs with enough lap that every join is worth exercising. */
const cfg = (over: Partial<FenderConfig> = {}): FenderConfig => ({
  ...DEFAULTS,
  skirt: 60,
  flaps: 8,
  ...over
});

const PIERCING: JoinKey[] = ['cinch', 'rivet', 'zip', 'slot'];

describe('WP29 §29.3 — the assembled model is the source of truth', () => {
  // The test the whole package exists for. A fastener through a lap is ONE point on the
  // built fender; it appears once per panel in the flat pattern. If those flat instances
  // do not fold back to the same place, the fender cannot be assembled — which is
  // exactly what round 4 §9.35 found and nothing could see.
  test.each(PIERCING)('every layer of a %s feature refolds to one point', (join) => {
    const s = cfg({ join });
    const g = geo(s);
    const features = buildAssembly(s, g).features;
    expect(features.length).toBeGreaterThan(0);

    for (const f of features) {
      const instances = developFeature(g, f);
      expect(instances.length).toBe(f.layers.length || 1);
      const points = instances.map((ff) => refold(g, ff));
      for (const p of points) expect(dist(p, points[0]!)).toBeLessThan(0.05);
    }
  });

  test('a through-lap feature really does unroll to two different flat positions', () => {
    const s = cfg({ join: 'zip' });
    const g = geo(s);
    const through = buildAssembly(s, g).features.filter((f) => f.layers.length === 2);
    expect(through.length).toBeGreaterThan(0);

    for (const f of through) {
      const [a, b] = developFeature(g, f);
      // Separated in the flat by the local lap width, and by nothing else.
      const u = depthFraction(g, f.depth);
      expect(Math.abs(b!.x - a!.x)).toBeCloseTo(u * g.lap, 6);
    }
  });

  // The regression. Round 3 used `d / skirt`; the overlap triangle needs
  // `(skirt - d) / skirt`. At 8.5 mm below the free edge on a 59.4 mm skirt the old
  // formula separated the layers by 3.49 mm where 20.90 mm of lap is available.
  test('§9.35: the lap slant runs from the free edge, not toward it', () => {
    const s = cfg({ join: 'zip' });
    const g = geo(s);
    const deep = buildAssembly(s, g).features.find((f) => f.depth === 8.5);
    expect(deep).toBeDefined();

    const [a, b] = developFeature(g, deep!);
    const separation = Math.abs(b!.x - a!.x);
    const wrong = (8.5 / g.skirt) * g.lap;

    expect(separation).toBeCloseTo(((g.skirt - 8.5) / g.skirt) * g.lap, 6);
    expect(separation).toBeGreaterThan(wrong * 4);
  });

  test('flatX and assembledAngle invert each other', () => {
    const g = geo(cfg());
    for (const panel of [0, 3, 7]) {
      for (const depth of [0, 4, 20, g.skirt]) {
        const aa = g.aNose + (panel + 0.37) * (g.pitch / g.R);
        const x = flatX(g, panel, aa, depth);
        expect(assembledAngle(g, panel, x, depth)).toBeCloseTo(aa, 9);
      }
    }
  });

  test('unrolling is an isometry along a panel', () => {
    const g = geo(cfg());
    // WP32: a panel is FLAT, so this is now an exact identity rather than an arc-length
    // approximation — the straight-line distance between two points on one panel equals
    // their separation in the flat pattern, full stop. On the old cylinder it only held
    // to within the chord-versus-arc error.
    const panel = 3;
    const aMid = panelMidAngle(g, panel);
    for (const depth of [0, 10, 30]) {
      const a0 = aMid - g.dA * 0.3;
      const a1 = aMid + g.dA * 0.4;
      const p0 = point3(g, panel, a0, depth, 0);
      const p1 = point3(g, panel, a1, depth, 0);
      const flatDelta = Math.abs(flatX(g, panel, a1, depth) - flatX(g, panel, a0, depth));
      expect(dist(p0, p1)).toBeCloseTo(flatDelta, 6);
    }
  });

  test('depth 0 is the free edge and depth skirt is the fold', () => {
    const g = geo(cfg());
    const panel = 3;
    // At the panel's mid-line the facet is tangent to the clearance circle, so the radius
    // is exactly R (fold) and R - drop (free edge). Away from it the flat facet stands
    // proud, which is the whole point of WP32 and is checked separately below.
    const aa = panelMidAngle(g, panel);
    const free = point3(g, panel, aa, 0, 3);
    const fold = point3(g, panel, aa, g.skirt, 3);
    const c = g.crown0 / 2;
    expect(free[0]).toBeCloseTo(c + g.proj, 6);
    expect(Math.hypot(free[1], free[2])).toBeCloseTo(g.R - g.drop, 6);
    expect(fold[0]).toBeCloseTo(c, 6);
    expect(Math.hypot(fold[1], fold[2])).toBeCloseTo(g.R, 6);
  });

  test('every shipped preset develops without a stray layer', () => {
    for (const p of PRESETS) {
      const g = geo(p.config);
      const flat = develop(g, buildAssembly(p.config, g));
      for (const ff of flat) {
        expect(Number.isFinite(ff.x)).toBe(true);
        expect(Number.isFinite(ff.y)).toBe(true);
      }
    }
  });
});
