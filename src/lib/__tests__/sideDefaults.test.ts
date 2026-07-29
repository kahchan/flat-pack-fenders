import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../fender/defaults';
import { SIDE_COVERAGE } from '../sideDefaults';

describe('SIDE_COVERAGE', () => {
  it('matches the design source for front', () => {
    expect(SIDE_COVERAGE.front).toEqual({ lead: 120, trail: 140 });
  });

  it('tracks DEFAULTS for rear, so it cannot go stale the way the source did', () => {
    expect(SIDE_COVERAGE.rear).toEqual({ lead: DEFAULTS.lead, trail: DEFAULTS.trail });
  });

  it('rear coverage stays at or under the 220° warning threshold', () => {
    expect(SIDE_COVERAGE.rear.lead + SIDE_COVERAGE.rear.trail).toBeLessThanOrEqual(220);
  });
});
