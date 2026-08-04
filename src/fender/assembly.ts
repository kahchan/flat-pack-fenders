import type { FenderConfig, Geometry } from './types';

/**
 * WP29 (decision D1/D2): the fender as it is ASSEMBLED, before anything is unrolled or
 * projected.
 *
 * Round 3's WP23 placed each dart fastener straight into the flat pattern, and WP28's
 * preview re-derived the same fastener from a parallel formula. Two transcriptions of
 * one intent, and they disagreed (round 4 §9.35): the flat one used `d / skirt` where
 * the overlap triangle needs `(skirt - d) / skirt`, and the preview reproduced the same
 * inversion so it rendered the misalignment as though it were correct.
 *
 * So a feature is declared ONCE here, in assembled coordinates — an arc angle, a depth
 * below the skirt's free edge, and the list of panels it passes through. `develop.ts`
 * maps it into the flat pattern once per layer, and into 3D for the preview, through the
 * same function. Two holes that fasten one lap are literally the same feature seen from
 * two panels, so they cannot drift apart.
 */

/** A feature on the assembled fender. Coordinates are assembled, never flat. */
export interface DartFeature {
  kind: 'hole' | 'tongue' | 'score';
  /** Dart index, 1..n-1. Dart `k` is the seam between panel `k-1` and panel `k`. */
  dart: number;
  /** Which skirt this sits on: 0 = top rail pair, 3 = bottom (matches `pf()` order). */
  side: 0 | 3;
  /** Arc angle on the fender, radians. */
  aa: number;
  /** Depth below the skirt free edge, mm, flat measure. */
  depth: number;
  /**
   * Panels this feature passes through, upstream (outer, on top) first. One entry for a
   * single-layer feature like a `cinch` hole; two for anything through the lap. A
   * `score` channel pierces nothing and carries none.
   */
  layers: number[];
  /** Hole radius, mm. */
  r?: number;
  /** Along-arc width, mm — tongue and its receiving slot. */
  w?: number;
  /** Depth extent from `depth` toward the fold, mm — tongue and slot. */
  reach?: number;
  /** WP27 §27.2: set when this dart's fastener also closes a panel seam that landed on
   * top of it — the "four-layer corner". `pattern.ts` skips drawing that seam's own
   * fastener row when it sees this, and `r` above is already the bumped radius. */
  fourLayer?: boolean;
}

export interface Assembly {
  /** Fold-line mid angle of each panel, indexed 0..n-1. */
  panelMid: number[];
  features: DartFeature[];
}

/**
 * WP27 §27.2: how close a panel-seam fastener column has to land to a dart before the
 * two stop being separately fastenable and have to merge into one "four-layer corner"
 * instead — "rather than two holes a few mm apart". Matches the `SEAM_CLEAR` buffer
 * `pattern.ts` already keeps between unrelated fastener columns, so a seam that clears
 * every dart by this much never needed the merge in the first place.
 */
export const SEAM_MERGE_DIST = 6;

/** Extra hole radius at a merged four-layer corner — four thicknesses of material
 * through one fastener rather than two (round 3 §27.2: "a hole sized for four
 * thicknesses"). */
export const FOUR_LAYER_R_BONUS = 0.4;

/**
 * The dart index a panel-seam fastener column at flat `x` lands on top of, within reach
 * of that dart's own fastener — or `null` if it clears every dart. `x` should be the
 * seam's own fastener-row centre (`seamX + LAP/2`, matching `pattern.ts`), not the raw
 * cut line.
 *
 * `rivet`/`zip` put a single through-lap hole exactly at the dart's own centre
 * (`k·pitch`), so `SEAM_MERGE_DIST` alone is the reach. `cinch` puts ONE hole on each of
 * the two panels either side of the dart, `lap/2 + 6` mm outside the dart's own centre
 * (`off`, in the dart loop above) — physically, that tie already spans the dart AND (if
 * the seam lands here) the print-panel splice at the same place, since a seam this close
 * puts dart panel `k-1` and `k` on either side of the print seam too, so widening the
 * reach by that same `off` still finds one merge-able fastener, not a second, unrelated
 * one further down the sheet. `none` pierces nothing at the dart to merge with, and
 * `slot`'s tongue/receiving-slot is a shaped cut, not a plain hole a seam's row could
 * share — those two keep the seam's own fastener row, unmerged, at that location.
 */
export function mergedDartAt(s: FenderConfig, g: Geometry, x: number): number | null {
  if (g.n <= 1 || s.join === 'none' || s.join === 'slot') return null;
  const k = Math.round(x / g.pitch);
  if (k < 1 || k > g.n - 1) return null;
  const reach = SEAM_MERGE_DIST + (s.join === 'cinch' ? g.lap / 2 + 6 : 0);
  return Math.abs(x - k * g.pitch) <= reach ? k : null;
}

/** Mid angle of panel `p`'s fold chord — where its facet is tangent to the clearance
 * circle. Panels divide the arc evenly, so this is a plain multiple of the angular pitch.
 *
 * WP32: `dA`, not `pitch / R`. Those were the same number on a cylinder and are not on a
 * prism, where a facet of angular width `dA` has a chord of `2R·tan(dA/2) > R·dA`. */
export function panelMidAngle(g: Geometry, p: number): number {
  return g.aNose + (p + 0.5) * g.dA;
}

/** Angle of dart `k` — the shared vertex between panel `k-1` and panel `k`. */
export function dartAngle(g: Geometry, k: number): number {
  return g.aNose + k * g.dA;
}

