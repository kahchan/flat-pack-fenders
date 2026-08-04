import { D2, WHEELS } from './defaults';
import { depthFraction, ZIP_INNER_DEPTH, ZIP_LAP_MARGIN, ZIP_R } from './assembly';
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
 *             surplus is left in as a shingled overlap instead. Nothing narrows `lap` back
 *             down; see `joinFits()` for what that overlap can fasten.
 *
 *             WP29: this is `removal / n` exactly. Round 3 shipped `removal / n + t`,
 *             carrying over the one-thickness allowance the BUTT notch needed so its two
 *             folded edges had room to sit alongside each other. A lap has no such edges —
 *             the panels simply stack — so the thickness bought no overlap and the figure
 *             overstated it by a full `t` (0.8 mm against a 4.9 mm default lap, 16%),
 *             which fed straight into `joinFits()`.
 */
export function geo(s: FenderConfig): Geometry {
  const bsd = WHEELS[s.wheel].bsd;
  const tyreRcalc = bsd / 2 + s.tyre;
  const tyreR = s.measuredR > 0 ? s.measuredR : tyreRcalc;
  const R = tyreR + s.clear;

  const cov = s.lead + s.trail;
  const th = cov * D2;
  const aNose = -s.lead * D2;

  // WP32 §32.1: the developed length is the PERIMETER OF THE POLYGON, not the arc.
  //
  // WP31 established that the folded fender is a polygonal prism creasing at every dart
  // (a channel section does not curve smoothly; the dart slits are its relief). A flat
  // facet therefore sits inside its own design radius by the sagitta `R(1 - cos(dA/2))`
  // at its midpoint — 1.7 mm at 20 sections but 10.3 mm at 8 and 18.3 mm at 6, where the
  // fender simply fouls the tyre. `clear` is documented as the gap between tyre and
  // fender inner face, so that has to be the MINIMUM gap, not the gap at the corners.
  //
  // Hence the polygon circumscribes the clearance circle: facet midpoints sit on it and
  // the fold vertices move out to `R / cos(dA/2)`. The perimeter that needs is
  // `2n·R·tan(dA/2)`, up 0.2-0.4% on the shipped presets and 3.6% at 6 sections. Every
  // other term is unchanged in form — `pitch = L/n`, `removal = L·drop/R` and
  // `lap = removal/n` all still hold, because `lap = pitch·drop/R` either way.
  //
  // A dartless skirt has no crease lines, so nothing makes it a polygon: it keeps the
  // true arc. `dA < π` is the same guard from the other side — `tan` diverges at a
  // half-turn facet, which is not a fender.
  const nFlaps = s.flaps;
  const dA = nFlaps > 0 ? th / nFlaps : th;
  const faceted = nFlaps > 1 && dA < Math.PI - 1e-6;
  const L = faceted ? 2 * nFlaps * R * Math.tan(dA / 2) : R * th;

  // WP30 §30.2 (decisions D3/D4): the angle floor is derived, not a fixed 20°. A fender
  // flat enough to leave no shingle has nothing for any join to fasten, and whether a
  // given angle leaves any depends entirely on skirt depth and flap count — 20° is below
  // the real requirement for five of the six shipped presets, and above it for the sixth.
  //
  // `lap = L·skirtTrue·sin(a) / (R·n)`, so the floor falls straight out of `asin`, and
  // `null` when `sin` saturates first (§30.3: a high flap count on a shallow skirt is
  // simply unreachable — the UI names sections as the lever rather than pinning the
  // slider). Computed before `a` because it depends only on terms that do not involve
  // the angle, so there is no circularity.
  const sinNeeded =
    nFlaps > 1 && s.skirt > 0 ? (JOIN_LAP_NEEDED.cinch * R * nFlaps) / (L * s.skirt) : NaN;
  const angleMin =
    Number.isFinite(sinNeeded) && sinNeeded <= 1 ? (Math.asin(sinNeeded) * 180) / Math.PI : null;
  const angleEff = angleMin === null ? s.angle : Math.max(s.angle, angleMin);

  const a = angleEff * D2;
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
  const n = nFlaps;
  const pitch = n > 0 ? L / n : L;
  const removal = (L * drop) / R;
  const notch = 0;
  const lap = n > 1 ? removal / n : 0;

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
    lap,
    angleMin,
    angleEff,
    dA,
    faceted
  };
}

