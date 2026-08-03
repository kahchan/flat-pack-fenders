import { crownAt } from './geometry';
import { depthFraction, panelMidAngle } from './assembly';
import type { Assembly, DartFeature } from './assembly';
import type { Geometry } from './types';

/**
 * WP29 (decision D1/D2): unroll the assembled fender into the flat pattern, and lift it
 * back into 3D. Both directions go through the same panel map, so the flat blank and the
 * preview cannot disagree about where anything is.
 *
 * The map, derived rather than guessed:
 *
 *   The fold line is continuous — panel `p`'s fold occupies arc `[p·pitch, (p+1)·pitch]`
 *   exactly, and panels only overlap BELOW it. A folded panel is a rigid planar quad, so
 *   its free edge keeps the same length as its fold, but sits on a smaller radius
 *   (`R - drop`). A shorter circle carrying the same arc length subtends a wider angle,
 *   so consecutive free edges overlap. At a depth whose remaining distance to the fold is
 *   a fraction `u` of the skirt, the radius is `R - u·drop` and the overlap is `u·lap`.
 *
 *   Rigidity gives the whole map in one line: an arc-length offset `ξ` from a panel's own
 *   mid-line is preserved by folding, so
 *
 *       x_flat = (p + 0.5)·pitch + (aa − aMid(p)) · (R − u·drop)
 *
 *   Substituting the dart angle `aa = aNose + k·pitch/R` collapses to
 *   `x = k·pitch ∓ u·lap/2` for panels `k-1` and `k` — the two layers of one lap, which
 *   is why a single assembled feature lands correctly on both without being placed twice.
 *
 * Round 3 §23.6 specified `d/skirt` for that fraction. It is `(skirt − d)/skirt`: the
 * overlap is widest at the free edge and converges to zero at the fold, and the round-3
 * formula had it exactly backwards (round 4 §9.35). Nothing here restates that fraction —
 * it comes from `depthFraction` alone, so there is one place to be right.
 */

export type Vec3 = [number, number, number];

/**
 * WP32: on a prism a panel's fold line is a straight CHORD, not an arc, so the map from
 * flat offset to assembled angle is `tan`, not multiplication.
 *
 * A point at signed distance `ξ` along the fold chord from the panel's own mid-line sits
 * at perpendicular distance `rq` from the axis at that depth, giving polar angle
 * `aMid + atan(ξ / rq)`. At the mid-line the radius is exactly `rq` (the facet is tangent
 * to the clearance circle there); at the panel edge `ξ = pitch/2 = R·tan(dA/2)` and the
 * angle reaches exactly `aMid ± dA/2` — the shared vertex — which is what makes adjacent
 * panels meet corner to corner rather than overlapping at the fold.
 *
 * Below the fold the panel keeps its full flat width at every depth (it is rigid), while
 * `rq` shrinks, so it overreaches the vertex angle by more and more: that overreach IS the
 * shingle. Both panels do it symmetrically, so a fastener at the vertex angle lands on one
 * 3D point seen from two panels, exactly as in the smooth model — the invariant WP29's
 * coincidence test pins is unaffected by the change of curve.
 */
function chordRadius(g: Geometry, depth: number): number {
  return g.R - depthFraction(g, depth) * g.drop;
}

/** Flat-pattern position of an assembled point, as seen on one particular panel. */
export function flatX(g: Geometry, panel: number, aa: number, depth: number): number {
  const dphi = aa - panelMidAngle(g, panel);
  const rq = chordRadius(g, depth);
  const xi = g.faceted ? rq * Math.tan(dphi) : dphi * rq;
  return (panel + 0.5) * g.pitch + xi;
}

/** Inverse of `flatX`: the assembled arc angle a flat position on `panel` came from. */
export function assembledAngle(g: Geometry, panel: number, x: number, depth: number): number {
  const xi = x - (panel + 0.5) * g.pitch;
  const rq = chordRadius(g, depth);
  return panelMidAngle(g, panel) + (g.faceted ? Math.atan(xi / rq) : xi / rq);
}

/** Which panel an assembled angle falls on. Clamped, so an angle just outside the arc
 * (a lap overreaching the last vertex, a strut at the very tail) belongs to the end
 * panel rather than to nothing. */
export function panelAt(g: Geometry, aa: number): number {
  if (g.n <= 1 || g.dA <= 0) return 0;
  return Math.max(0, Math.min(g.n - 1, Math.floor((aa - g.aNose) / g.dA)));
}

/** Flat-pattern y of a point at `depth` below the free edge of skirt `side`. */
export function flatY(g: Geometry, x: number, depth: number, side: 0 | 3): number {
  const half = crownAt(g, x) / 2;
  return side === 0 ? g.yc - half - g.skirt + depth : g.yc + half + g.skirt - depth;
}

/**
 * The assembled 3D point. At depth 0 this is the free edge (`±(c + proj)`, radius
 * `R - drop`) and at depth `skirt` the fold (`±c`, radius `R`) — the same two rails
 * `isometric.ts`'s `pf()` describes, so the preview and this agree by construction
 * rather than by coincidence.
 */
