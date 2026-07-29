import { D2, WHEELS } from './defaults';
import type { FenderConfig, Geometry } from './types';

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
 *   notch     The blank is a developable cylinder along its length, so bending it round
 *             the wheel is free. Folding the skirts down is not: the skirt free edge sits
 *             on a smaller radius than the fold line, so it must be shorter. Each dart
 *             removes exactly that surplus, plus one thickness so the two folded edges
 *             sit alongside each other instead of colliding.
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

  const n = s.flaps;
  const pitch = L / n;
  const removal = (L * drop) / R;
  const notch = removal / n + t;

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
    notch
  };
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