/**
 * WP23 §23.3 (decision C3): the join family, ordered by the lap each needs. `slot` is
 * the punched-tongue tab (§23.5) — same lap requirement as `zip` since it costs the
 * same sections, just no hardware.
 */
export const JOIN_ORDER: readonly JoinKey[] = ['none', 'cinch', 'rivet', 'zip', 'slot'];

/** Lap each join needs, mm. `zip` is not here — WP34 §34.4 derives it per-`Geometry`
 * in `zipLapNeeded()` below, since a fixed hole depth is a growing fraction of a
 * shallow skirt. `slot` keeps its own constant: it has no holes to derive from, and
 * its 11 mm figure was chosen to match zip's old constant only because it costs the
 * same sections — that reasoning doesn't change just because zip's number now moves. */
export const JOIN_LAP_NEEDED: Record<Exclude<JoinKey, 'zip'>, number> = {
  none: 0,
  cinch: 3,
  rivet: 7,
  slot: 11
};

/**
 * WP34 §34.4: the lap the zip pair needs, derived rather than a constant.
 *
 * The inner hole sits at a fixed `ZIP_INNER_DEPTH` below the free edge, so on a
 * shallow skirt it is a larger FRACTION of the skirt — and `develop.ts` establishes
 * that the overlap available at a depth `u` of the way down (1 at the free edge, 0 at
 * the fold) is `u·lap`, not `lap` itself. Requiring `(u·lap)/2 - r ≥ ZIP_LAP_MARGIN` on
 * each side of the inner hole and solving for `lap` gives the floor below. It rises as
 * the skirt shallows (15.7 mm at 20 mm, 7.5 mm at 60 mm) rather than sitting at one
 * value that is only right at one depth (§9.45's shape again). `depthFraction` clamps
 * to 0 once `ZIP_INNER_DEPTH` exceeds the skirt, so the result saturates at `Infinity`
 * exactly where the inner hole can no longer be placed at all — `zip` correctly never
 * reports as fitting there.
 */
export function zipLapNeeded(g: Geometry): number {
  const u = depthFraction(g, ZIP_INNER_DEPTH);
  return (2 * (ZIP_R + ZIP_LAP_MARGIN)) / u;
}

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
    const needed = join === 'zip' ? zipLapNeeded(g) : JOIN_LAP_NEEDED[join];
    const short = Math.max(0, needed - g.lap);
    return { join, needed, fits: short <= 1e-9, short };
  });
}

/**
 * §23.4's remedy, lever one: the largest flap count that still clears `needed` mm of
 * lap, holding skirt/angle fixed — `lap(n) = removal/n` falls as `n` grows, so this is a
 * ceiling, not a floor. `null` when the lever doesn't apply, i.e. a join that needs no
 * lap at all, which every flap count already clears.
 */
export function flapsForLap(g: Geometry, needed: number): number | null {
  if (needed <= 0) return null;
  return Math.max(1, Math.floor(g.removal / needed));
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
  if (needed <= 0) return 0;
  return (needed * g.R * g.n) / (g.L * sinA);
}

/**
 * WP30 §30.2 (decision D3): the shallowest skirt angle, in degrees, that still yields
 * `needed` mm of lap at the current skirt depth and flap count — the angle slider's
 * derived floor.
 *
 * `lap = L·skirtTrue·sin(a) / (R·n)`, so the angle falls straight out of `asin`. Returns
 * `null` when no angle can get there: `sin` saturates at 1, so a high flap count on a
 * shallow skirt is simply unreachable and the UI has to name sections as the lever
 * instead of pinning the slider (§30.3).
 */
export function angleForLap(g: Geometry, needed: number): number | null {
  if (g.n <= 1 || g.skirtTrue <= 0) return null;
  if (needed <= 0) return 0;
  const sinA = (needed * g.R * g.n) / (g.L * g.skirtTrue);
  if (sinA > 1) return null;
  return (Math.asin(sinA) * 180) / Math.PI;
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