export function point3(
  g: Geometry,
  panel: number,
  aa: number,
  depth: number,
  side: 0 | 3
): Vec3 {
  const u = depthFraction(g, depth);
  const rq = g.R - u * g.drop;
  // WP32: the point sits on a flat facet, so its distance from the axis grows away from
  // the facet's tangent point — `rq / cos(Δφ)` — instead of staying at `rq` the way it
  // does on a cylinder. At a vertex this is `rq / cos(dA/2)`, the circumscribed radius
  // the whole package is built around.
  const dphi = aa - panelMidAngle(g, panel);
  const r = g.faceted ? rq / Math.cos(dphi) : rq;
  // The crown taper is read at the FOLD, not at this depth. A skirt point inherits the
  // crown width of the fold point it hangs from, and the fold sits at radius `R` for
  // every depth — so both layers of a lap read the taper at the same developed position
  // and agree exactly. Reading it at `rq` instead made them differ by the local lap
  // width, which showed up as 0.2 mm of non-coincidence.
  const xFold = g.faceted
    ? (panel + 0.5) * g.pitch + g.R * Math.tan(dphi)
    : (panel + 0.5) * g.pitch + dphi * g.R;
  const c = crownAt(g, xFold) / 2;
  const lateral = (side === 0 ? -1 : 1) * (c + u * g.proj);
  return [lateral, r * Math.sin(aa), r * Math.cos(aa)];
}

/** A feature after unrolling: one flat instance, on one panel, of one assembled feature. */
export interface FlatFeature {
  kind: 'hole' | 'slot' | 'tongueCut' | 'score';
  /** Panel this instance was unrolled onto. */
  panel: number;
  side: 0 | 3;
  x: number;
  y: number;
  /** Depth below the free edge, mm — kept so the instance can be re-folded. */
  depth: number;
  /** Position in the assembled feature's layer stack. 0 = outer (upstream) panel. */
  layerIndex: number;
  /** The assembled angle this came from, so tests can check the round trip cheaply. */
  aa: number;
  r?: number;
  /** Tongue/slot footprint in the flat, mm. */
  w?: number;
  reach?: number;
  /** Far-depth x, so a tongue or slot can be cut as the trapezoid it really is: the
   * overlap narrows toward the fold, so the two ends do not sit at the same x. */
  xFar?: number;
}

/**
 * Unroll one assembled feature — once per layer it pierces.
 *
 * This is the whole point of the package. A `zip` hole through a lap is a single
 * `DartFeature`; it comes out of here as two flat holes, on two panels, at two different
 * x positions that fold back to the same place. Nothing downstream has to know that, and
 * nothing downstream can get it wrong.
 */
export function developFeature(g: Geometry, f: DartFeature): FlatFeature[] {
  if (f.kind === 'score') {
    // A surface channel, not a pierced feature: it crosses the crown and both skirts in
    // one line, so it belongs to no panel's overlap and takes no panel map. Its x is the
    // developed distance along the fold to this vertex — `dart × pitch`, since every
    // panel contributes exactly one pitch. (WP32: not `angle × R`, which is the arc and
    // no longer the developed length.)
    const x = f.dart * g.pitch;
    return [
      {
        kind: 'score',
        panel: Math.max(0, f.dart - 1),
        side: f.side,
        x,
        y: flatY(g, x, f.depth, f.side),
        depth: f.depth,
        layerIndex: 0,
        aa: f.aa
      }
    ];
  }

  return f.layers.map((panel, layerIndex) => {
    const x = flatX(g, panel, f.aa, f.depth);
    const base: FlatFeature = {
      // The outer layer carries the released tongue; the layer beneath carries the slot
      // it passes through. Same feature, different side of the joint.
      kind: f.kind === 'tongue' ? (layerIndex === 0 ? 'tongueCut' : 'slot') : 'hole',
      panel,
      side: f.side,
      x,
      y: flatY(g, x, f.depth, f.side),
      depth: f.depth,
      layerIndex,
      aa: f.aa
    };
    if (f.r !== undefined) base.r = f.r;
    if (f.w !== undefined) base.w = f.w;
    if (f.reach !== undefined) {
      base.reach = f.reach;
      base.xFar = flatX(g, panel, f.aa, f.depth + f.reach);
    }
    return base;
  });
}

/** Unroll every feature on the assembly. */
export function develop(g: Geometry, asm: Assembly): FlatFeature[] {
  return asm.features.flatMap((f) => developFeature(g, f));
}

/**
 * Re-fold a developed feature to the assembled point it came from. Used by the preview
 * (so it draws the built fender, not a transcription of the flat one) and by the
 * coincidence test, which asserts that every layer of one feature refolds to the same
 * place — the check that would have caught §9.35 the day it was written.
 */
export function refold(g: Geometry, ff: FlatFeature): Vec3 {
  return point3(g, ff.panel, assembledAngle(g, ff.panel, ff.x, ff.depth), ff.depth, ff.side);
}
