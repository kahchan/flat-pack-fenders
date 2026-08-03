import { D2, f1 } from './defaults';
import { crownAt, geo, strutMount } from './geometry';
import { buildBlank } from './pattern';
import type { BlankModel, FacetPath, FenderConfig, Geometry, Hole, IsoModel, Path } from './types';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

/**
 * WP28 §28.1/§28.2 (decision C5): the crown is a genuinely smooth cylinder (a sheet
 * bent round the wheel), so its segment count is a faithful render, not an exemption —
 * this is now the ONLY band that uses a fixed segment count. The skirt used to share
 * it (a flat `NS`-facet sweep regardless of flap count); it now cuts to `g.n` hard
 * edges instead, see the facet loop below.
 */
export const NS = 64;

/**
 * Rotate-slider default, degrees. Not config — see the port note on `spin` below.
 * Exported so the (future) rotate-slider UI can seed its initial state from the same
 * value this module defaults to, instead of duplicating the literal `18`.
 */
export const SPIN_DEFAULT = 18;

/**
 * The isometric preview: real cut geometry, not a shaded proxy for it (WP28 §28.2,
 * decision C5).
 *
 * `pf(aa)` returns the four rails at arc angle `aa` — 0–1 and 2–3 are skirt, 1–2 is
 * crown. The facet loop below splits along that boundary: skirt bands are `g.n` flat,
 * hard-edged panels (one per section, matching the flat pattern's own darts exactly —
 * WP23's shingled lap replaced the V-notch with a plain slit, so there is exactly one
 * hard edge per pitch, not a smoothed one); the crown band stays the old smooth `NS`
 * sweep. `thick` now renders as a real offset second rail, so the doubled material at
 * each lap reads as a physical step and the free edges/arc ends show an edge face,
 * instead of `thick` only ever driving the bend maths invisibly.
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

  // WP28 §28.2 — the sheet's real thickness, offset inward (toward the hub: smaller
  // radius) along the same [lateral, radial] pair `pf` already uses. Used for the free
  // edges and the lap step, so "inward" always means the same thing a cross-section of
  // the actual folded sheet would show.
  const inward = (v: Vec2): Vec2 => [v[0], v[1] - g.t];

  // Lift a cross-section point onto the rolled cylinder at arc angle `aa`.
  const p3 = (v: Vec2, aa: number): Vec3 => {
    const r = g.R + v[1];
    return [v[0], r * Math.sin(aa), r * Math.cos(aa)];
  };

  const pt = (v: Vec2, aa: number): Vec2 => {
    const q = p3(v, aa);
    return P(q[0], q[1], q[2]);
  };

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

  const quad = (q: Vec2[]): string => `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z`;

  // ── Facets ─────────────────────────────────────────────────────────────────
  // Skirt bands: `g.n` flat, hard-edged panels — a dartless config (`g.n <= 1`, WP23
  // §23.2's real branch) is exactly one panel spanning the whole arc, not a division by
  // zero. Crown band: the old smooth `NS`-segment sweep, unchanged — a sheet bent round
  // the wheel really is a smooth cylinder (§28.2).
  const nSkirt = Math.max(1, g.n);
  const aAtSkirt = (i: number) => g.aNose + (g.th * i) / nSkirt;
  const aAtCrown = (i: number) => g.aNose + (g.th * i) / NS;

  const facets: FacetPath[] = [];

  // Top skirt (rails 0-1), bottom skirt (rails 2-3): `g.n` panels each.
  for (const j of [0, 2] as const) {
    for (let i = 0; i < nSkirt; i++) {
      const a0 = aAtSkirt(i);
      const a1 = aAtSkirt(i + 1);
      const P0 = pf(a0);
      const P1 = pf(a1);
      const q = [pt(P0[j], a0), pt(P0[j + 1], a0), pt(P1[j + 1], a1), pt(P1[j], a1)];
      q.forEach(note);
      const u = Math.abs((i / nSkirt) * 2 - 1);
      const shade = 0.52 - 0.3 * u;
      facets.push({ d: quad(q), fill: mix(Math.max(0.1, shade)) });
    }
  }

  // Crown (rails 1-2): smooth, NS segments.
  for (let i = 0; i < NS; i++) {
    const a0 = aAtCrown(i);
    const a1 = aAtCrown(i + 1);
    const P0 = pf(a0);
    const P1 = pf(a1);
    const q = [pt(P0[1], a0), pt(P0[2], a0), pt(P1[2], a1), pt(P1[1], a1)];
    q.forEach(note);
    const u = Math.abs((i / NS) * 2 - 1);
    const shade = 0.88 - 0.52 * u;
    facets.push({ d: quad(q), fill: mix(Math.max(0.1, shade)) });
  }

  // WP28 §28.2 — real thickness at the two free edges: a second rail offset `inward`
  // by `g.t`, so the cut edge reads as a physical step instead of a knife edge. Zero at
  // `t = 0` (the ideal zero-thickness pattern), so it draws nothing there rather than a
  // degenerate sliver.
  if (g.t > 0) {
    for (const j of [0, 3] as const) {
      for (let i = 0; i < nSkirt; i++) {
        const a0 = aAtSkirt(i);
        const a1 = aAtSkirt(i + 1);
        const outer0 = pf(a0)[j];
        const outer1 = pf(a1)[j];
        const q = [pt(outer0, a0), pt(inward(outer0), a0), pt(inward(outer1), a1), pt(outer1, a1)];
        q.forEach(note);
        facets.push({ d: quad(q), fill: mix(0.05) });
      }
    }
  }

  // WP28 §28.2 — the lap step: WP23 §23.2 left the take-up in as a real shingled
  // overlap (`g.lap`) instead of cutting it away, so at every interior dart the
  // downstream panel's free edge genuinely sits proud of the one it laps under by one
  // thickness. Rendered as a small raised riser, `g.lap` mm wide (converted to the arc
  // angle it subtends) and `g.t` tall, at the downstream panel's leading edge — drawn
  // AFTER that panel's own facet so it reads as sitting on top of it. Absent when there
  // is no lap to show (`g.lap <= 0`: dartless, or zero thickness).
  if (g.lap > 0 && nSkirt > 1) {
    const dAngle = g.lap / g.R;
    for (const j of [0, 3] as const) {
      for (let i = 1; i < nSkirt; i++) {
        const a0 = aAtSkirt(i);
        const a1 = a0 + dAngle;
        const outer0 = pf(a0)[j];
        const outer1 = pf(a1)[j];
        const q = [pt(outer0, a0), pt(inward(outer0), a0), pt(inward(outer1), a1), pt(outer1, a1)];
        q.forEach(note);
        facets.push({ d: quad(q), fill: mix(0.05) });
      }
    }
  }

  // ── Rails, caps, outline ────────────────────────────────────────────────────
  const rail = (j: number): string => {
    const p: string[] = [];
    for (let i = 0; i <= NS; i++) {
      const aa = aAtCrown(i);
      const q = pt(pf(aa)[j], aa);
      p.push(`${f1(q[0])},${f1(q[1])}`);
    }
    return `M ${p.join(' L ')}`;
  };
  const railRev = (j: number): string => {
    const p: string[] = [];
    for (let i = NS; i >= 0; i--) {
      const aa = aAtCrown(i);
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
  // `noteWheel` tracks the wheel's own bounding box separately from `ext` (below), so
  // it can anchor the viewBox to `tyreR` — already absolute — instead of to whatever
  // the fender's own extent happens to be (PLAN §14).
  const wheelExt = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const noteWheel = (p: Vec2) => {
    if (p[0] < wheelExt.x0) wheelExt.x0 = p[0];
    if (p[0] > wheelExt.x1) wheelExt.x1 = p[0];
    if (p[1] < wheelExt.y0) wheelExt.y0 = p[1];
    if (p[1] > wheelExt.y1) wheelExt.y1 = p[1];
  };
  const wheel: Path[] = [];
  for (const offx of [-s.tyre / 2, s.tyre / 2]) {
    const p: Vec2[] = [];
    for (let i = 0; i <= 84; i++) {
      const aa = (i / 84) * 2 * Math.PI;
      const q = P(offx, g.tyreR * Math.sin(aa), g.tyreR * Math.cos(aa));
      note(q);
      noteWheel(q);
      p.push(q);
    }
    wheel.push({ d: `M ${p.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' L ')} Z` });
  }

  // ── Dart seams and their fasteners (WP23 §23.3/§23.6) ───────────────────────
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
    }

    if (s.join === 'none') continue;

    if (s.join === 'cinch') {
      // Outside the lap band, same clearance the flat pattern uses — see pattern.ts.
      const off = (g.lap / 2 + 6) / g.R;
      for (const dir of [-1, 1]) {
        const ao = aa + dir * off;
        const pro = pf(ao);
        for (const side of [0, 3] as const) {
          const free = pro[side]!;
          const fold = pro[side === 0 ? 1 : 2]!;
          const q = pt(lerp(free, fold, 0.5), ao);
          holes.push({ cx: f1(q[0]), cy: f1(q[1]), r: 2 });
        }
      }
      continue;
    }

    if (s.join === 'slot') {
      // The punched tongue (§23.5): a release-cut outline in the upstream panel and a
      // receiving slot in the downstream one, drawn as real line geometry — same
      // absolute reach/width pattern.ts cuts, same "forward panel on top" shingle
      // direction.
      const tw = 8;
      const reach = Math.max(2, Math.min(14, g.skirt * 0.45));
      const d0 = 2;
      const aTongue = aa - g.lap / 4 / g.R;
      const aSlot = aa + g.lap / 4 / g.R;
      const dw = tw / 2 / g.R;
      for (const side of [0, 3] as const) {
        const dirIn = side === 0 ? 1 : -1;
        const near = (v: Vec2): Vec2 => [v[0], v[1] + dirIn * d0];
        const far = (v: Vec2): Vec2 => [v[0], v[1] + dirIn * (d0 + reach)];

        const freeT = pf(aTongue)[side]!;
        const t1 = pt(near(freeT), aTongue - dw);
        const t2 = pt(far(freeT), aTongue - dw);
        const t3 = pt(far(freeT), aTongue + dw);
        const t4 = pt(near(freeT), aTongue + dw);
        slots.push({
          d: `M ${f1(t1[0])},${f1(t1[1])} L ${f1(t2[0])},${f1(t2[1])} L ${f1(t3[0])},${f1(t3[1])} L ${f1(t4[0])},${f1(t4[1])} Z`
        });

        const freeS = pf(aSlot)[side]!;
        const s1 = pt(near(freeS), aSlot - dw);
        const s2 = pt(far(freeS), aSlot - dw);
        const s3 = pt(far(freeS), aSlot + dw);
        const s4 = pt(near(freeS), aSlot + dw);
        slots.push({
          d: `M ${f1(s1[0])},${f1(s1[1])} L ${f1(s2[0])},${f1(s2[1])} L ${f1(s3[0])},${f1(s3[1])} L ${f1(s4[0])},${f1(s4[1])} Z`
        });
      }
      continue;
    }

    // rivet, zip — through the lap, slanted per §23.6, same depths pattern.ts uses.
    const depths = s.join === 'zip' ? [3.5, 8.5] : [4.5];
    const r = s.join === 'zip' ? 2 : 1.6;
    for (const d of depths) {
      const t = g.skirt > 0 ? d / g.skirt : 0;
      for (const dir of [-1, 1]) {
        const ao = aa + (dir * t * (g.lap / 2)) / g.R;
        const pro = pf(ao);
        for (const side of [0, 3] as const) {
          const free = pro[side]!;
          const fold = pro[side === 0 ? 1 : 2]!;
          const q = pt(lerp(free, fold, t), ao);
          holes.push({ cx: f1(q[0]), cy: f1(q[1]), r });
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
  // PLAN §14 — the old viewBox was a tight fit around `ext` (the whole model's extent),
  // so a bigger fender always grew the viewBox and shrank the wheel drawn inside it,
  // even though the wheel ghost never moved in mm terms. `wheelExt` is a floor anchored
  // only on `tyreR`/`s.tyre`/`spin` — never on crown, skirt or clearance — so it stays
  // fixed while those are dragged and only yields once the fender's own content
  // genuinely needs more room than the wheel does. Centring on the content's own
  // midpoint (rather than its corner) keeps that extra room symmetric instead of piling
  // it on one side. Rounding up to the next 10 mm is the hysteresis: most slider moves
  // land in the same 10 mm bucket and redraw nothing.
  const pad = 14;
  const cx = (ext.x0 + ext.x1) / 2;
  const cy = (ext.y0 + ext.y1) / 2;
  const contentBw = Math.max(1, ext.x1 - ext.x0) + pad * 2;
  const contentBh = Math.max(1, ext.y1 - ext.y0) + pad * 2;
  const wheelBw = Math.max(1, wheelExt.x1 - wheelExt.x0) + pad * 2;
  const wheelBh = Math.max(1, wheelExt.y1 - wheelExt.y0) + pad * 2;
  const bw = Math.ceil(Math.max(contentBw, wheelBw) / 10) * 10;
  const bh = Math.ceil(Math.max(contentBh, wheelBh) / 10) * 10;
  const viewBox = `${f1(cx - bw / 2)} ${f1(cy - bh / 2)} ${f1(bw)} ${f1(bh)}`;
  const aspect = `${f1(bw)} / ${f1(bh)}`;

  return { facets, edges, outline, wheel, seams, holes, slots, struts, mudflap, viewBox, aspect };
}
