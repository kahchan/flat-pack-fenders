import { D2, f1 } from './defaults';
import { crownAt, geo, strutMount } from './geometry';
import { buildBlank } from './pattern';
import type { BlankModel, FacetPath, FenderConfig, Geometry, Hole, IsoModel, Path } from './types';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

/** Segments along the arc. Facet count is always `NS * 3` — see `pf` for the 3 rows. */
export const NS = 64;

/**
 * Rotate-slider default, degrees. Not config — see the port note on `spin` below.
 * Exported so the (future) rotate-slider UI can seed its initial state from the same
 * value this module defaults to, instead of duplicating the literal `18`.
 */
export const SPIN_DEFAULT = 18;

/**
 * The isometric preview: a 64-segment facet mesh over the developed skirt profile,
 * plus rails, wheel ghost, dart seams/fasteners, struts and the mudflap, all projected
 * through the same yaw rotation.
 *
 * `spin` (the rotate slider, degrees, default 18, range −80…80) is view state, not a
 * fender parameter — it never touches geometry.ts or FenderConfig — so it is a plain
 * argument here rather than a config field.
 *
 * Strut positions come from `blank.strutFrac` (computed once in pattern.ts) rather than
 * being recomputed, so the struts drawn here never drift from the holes actually cut in
 * the blank.
 */
