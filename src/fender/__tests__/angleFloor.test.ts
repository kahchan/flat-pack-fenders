import { describe, expect, test } from 'vitest';
import { DEFAULTS } from '../defaults';
import { JOIN_LAP_NEEDED, geo } from '../geometry';
import { buildWarnings } from '../warnings';
import { PRESETS } from '../../state/presets';

const CINCH = JOIN_LAP_NEEDED.cinch;

describe('WP30 §30.2 — the skirt angle floor is derived, not fixed', () => {
  test('at the floor there is a fastenable lap; one degree under, there is not', () => {
    for (const skirt of [18, 26, 32, 45, 60]) {
      for (const flaps of [6, 12, 20, 28]) {
        const base = { ...DEFAULTS, skirt, flaps };
        const floor = geo(base).angleMin;
        if (floor === null) continue;

        // Read the floor back through a config that cannot itself be floored, so the
        // check is on the geometry rather than on the clamp.
        const at = geo({ ...base, angle: Math.ceil(floor) });
        expect(at.lap).toBeGreaterThanOrEqual(CINCH - 1e-6);

        if (floor > DEFAULTS.thick + 1) {
          const under = { ...base, angle: floor - 1 };
          // The floor holds it up, which is the whole mechanism...
          expect(geo(under).angleEff).toBeCloseTo(floor, 9);
          // ...and without it the lap really would fall short.
          const unfloored =
            (geo(base).L * skirt * Math.sin(((floor - 1) * Math.PI) / 180)) /
            (geo(base).R * flaps);
          expect(unfloored).toBeLessThan(CINCH);
        }
      }
    }
  });

  test('§30.3: the floor can genuinely not exist, and says so rather than pinning', () => {
    // Many sections against a shallow skirt: `sin` saturates before the requirement is
    // met, so no angle up to 90° reaches a fastenable lap.
    const g = geo({ ...DEFAULTS, flaps: 40, skirt: 8 });
    expect(g.angleMin).toBeNull();
    // The angle is then left exactly as set — nothing is silently pinned to 85°.
    expect(g.angleEff).toBe(DEFAULTS.angle);
  });

  test('decision D4: shallowing the skirt and deepening it again restores the angle', () => {
    const set = 30;
    const deep = { ...DEFAULTS, angle: set, skirt: 40 };
    expect(geo(deep).angleEff).toBe(set);

    // Shallow enough that the floor rises above the set angle.
    const shallow = { ...deep, skirt: 16 };
    const floor = geo(shallow).angleMin!;
    expect(floor).toBeGreaterThan(set);
    expect(geo(shallow).angleEff).toBeCloseTo(floor, 9);
    // The config was never rewritten...
    expect(shallow.angle).toBe(set);
    // ...so going back gets the angle back.
    expect(geo({ ...shallow, skirt: 40 }).angleEff).toBe(set);
  });

  test('a held angle warns, naming both levers', () => {
    const held = { ...DEFAULTS, angle: 22, skirt: 20, flaps: 24 };
    const g = geo(held);
    expect(g.angleMin).not.toBeNull();
    expect(g.angleEff).toBeGreaterThan(held.angle);

    const w = buildWarnings(held).find((x) => x.id === 'angle-below-shingle-floor');
    expect(w).toBeDefined();
    expect(w!.text).toContain('22°');
    expect(w!.text).toMatch(/deepen the skirt|cut sections/);
  });

  test('every shipped preset sits at or above its own floor, so none warns', () => {
    for (const p of PRESETS) {
      const g = geo(p.config);
      if (g.angleMin !== null) expect(p.config.angle).toBeGreaterThanOrEqual(g.angleMin);
      expect(g.angleEff).toBe(p.config.angle);
      expect(buildWarnings(p.config).map((w) => w.id)).not.toContain('angle-below-shingle-floor');
    }
  });

  test('the floor really is config-dependent, which is why it is not a constant', () => {
    const floors = PRESETS.map((p) => Math.round(geo(p.config).angleMin ?? -1));
    expect(new Set(floors).size).toBeGreaterThan(1);
    // The fixed 20° it replaced is below the real requirement for most of them.
    expect(floors.filter((f) => f > 20).length).toBeGreaterThan(floors.length / 2);
  });
});
