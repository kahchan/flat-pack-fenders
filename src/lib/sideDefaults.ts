import { DEFAULTS } from '../fender/defaults';
import type { Side } from '../fender/types';

/**
 * Coverage the rail's Side selector jumps to when you switch fenders — a quick-start
 * nudge to sensible lead/trail for that mount, not a fresh geometry decision. Ported
 * from the design source (fender.html:1104), which hardcoded `front → 120/140` and
 * `rear → 60/200`.
 *
 * The rear pair is deliberately NOT the source's literal `60/200`: that was the arc for
 * the *original* file default (now the "Cargo / folder 20″" preset), and 60+200 = 260°
 * of coverage trips the very "coverage exceeds frame" warning PLAN §9.5 picked the new
 * rear default to avoid. Clicking "Rear" on a fresh-load fender would silently wall it
 * in red — the exact trap §5's preset-table correction already fixed once for the
 * "Rear commuter 700c" preset. Pointing this at `DEFAULTS` instead keeps the two in sync
 * for good, the same way that correction did.
 */
export const SIDE_COVERAGE: Record<Side, { lead: number; trail: number }> = {
  front: { lead: 120, trail: 140 },
  rear: { lead: DEFAULTS.lead, trail: DEFAULTS.trail }
};
