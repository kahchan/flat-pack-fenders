import { D2, f1 } from './defaults';
import { buildAssembly, panelMidAngle } from './assembly';
import { panelAt, point3 } from './develop';
import { crownAt, geo, strutMount } from './geometry';
import { buildBlank } from './pattern';
import type { BlankModel, FacetPath, FenderConfig, Geometry, Hole, IsoModel, Path } from './types';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

/**
 * Segments in the wheel ghost only. Every part of the FENDER is now faceted at `g.n`
 * (see the facet loop) — the crown's old fixed-`NS` sweep was the last place the preview
 * drew a shape the fender does not take.
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
 * crown. ALL THREE bands are `g.n` flat, hard-edged panels: one per section, creasing at
 * the flat pattern's own dart lines. WP23's shingled lap replaced the V-notch with a
 * plain slit, so there is exactly one hard edge per pitch.
 *
 * The crown kept a smooth sweep until now, on the argument that a sheet bent round the
 * wheel is a developable cylinder. That is true of the flat blank and false of the
 * folded part: once both skirts are turned down the section is a channel, which is far
 * stiffer about the axle than the flat strip was and creases at whatever relief it is
 * given rather than curving. The dart slits are that relief. The built fender is a
 * polygonal prism, and the preview now draws one.
 *
 * `thick` renders as a real offset second rail, so the doubled material at each lap
 * reads as a physical step and the free edges/arc ends show an edge face, instead of
 * `thick` only ever driving the bend maths invisibly.
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
  // WP32: developed position along the fold. On a prism the fold is a chord, so this is
  // the panel's own start plus `R·tan(Δφ)`, not a plain `angle × R`. Only used to read
  // the crown taper, but the two differ by the same 0.2-0.4% the perimeter does and there
  // is no reason for the preview to read the taper at a different place than the blank.
  const xAt = (aa: number) => {
    if (!g.faceted) return (aa - g.aNose) * g.R;
    const p = panelAt(g, aa);
    return (p + 0.5) * g.pitch + g.R * Math.tan(aa - panelMidAngle(g, p));
  };

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

  // Lift a cross-section point onto the fender at arc angle `aa`.
  //
  // WP32: onto the PRISM, not a cylinder. `R + v[1]` is the perpendicular distance from
  // the axis to the facet the point sits on; the point's actual distance grows away from
  // that facet's tangent line as `1/cos(Δφ)`, reaching `/cos(dA/2)` at a vertex. That is
  // exactly the circumscribed radius `L` is now the perimeter of, so the drawn shape and
  // the cut length describe the same solid. A dartless skirt has no facets and keeps the
  // plain cylindrical lift.
  const p3 = (v: Vec2, aa: number): Vec3 => {
    const rq = g.R + v[1];
    const r = g.faceted ? rq / Math.cos(aa - panelMidAngle(g, panelAt(g, aa))) : rq;
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
  // Every band is `g.n` flat, hard-edged panels. A dartless config (`g.n <= 1`, WP23
  // §23.2's real branch) is exactly one panel spanning the whole arc, not a division by
  // zero.
  //
  // The crown used to keep a smooth `NS`-segment sweep on the argument that a sheet bent
  // round the wheel is a developable cylinder (§28.2). That reasoning was about the FLAT
  // BLANK, not the folded part. Once both skirts are turned down, the section is a
  // channel, and a channel bent the hard way does not curve smoothly — it is far stiffer
  // in that direction than the flat strip was, and it kinks at whatever relief it is
  // given. The dart slits ARE that relief. So the built fender is a polygonal prism that
  // creases at every dart line, and the crown facets exactly like the skirt.
  const nSkirt = Math.max(1, g.n);
  const aAtSkirt = (i: number) => g.aNose + (g.th * i) / nSkirt;
  const aAtCrown = aAtSkirt;

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

  // Crown (rails 1-2): `g.n` flat facets, creasing at each dart line like the skirt.
  for (let i = 0; i < nSkirt; i++) {
    const a0 = aAtCrown(i);
    const a1 = aAtCrown(i + 1);
    const P0 = pf(a0);
    const P1 = pf(a1);
    const q = [pt(P0[1], a0), pt(P0[2], a0), pt(P1[2], a1), pt(P1[1], a1)];
    q.forEach(note);
    const u = Math.abs((i / nSkirt) * 2 - 1);
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
    for (let i = 0; i <= nSkirt; i++) {
      const aa = aAtCrown(i);
      const q = pt(pf(aa)[j], aa);
      p.push(`${f1(q[0])},${f1(q[1])}`);
    }
    return `M ${p.join(' L ')}`;
  };
  const railRev = (j: number): string => {
    const p: string[] = [];
    for (let i = nSkirt; i >= 0; i--) {
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

  // ── Dart seams and their fasteners (WP29 §29.3, decisions D1/D2) ────────────
  //
  // No fastener position is computed here any more. `assembly.ts` declares each one
  // once, in assembled coordinates, and `point3` places it — the same function
  // `develop.ts` inverts to reach the flat pattern. Round 4 §9.36: the old code
  // transcribed the FLAT offset into an arc angle (`aa ± t·(lap/2)/R`), which drew a
  // through-lap fastener at two arc positions when the assembled fender has exactly
  // one, and so reproduced §9.35's inverted slant while looking correct. A fastener
  // through both layers is one point; it is drawn once, here, from the assembly.
  const seams: Path[] = [];
  const holes: Hole[] = [];
  const slots: Path[] = [];

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
  }

  /** An assembled 3D point, straight to screen. */
  const proj3 = (v: Vec3): Vec2 => P(v[0], v[1], v[2]);

  for (const f of buildAssembly(s, g).features) {
    if (f.kind === 'score') continue;

    // WP32: a point on a prism needs the panel it sits on — the facet it belongs to is
    // what decides its distance from the axis. A through-lap feature gives the same 3D
    // point from either of its layers, so the outer one is as good as the other.
    const panel = f.layers[0] ?? Math.max(0, f.dart - 1);

    if (f.kind === 'hole') {
      const q = proj3(point3(g, panel, f.aa, f.depth, f.side));
      note(q);
      holes.push({ cx: f1(q[0]), cy: f1(q[1]), r: f.r ?? 2 });
      continue;
    }

    // The tongue and the slot it passes through are one feature at one place, so the
    // preview draws one opening — which is what the built fender has.
    const halfW = (f.w ?? 8) / 2;
    const reach = f.reach ?? 0;
    const dw = halfW / g.R;
    const corners: Vec2[] = [
      proj3(point3(g, panel, f.aa - dw, f.depth, f.side)),
      proj3(point3(g, panel, f.aa - dw, f.depth + reach, f.side)),
      proj3(point3(g, panel, f.aa + dw, f.depth + reach, f.side)),
      proj3(point3(g, panel, f.aa + dw, f.depth, f.side))
    ];
    corners.forEach(note);
    slots.push({ d: `M ${corners.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' L ')} Z` });
  }

  // Strut fastener holes, at the same arc positions AND the same depth the blank is
  // actually pierced at. This used to sit at `lerp(free, fold, 0.2)` — a fraction of the
  // skirt — while pattern.ts drilled at an absolute `inset` mm below the free edge, so
  // the two agreed only when the skirt happened to be ~30 mm deep. Same class of drift
  // as §9.35, found while removing the hand-written fastener maths around it.
  const strutInset = Math.max(5, Math.min(7, g.skirt * 0.22));
  blank.strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr;
    for (const side of [0, 3] as const) {
      for (const dir of [-1, 1]) {
        const ao = aa + (dir * 5) / g.R;
        const q = proj3(point3(g, panelAt(g, ao), ao, strutInset, side));
        note(q);
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
