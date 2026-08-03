import { D2, WHEELS } from './defaults';
import type { FenderConfig, Geometry, JoinKey } from './types';

/**
 * Every derived dimension, from 23 inputs.
 *
 * Ported verbatim from the design source so the numbers can be diffed term by term.
 * Golden values live in the fixture tests — change anything here and they will tell you.
 *
 * The two terms worth understanding before touching this:
 *
 *   bendComp  A fold does not consume the length a sharp corner would. The flat pattern
 *             needs each leg measured to the theoretical sharp corner, minus twice the
 *             setback, plus the arc along the neutral axis. It comes out NEGATIVE — folds
 *             SHORTEN the flat skirt. Bend radius is taken as thickness (a hand fold over
 *             a straight edge, not a press brake) and k-factor as 0.44, the usual figure
 *             for soft sheet in air bending. At t = 0 every term collapses to zero.
 *
 *   lap       The blank is a developable cylinder along its length, so bending it round
 *             the wheel is free. Folding the skirts down is not: the skirt free edge sits
 *             on a smaller radius than the fold line, so it must be shorter than a plain
 *             butt fit. WP23 §23.2 (decision C1/C2): rather than cutting that surplus away
 *             as a V-notch, the dart is cut as a plain slit (`notch` is always 0) and the
 *             surplus is left in as a shingled overlap instead — `lap`, maximised, plus
 *             one thickness so the two folded edges have room to sit alongside each other.
 *             Nothing narrows `lap` back down; see `joinFits()` for what that overlap can
 *             fasten.
 */
export function geo(s: FenderConfig): Geometry {
  const bsd = WHEELS[s.wheel].bsd;
  const tyreRcalc = bsd / 2 + s.tyre;
  const tyreR = s.measuredR > 0 ? s.measuredR : tyreRcalc;
  const R = tyreR + s.clear;

  const cov = s.lead + s.trail;
  const th = cov * D2;
  const aNose = -s.lead * D2;
  const L = R * th;

  const a = s.angle * D2;
  const proj = s.skirt * Math.cos(a);
  const drop = s.skirt * Math.sin(a);

  const t = s.thick;
  const rBend = Math.max(t, 0.2);
  const setback = (rBend + t) * Math.tan(a / 2);
  const BA = a * (rBend + 0.44 * t);
  const bendComp = BA - 2 * setback;

  const hem = s.hem ? 2 * t + 4 : 0;
  const skirtFlat = Math.max(2, s.skirt + bendComp + hem);

  const crownTail = s.crown * (1 - s.taper / 100);
  const knee = (s.taperAt / 100) * L;
  const Wd = s.crown + 2 * skirtFlat;

  // WP23 §23.2: a dartless skirt (n <= 1, no darts at all) is a real, drawable branch,
  // not an error — `pitch`/`lap` guard against it explicitly rather than trusting `n`
  // to stay positive, since geo() is called directly in tests with configs the UI's own
  // flaps slider (min 4) could never reach.
  const n = s.flaps;
  const pitch = n > 0 ? L / n : L;
  const removal = (L * drop) / R;
  const notch = 0;
  const lap = n > 1 ? removal / n + t : 0;

  return {
    bsd,
    tyreRcalc,
    tyreR,
    R,
    cov,
    th,
    aNose,
    L,
    a,
    skirt: skirtFlat,
    skirtTrue: s.skirt,
    t,
    rBend,
    setback,
    BA,
    bendComp,
    hem,
    proj,
    drop,
    crown0: s.crown,
    crownTail,
    knee,
    Wd,
    yc: Wd / 2,
    n,
    pitch,
    removal,
    notch,
    lap
  };
}

/**
 * WP23 §23.3 (decision C3): the join family, ordered by the lap each needs. `slot` is
 * the punched-tongue tab (§23.5) — same lap requirement as `zip` since it costs the
 * same sections, just no hardware.
 */
export const JOIN_ORDER: readonly JoinKey[] = ['none', 'cinch', 'rivet', 'zip', 'slot'];

export const JOIN_LAP_NEEDED: Record<JoinKey, number> = {
  none: 0,
  cinch: 3,
  rivet: 7,
  zip: 11,
  slot: 11
};

export interface JoinFit {
  join: JoinKey;
  /** Lap this join needs, mm. */
  needed: number;
  fits: boolean;
  /** How far short of fitting, mm. 0 when it already fits. */
  short: number;
}

