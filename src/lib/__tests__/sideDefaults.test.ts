import { describe, expect, it } from 'vitest';
import { COVERAGE, DEFAULTS } from '../../fender/defaults';
import { SIDE_COVERAGE } from '../sideDefaults';

describe('SIDE_COVERAGE', () => {
  it('is the same COVERAGE constant DEFAULTS and PRESETS read (PLAN §13.1)', () => {
    expect(SIDE_COVERAGE).toBe(COVERAGE);
    expect(SIDE_COVERAGE.front).toEqual({ lead: 55, trail: 120 });
    expect(SIDE_COVERAGE.rear).toEqual({ lead: 120, trail: 100 });
  });

  it('tracks DEFAULTS for rear, so it cannot go stale the way the source did', () => {
    expect(SIDE_COVERAGE.rear).toEqual({ lead: DEFAULTS.lead, trail: DEFAULTS.trail });
  });

  it('neither side exceeds the 220° warning threshold', () => {
    expect(SIDE_COVERAGE.front.lead + SIDE_COVERAGE.front.trail).toBeLessThanOrEqual(220);
    expect(SIDE_COVERAGE.rear.lead + SIDE_COVERAGE.rear.trail).toBeLessThanOrEqual(220);
  });
});
