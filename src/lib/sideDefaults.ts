import { COVERAGE } from '../fender/defaults';
import type { Side } from '../fender/types';

/**
 * Coverage the rail's Side selector jumps to when you switch fenders — a quick-start
 * nudge to sensible lead/trail for that mount, not a fresh geometry decision. Ported
 * from the design source (fender.html:1104), which hardcoded `front → 120/140` and
 * `rear → 60/200`.
 *
 * Neither pair is the source's literals any more (PLAN §13.1 / §9.16): both sides now
 * read `COVERAGE`, the single constant `DEFAULTS` and `PRESETS` also read, so this
 * table cannot drift from either of them again the way it drifted from `DEFAULTS`
 * once already. The source's `60/200` rear pair was the arc for the *original* file
 * default (now the "Cargo / folder 20″" preset) and summed to 260° — over the
 * "coverage exceeds frame" threshold, so clicking "Rear" on a fresh-load fender would
 * silently wall it in red. `COVERAGE.rear` sums to exactly 220°, on the line but not
 * over it.
 */
export const SIDE_COVERAGE: Record<Side, { lead: number; trail: number }> = COVERAGE;