export function buildIsometric(
  s: FenderConfig,
  g: Geometry = geo(s),
  spin: number = SPIN_DEFAULT,
  blank: BlankModel = buildBlank(s, g)
): IsoModel {
  const yaw = spin * D2;

  // Isometric-ish yaw projection: rotate about the vertical axis, then flatten the
  // rotated x/y into a 2D diamond and subtract z (height) to get screen y.
  const P = (x: number, y: number, z: number): Vec2 => {
    const xr = x * Math.cos(yaw) - y * Math.sin(yaw);
    const yr = x * Math.sin(yaw) + y * Math.cos(yaw);
    return [(xr - yr) * 0.866, (xr + yr) * 0.5 - z];
  };

  const aEnd = g.aNose + g.th;
  const xAt = (aa: number) => (aa - g.aNose) * g.R;

  // The four rail points of the developed cross-section at arc angle `aa`: free edge,
  // fold, fold, free edge — same shape as pattern.ts's yFreeT/yFoldT/yFoldB/yFreeB, but
  // expressed as [lateral offset, radial delta from R] pairs for the 3D lift in `p3`.
  const pf = (aa: number): [Vec2, Vec2, Vec2, Vec2] => {
    const c = crownAt(g, xAt(aa)) / 2;
    return [
      [-c - g.proj, -g.drop],
      [-c, 0],
      [c, 0],
      [c + g.proj, -g.drop]
    ];
  };

  // Lift a cross-section point onto the rolled cylinder at arc angle `aa`.
  const p3 = (v: Vec2, aa: number): Vec3 => {
    const r = g.R + v[1];
    return [v[0], r * Math.sin(aa), r * Math.cos(aa)];
  };

  const pt = (v: Vec2, aa: number): Vec2 => {
    const q = p3(v, aa);
    return P(q[0], q[1], q[2]);
  };

  const aAt = (i: number) => g.aNose + (g.th * i) / NS;

  // Facet shading ramp. The source interpolates between two literal RGB triples
  // (mix(t) = A + (B-A)*t) and emits `rgb(r,g,b)` per facet — but hard rule #2 forbids
  // hardcoded hex/rgb, and those exact endpoints are already tokenised in draw.css as
  // `--draw-facet-dark` / `--draw-facet-lit` bare "r, g, b" triples. `rgb(var(--token))`
  // alone can't express a numeric blend between two custom properties, so the ramp is
  // computed as a CSS `color-mix()` weight instead: the fraction `t` (0 = dark, 1 = lit)
  // is still worked out numerically in TS exactly as the source does, but the actual
  // channel interpolation happens in the browser from the two tokens, so no colour is
  // ever hardcoded here.
  const mix = (t: number): string =>
    `color-mix(in srgb, rgb(var(--draw-facet-lit)) ${f1(t * 100)}%, rgb(var(--draw-facet-dark)) ${f1((1 - t) * 100)}%)`;

  const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const note = (p: Vec2) => {
    if (p[0] < ext.x0) ext.x0 = p[0];
    if (p[0] > ext.x1) ext.x1 = p[0];
    if (p[1] < ext.y0) ext.y0 = p[1];
    if (p[1] > ext.y1) ext.y1 = p[1];
  };

  // ── Facets ─────────────────────────────────────────────────────────────────
  // Three quads per segment (outer skirt, crown, outer skirt), NS segments along the arc.
  const facets: FacetPath[] = [];
  for (let i = 0; i < NS; i++) {
    const a0 = aAt(i);
    const a1 = aAt(i + 1);
    const P0 = pf(a0);
    const P1 = pf(a1);
    for (let j = 0; j < 3; j++) {
      const q: Vec2[] = [pt(P0[j], a0), pt(P0[j + 1], a0), pt(P1[j + 1], a1), pt(P1[j], a1)];
      q.forEach(note);
      const u = Math.abs((i / NS) * 2 - 1);
      const shade = j === 1 ? 0.88 - 0.52 * u : 0.52 - 0.3 * u;
      facets.push({
        d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z`,
        fill: mix(Math.max(0.1, shade))
      });
    }
  }

  // ── Rails, caps, outline ────────────────────────────────────────────────────
  const rail = (j: number): string => {
    const p: string[] = [];
    for (let i = 0; i <= NS; i++) {
      const aa = aAt(i);
      const q = pt(pf(aa)[j], aa);
      p.push(`${f1(q[0])},${f1(q[1])}`);
    }
    return `M ${p.join(' L ')}`;
  };
  const railRev = (j: number): string => {
    const p: string[] = [];
    for (let i = NS; i >= 0; i--) {
      const aa = aAt(i);
      const q = pt(pf(aa)[j], aa);
      p.push(`${f1(q[0])},${f1(q[1])}`);
    }
    return p.join(' L ');
  };
  const cap = (aa: number): string =>
    `M ${pf(aa)
      .map((v) => {
        const q = pt(v, aa);
        return `${f1(q[0])},${f1(q[1])}`;
      })
      .join(' L ')}`;

  const edges: Path[] = [{ d: rail(1) }, { d: rail(2) }, { d: cap(g.aNose) }, { d: cap(aEnd) }];
  const outline: Path[] = [{ d: `${rail(0)} L ${railRev(3)} Z` }];

  // ── Wheel ghost ─────────────────────────────────────────────────────────────
  const wheel: Path[] = [];
  for (const offx of [-s.tyre / 2, s.tyre / 2]) {
    const p: Vec2[] = [];
    for (let i = 0; i <= 84; i++) {
      const aa = (i / 84) * 2 * Math.PI;
      const q = P(offx, g.tyreR * Math.sin(aa), g.tyreR * Math.cos(aa));
      note(q);
      p.push(q);
    }
    wheel.push({ d: `M ${p.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' L ')} Z` });
  }

  // ── Dart seams and their fasteners ──────────────────────────────────────────
  const seams: Path[] = [];
  const holes: Hole[] = [];
  const slots: Path[] = [];
  const lerp = (A: Vec2, B: Vec2, t: number): Vec2 => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];

  for (let i = 1; i < g.n; i++) {
    const aa = g.aNose + (g.th * i) / g.n;
    const pr = pf(aa);
    for (const side of [0, 3]) {
      const free = pr[side]!;
      const fold = pr[side === 0 ? 1 : 2]!;
      const A = pt(free, aa);
      const B = pt(fold, aa);
      seams.push({ d: `M ${f1(A[0])},${f1(A[1])} L ${f1(B[0])},${f1(B[1])}` });

      const ts = s.join === 'zip' ? [0.3, 0.78] : s.join === 'rivet' ? [0.4, 0.78] : [];
      for (const t of ts) {
        for (const dir of [-1, 1]) {
          const q = pt(lerp(free, fold, t), aa + (dir * (g.notch / 2 + 6)) / g.R);
          holes.push({ cx: f1(q[0]), cy: f1(q[1]), r: s.join === 'rivet' ? 1.6 : 2 });
        }
      }
      if (s.join === 'slot') {
        for (const dir of [-1, 1]) {
          const ao = aa + (dir * (g.notch / 2 + 6)) / g.R;
          const q1 = pt(lerp(free, fold, 0.28), ao);
          const q2 = pt(lerp(free, fold, 0.62), ao);
          slots.push({ d: `M ${f1(q1[0])},${f1(q1[1])} L ${f1(q2[0])},${f1(q2[1])}` });
        }
      }
    }
  }

  // Strut fastener holes, at the same arc positions the blank was actually pierced at.
  blank.strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr;
    const pr = pf(aa);
    for (const side of [0, 3]) {
      const free = pr[side]!;
      const fold = pr[side === 0 ? 1 : 2]!;
      for (const dir of [-1, 1]) {
        const q = pt(lerp(free, fold, 0.2), aa + (dir * 5) / g.R);
        holes.push({ cx: f1(q[0]), cy: f1(q[1]), r: 2.5 });
      }
    }
  });

  // ── Struts ───────────────────────────────────────────────────────────────────
  // Drawn at the TRUE `strutLen`, not clamped to the mount distance (PLAN §13.4) — an
  // over-long strut now visibly overshoots the hub instead of the slider silently
  // stopping the picture from growing past ~290 mm. warnings.ts's `strut-too-long`
  // check uses the same `strutMount()` to tell you when that's happening.
  const struts: Path[] = [];
  blank.strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr;
    const tan: Vec3 = [0, Math.cos(aa), -Math.sin(aa)];
    for (const side of [0, 3] as const) {
      const { from, to, len } = strutMount(s, g, fr, side);
      const dv: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const k = s.strutLen / len;
      const end: Vec3 = [from[0] + dv[0] * k, from[1] + dv[1] * k, from[2] + dv[2] * k];
      const q = (
        [
          [from[0] - tan[0] * 7, from[1] - tan[1] * 7, from[2] - tan[2] * 7],
          [from[0] + tan[0] * 7, from[1] + tan[1] * 7, from[2] + tan[2] * 7],
          [end[0] + tan[0] * 7, end[1] + tan[1] * 7, end[2] + tan[2] * 7],
          [end[0] - tan[0] * 7, end[1] - tan[1] * 7, end[2] - tan[2] * 7]
        ] as Vec3[]
      ).map((v) => P(v[0], v[1], v[2]));
      q.forEach(note);
      struts.push({ d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z` });
    }
  });

  // ── Mudflap ──────────────────────────────────────────────────────────────────
  const mudflap: Path[] = [];
  if (s.mudflap > 0) {
    const pr = pf(aEnd);
    const tan: Vec3 = [0, Math.cos(aEnd), -Math.sin(aEnd)];
    const A = p3(pr[1], aEnd);
    const B = p3(pr[2], aEnd);
    const extend = (v: Vec3): Vec3 => [v[0] + tan[0] * s.mudflap, v[1] + tan[1] * s.mudflap, v[2] + tan[2] * s.mudflap];
    const q = [A, B, extend(B), extend(A)].map((v) => P(v[0], v[1], v[2]));
    q.forEach(note);
    mudflap.push({ d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z` });
  }

  // ── Bounding box ─────────────────────────────────────────────────────────────
  const pad = 14;
  const bw = Math.max(1, ext.x1 - ext.x0) + pad * 2;
  const bh = Math.max(1, ext.y1 - ext.y0) + pad * 2;
  const viewBox = `${f1(ext.x0 - pad)} ${f1(ext.y0 - pad)} ${f1(bw)} ${f1(bh)}`;
  const aspect = `${f1(bw)} / ${f1(bh)}`;

  return { facets, edges, outline, wheel, seams, holes, slots, struts, mudflap, viewBox, aspect };
}