/**
 * §23.4: reported for every join, always — the selector never disables an option, it
 * says what fits and what falls short. `cinch`'s 0 mm floor (once `none` fits, `cinch`
 * always does too) is what makes "nothing fits" unreachable (§23.3).
 */
export function joinFits(g: Geometry): JoinFit[] {
  return JOIN_ORDER.map((join) => {
    const needed = JOIN_LAP_NEEDED[join];
    const short = Math.max(0, needed - g.lap);
    return { join, needed, fits: short <= 1e-9, short };
  });
}

/**
 * §23.4's remedy, lever one: the largest flap count that still clears `needed` mm of
 * lap, holding skirt/angle fixed — `lap(n) = removal/n + t` falls as `n` grows, so this
 * is a ceiling, not a floor. `null` when the lever doesn't apply: `lap` never drops
 * below `t`, so any flap count clears a `needed` at or under it.
 */
export function flapsForLap(g: Geometry, needed: number): number | null {
  if (needed <= g.t) return null;
  return Math.max(1, Math.floor(g.removal / (needed - g.t)));
}

/**
 * §23.4's remedy, lever two: the raw skirt length (the `skirt` config field, not the
 * flat-pattern `g.skirt`) that brings the lap up to `needed` mm, holding flap count and
 * angle fixed. `null` when there are no darts to lap (`n <= 1`) or the angle is flat
 * (`sin(a) <= 0`, no drop to trade against).
 */
export function skirtForLap(g: Geometry, needed: number): number | null {
  if (g.n <= 1) return null;
  const sinA = Math.sin(g.a);
  if (sinA <= 0) return null;
  const extra = needed - g.t;
  if (extra <= 0) return 0;
  return (extra * g.R * g.n) / (g.L * sinA);
}

/**
 * Crown width at distance x along the arc.
 *
 * Held constant until the taper knee, then interpolated linearly to the tail. Because
 * every dart is computed from the LOCAL crown width, the pattern edge follows the taper
 * automatically — dart positions do not move, the edge they sit on does.
 */
export function crownAt(g: Geometry, x: number): number {
  if (g.L <= g.knee || x <= g.knee) return g.crown0;
  return g.crown0 + (g.crownTail - g.crown0) * ((x - g.knee) / (g.L - g.knee));
}

/** The four y-rails of the blank at distance x along the arc, top to bottom. */
export function rails(g: Geometry, x: number) {
  const half = crownAt(g, x) / 2;
  return {
    freeTop: g.yc - half - g.skirt,
    foldTop: g.yc - half,
    foldBottom: g.yc + half,
    freeBottom: g.yc + half + g.skirt
  };
}

/**
 * Real 3D distance (mm) from a strut's fender-side mount — at arc fraction `frac`,
 * skirt `side` (0 or 3, matching isometric.ts's `pf()` point order) — to its
 * frame-side end near the hub. Independent of the isometric view's yaw: it works in
 * the same real-space cylindrical coordinates isometric.ts lifts a cross-section point
 * onto (`p3`) *before* any view rotation is applied, so it is the actual span a strut
 * has to cover, not a projected one.
 *
 * Extracted so isometric.ts (drawing the true strut length, PLAN §13.4) and
 * warnings.ts (warning when `strutLen` overshoots it, same package) share one
 * definition instead of quietly drifting apart. `from`/`to` are returned alongside
 * `len` so isometric.ts's drawing code — which also needs the mount point itself for
 * the strut's quad corners — can reuse them without recomputing.
 */
export function strutMount(
  s: FenderConfig,
  g: Geometry,
  frac: number,
  side: 0 | 3
): { from: [number, number, number]; to: [number, number, number]; len: number } {
  const aa = g.aNose + g.th * frac;
  const c = crownAt(g, (aa - g.aNose) * g.R) / 2;
  const v: [number, number] = side === 0 ? [-c - g.proj, -g.drop] : [c + g.proj, -g.drop];
  const r = g.R + v[1];
  const from: [number, number, number] = [v[0], r * Math.sin(aa), r * Math.cos(aa)];
  const to: [number, number, number] = [
    Math.sign(v[0]) * (s.tyre / 2 + 6),
    from[1] * 0.2,
    from[2] * 0.2
  ];
  const dv: [number, number, number] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(dv[0], dv[1], dv[2]) || 1;
  return { from, to, len };
}
