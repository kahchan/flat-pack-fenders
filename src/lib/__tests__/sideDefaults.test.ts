import { describe, expect, it } from 'vitest';
import { COVERAGE, DEFAULTS } from '../../fender/defaults';
import { SIDE_COVERAGE } from '../sideDefaults';

// PLAN FEEDBACK §16.5 (decision A1) decoupled SIDE_COVERAGE from COVERAGE — it no
// longer reads the same constant, so these assertions are now about matching values,
// not shared identity. See sideDefaults.ts's doc comment for why.
describe('SIDE_COVERAGE', () => {
  it('holds its own literal values, still equal to COVERAGE today by intent (PLAN §16.5)', () => {
    expect(SIDE_COVERAGE).not.toBe(COVERAGE);
    expect(SIDE_COVERAGE.front).toEqual({ lead: 55, trail: 120 });
    expect(SIDE_COVERAGE.rear).toEqual({ lead: 120, trail: 100 });
  });

  it('matches DEFAULTS for rear today, though decoupled and free to diverge later', () => {
    expect(SIDE_COVERAGE.rear).toEqual({ lead: DEFAULTS.lead, trail: DEFAULTS.trail });
  });

  it('neither side exceeds the 220° warning threshold', () => {
    expect(SIDE_COVERAGE.front.lead + SIDE_COVERAGE.front.trail).toBeLessThanOrEqual(220);
    expect(SIDE_COVERAGE.rear.lead + SIDE_COVERAGE.rear.trail).toBeLessThanOrEqual(220);
  });
});
