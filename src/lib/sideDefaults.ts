import type { Side } from '../fender/types';

/**
 * Coverage the rail's Side selector jumps to when you switch fenders — a quick-start
 * nudge to sensible lead/trail for that mount, not a fresh geometry decision. Ported
 * from the design source (fender.html:1104), which hardcoded `front → 120/140` and
 * `rear → 60/200`.
 *
 * Neither pair is the source's literals. WP13 pointed this table at `COVERAGE` so it
 * couldn't drift from `DEFAULTS` the way it had once (PLAN §13.1 / §9.16); PLAN
 * FEEDBACK §16.5 (decision A1) decouples it again, its own literal rather than an
 * alias, trading that guarantee for the freedom to tune this quick-start nudge
 * independently of the presets `COVERAGE` now serves exclusively. The values are
 * unchanged — still equal to `COVERAGE`'s today, by intent, not by reference: this is
 * the third of the three coverage numbers §9.16 describes drifting apart once, back on
 * its own again deliberately. The source's `60/200` rear pair was the arc for the
 * *original* file default (now the "Cargo / folder 20″" preset) and summed to 260° —
 * over the "coverage exceeds frame" threshold, so clicking "Rear" on a fresh-load
 * fender would silently wall it in red. This rear pair sums to exactly 220°, on the
 * line but not over it.
 */
export const SIDE_COVERAGE: Record<Side, { lead: number; trail: number }> = {
  front: { lead: 55, trail: 120 },
  rear: { lead: 120, trail: 100 }
};