/**
 * Radius at a given depth below the free edge. `depth` is a flat measure along the skirt
 * band (`g.skirt` wide); the real skirt is `g.skirtTrue` long, and `drop`/`proj` are
 * already derived from it, so the fraction is what carries between the two — not the
 * millimetres.
 */
export function radiusAtDepth(g: Geometry, depth: number): number {
  return g.R - depthFraction(g, depth) * g.drop;
}

/** Fraction of the skirt remaining between `depth` and the FOLD. 1 at the free edge,
 * 0 at the fold — the same fraction the overlap triangle grows by, which is why the
 * flat offset in `develop.ts` is proportional to it. */
export function depthFraction(g: Geometry, depth: number): number {
  if (g.skirt <= 0) return 0;
  return Math.max(0, Math.min(1, (g.skirt - depth) / g.skirt));
}

/** Hole radius and depths below the free edge, per join. Depths are absolute mm, not
 * fractions, so their spacing does not shrink on a shallow skirt (round 3 §23.6). */
const ZIP_DEPTHS = [3.5, 8.5];
const RIVET_DEPTHS = [4.5];

/** Punched tongue (round 3 §23.5): width along the arc, start depth, and reach. */
const TONGUE_W_SKIRT = 8;
const TONGUE_D0 = 2;

export function tongueReach(g: Geometry): number {
  return Math.max(2, Math.min(14, g.skirt * 0.45));
}

/**
 * Every dart feature on the assembled fender.
 *
 * The shingle runs nose→tail with the upstream panel on top — the same rule the panel
 * seams use — so for dart `k`, panel `k-1` is the outer layer and panel `k` the inner.
 * Anything passing through the lap lists them in that order.
 */
export function buildAssembly(
  s: FenderConfig,
  g: Geometry,
  mergedDarts: ReadonlySet<number> = new Set()
): Assembly {
  const panelMid: number[] = [];
  for (let p = 0; p < g.n; p++) panelMid.push(panelMidAngle(g, p));

  const features: DartFeature[] = [];
  const sides: (0 | 3)[] = [0, 3];

  for (let k = 1; k < g.n; k++) {
    const aa = dartAngle(g, k);

    if (s.join === 'none') {
      // Nothing pierced: one tie runs the girth in a scored channel. It sits on the
      // surface, so it pierces no layers at all.
      for (const side of sides) {
        features.push({ kind: 'score', dart: k, side, aa, depth: 0, layers: [] });
      }
      continue;
    }

    if (s.join === 'cinch') {
      // Round 3 §23.3: the butt seam's manner of attaching, on a lapped seam. The tie
      // never passes through the overlap — one hole per panel, OUTSIDE the band either
      // side — so each hole is single-layer, and the clearance is measured at the depth
      // the hole actually sits at.
      const depth = g.skirt * 0.5;
      const off = g.lap / 2 + 6;
      const rMid = radiusAtDepth(g, depth);
      // The clearance is a FLAT distance — `off` mm back from where the dart lands on
      // each panel — so it is converted through the same chord map `develop.ts` uses
      // rather than divided by a radius. On a prism those differ, and a fastener column
      // that drifts is what §9.35 was.
      const half = g.faceted ? Math.tan(g.dA / 2) : g.dA / 2;
      const back = (sign: number) =>
        g.faceted ? Math.atan(sign * (half - off / rMid)) : sign * (half - off / rMid);
      // WP27 §27.2: at a merged corner this tie is also what closes the print-panel
      // seam (see `mergedDartAt`'s doc comment) — a real fourth layer through the same
      // two holes, so they get the same radius bump `rivet`/`zip` do.
      const cinchFourLayer = mergedDarts.has(k);
      const cinchR = 2 + (cinchFourLayer ? FOUR_LAYER_R_BONUS : 0);
      for (const side of sides) {
        features.push(
          {
            kind: 'hole',
            dart: k,
            side,
            aa: panelMidAngle(g, k - 1) + back(1),
            depth,
            layers: [k - 1],
            r: cinchR,
            fourLayer: cinchFourLayer
          },
          {
            kind: 'hole',
            dart: k,
            side,
            aa: panelMidAngle(g, k) + back(-1),
            depth,
            layers: [k],
            r: cinchR,
            fourLayer: cinchFourLayer
          }
        );
      }
      continue;
    }

    if (s.join === 'slot') {
      // The punched tongue and its receiving slot are ONE assembled feature: the tongue
      // passes through the slot, so they occupy the same place on the built fender and
      // only separate when the two panels are unrolled. Declaring them as one is what
      // stops them drifting apart — the round-3 code placed them at ±lap/4 in the flat
      // and they could never have lined up.
      for (const side of sides) {
        features.push({
          kind: 'tongue',
          dart: k,
          side,
          aa,
          depth: TONGUE_D0,
          layers: [k - 1, k],
          w: TONGUE_W_SKIRT,
          reach: tongueReach(g)
        });
      }
      continue;
    }

    // rivet, zip — through the lap. One feature per hole; `develop.ts` emits it twice,
    // once per layer, at each panel's own developed position.
    const depths = s.join === 'zip' ? ZIP_DEPTHS : RIVET_DEPTHS;
    const fourLayer = mergedDarts.has(k);
    const r = (s.join === 'zip' ? 2 : 1.6) + (fourLayer ? FOUR_LAYER_R_BONUS : 0);
    for (const depth of depths) {
      for (const side of sides) {
        features.push({ kind: 'hole', dart: k, side, aa, depth, layers: [k - 1, k], r, fourLayer });
      }
    }
  }

  return { panelMid, features };
}
