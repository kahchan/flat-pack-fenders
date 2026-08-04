/**
 * Verbatim transcription of the blank-pattern section of renderVals() from
 * "Fender Pattern.dc.html". Deliberately NOT refactored — this is the ground truth the
 * TypeScript port is checked against, so it must stay shaped like the original.
 * Emits src/fender/__tests__/golden.json.
 */
import { writeFileSync } from 'node:fs';

// Labels mirrored from src/fender/defaults.ts (PLAN FEEDBACK WP16 §16.4) — dot-free
// already, and 700c carries its 29″ imperial name since it shares the 622 mm bead seat.
const WHEELS = {
  '700c': { bsd: 622, label: '700c / 29″ / 622' },
  '650b': { bsd: 584, label: '650b / 584' },
  '26in': { bsd: 559, label: '26" / 559' },
  '20in': { bsd: 406, label: '20" / 406' }
};
const D2 = Math.PI / 180;
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const f0 = (n) => String(Math.round(n));
const TONGUE_L = 34, TONGUE_W = 24;
const PW = 267, PH = 180, OV = 12;
// PLAN §13.3 — BEVEL_L is new, not in the design source (which has no `bevel` field and
// no chamfer at all). Added here, and to `blank()` below, so the golden fixture pins the
// port's actual behaviour, exactly as §9.4 (nesting) and §9.18 (Sheet B viewBox) added
// new, sanctioned geometry to this "verbatim transcription" script.
const BEVEL_L = 20;
// WP19 §19.1 (decision B1) — OV (tile overlap) and the old OVERLAP (panel lap) collapse
// into this one constant for `a4` stock: one printed tile is one material panel now, so
// mirrors src/fender/defaults.ts's LAP exactly.
const LAP = 20;
const SEAM_CLEAR = 6;
const SEAM_MERGE_DIST = 6;
const FOUR_LAYER_R_BONUS = 0.4;

// WP27 §27.2 — mirrors src/fender/defaults.ts's `tileOriginX` exactly: the ONE origin
// the print-tile grid and the panel-seam grid share.
function tileOriginX(s) {
  return (s.tongue ? -TONGUE_L : 0) - 6;
}

// WP27 §27.2 — mirrors src/fender/pattern.ts's `seamGrid` exactly: a seam is always
// exactly at its tile boundary, no search, no drift. `placeSeams` (round 3) is gone.
function seamGridRef(g, x0, stepX) {
  const reach = g.L - x0;
  const panelCount = reach <= PW ? 1 : 1 + Math.ceil((reach - PW) / stepX);
  const seamXs = [];
  for (let i = 1; i < panelCount; i++) seamXs.push(x0 + i * stepX);
  return { panelCount, seamXs };
}

// WP27 §27.2 — mirrors src/fender/pattern.ts's `nudgeAway` exactly: struts and mounts
// move to clear a pinned seam column, since the seam and the dart (below) no longer can.
function nudgeAwayRef(x, seamXms, clear, min, max) {
  for (const xm of seamXms) {
    const d = x - xm;
    if (Math.abs(d) < clear) {
      const dir = d >= 0 ? 1 : -1;
      x = Math.max(min, Math.min(max, xm + dir * clear));
    }
  }
  return x;
}

// WP27 §27.2 — mirrors src/fender/assembly.ts's `mergedDartAt` exactly: the dart a seam
// column lands on top of, or null if it clears every dart by enough to fasten alone.
function mergedDartAtRef(s, g, x) {
  if (g.n <= 1 || s.join === 'none' || s.join === 'slot') return null;
  const k = Math.round(x / g.pitch);
  if (k < 1 || k > g.n - 1) return null;
  const reach = SEAM_MERGE_DIST + (s.join === 'cinch' ? g.lap / 2 + 6 : 0);
  return Math.abs(x - k * g.pitch) <= reach ? k : null;
}
// PLAN §14 — same divergence, this time for the on-screen viewBoxes: the design sizes
// both `xsec()` and `isometric()` viewBoxes from the fender's own extent, which rescales
// the wheel drawn inside them as the fender grows. `xsec()`/`isometric()` below pin them
// to the tyre instead, rounded to the next 10 mm — see the port's `crossSection.ts` /
// `isometric.ts` for the reasoning. `XSEC_MARGIN` matches the port's own constant.
const XSEC_MARGIN = 130;

function geo(s) {
  const bsd = WHEELS[s.wheel].bsd;
  const tyreRcalc = bsd / 2 + s.tyre;
  const tyreR = s.measuredR > 0 ? s.measuredR : tyreRcalc;
  const R = tyreR + s.clear;
  const cov = s.lead + s.trail;
  const th = cov * D2;
  const aNose = -s.lead * D2;
  // WP32 §32.1 — mirrors src/fender/geometry.ts: the developed length is the perimeter
  // of the circumscribed polygon, not the arc, so facet midpoints sit ON the clearance
  // circle and `clear` is the minimum gap rather than the gap at the corners.
  const nFlaps = s.flaps;
  const dA = nFlaps > 0 ? th / nFlaps : th;
  const faceted = nFlaps > 1 && dA < Math.PI - 1e-6;
  const L = faceted ? 2 * nFlaps * R * Math.tan(dA / 2) : R * th;
  // WP30 §30.2 — mirrors src/fender/geometry.ts's derived angle floor.
  const sinNeeded = nFlaps > 1 && s.skirt > 0 ? (JOIN_LAP_NEEDED.cinch * R * nFlaps) / (L * s.skirt) : NaN;
  const angleMin = Number.isFinite(sinNeeded) && sinNeeded <= 1 ? (Math.asin(sinNeeded) * 180) / Math.PI : null;
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
  // WP23 §23.2 — the dart is a plain slit now (`notch` always 0); the surplus it used
  // to remove is left in as `lap` instead, maximised, never capped. `n <= 1` (a
  // dartless skirt) is a real branch, guarded here rather than left to divide by zero.
  const n = nFlaps;
  const pitch = n > 0 ? L / n : L;
  const removal = (L * drop) / R;
  const notch = 0;
  // WP29 — `removal / n` exactly. Round 3 carried over the one-thickness allowance the
  // BUTT notch needed for its two folded edges; a lap just stacks, so the `+ t` bought
  // no overlap and overstated it.
  const lap = n > 1 ? removal / n : 0;
  return { bsd, tyreRcalc, tyreR, R, cov, th, aNose, L, a, skirt: skirtFlat, skirtTrue: s.skirt, t, rBend, setback, BA, bendComp, hem, proj, drop, crown0: s.crown, crownTail, knee, Wd, yc: Wd / 2, n, pitch, removal, notch, lap, angleMin, angleEff, dA, faceted };
}

// WP23 §23.3 / WP34 §34.4 — mirrors src/fender/geometry.ts's join-fit table exactly.
// `zip` is derived, not a constant: ZIP_INNER_DEPTH is a growing fraction of a shallow
// skirt, so the lap it needs scales with skirt depth.
const JOIN_LAP_NEEDED = { none: 0, cinch: 3, rivet: 7, slot: 11 };
const ZIP_INNER_DEPTH = 12;
const ZIP_R = 1.5;
const ZIP_LAP_MARGIN = 1.5;
function zipLapNeededRef(g) {
  const u = g.skirt <= 0 ? 0 : Math.max(0, Math.min(1, (g.skirt - ZIP_INNER_DEPTH) / g.skirt));
  return (2 * (ZIP_R + ZIP_LAP_MARGIN)) / u;
}
const JOIN_ORDER = ['none', 'cinch', 'rivet', 'zip', 'slot'];
function joinFitsRef(g) {
  return JOIN_ORDER.map((join) => {
    const needed = join === 'zip' ? zipLapNeededRef(g) : JOIN_LAP_NEEDED[join];
    return { join, needed, fits: Math.max(0, needed - g.lap) <= 1e-9, short: Math.max(0, needed - g.lap) };
  });
}
// WP29 — `lap(n) = removal/n`, so the `- g.t` the round-3 form carried is gone with it.
function flapsForLapRef(g, needed) {
  if (needed <= 0) return null;
  return Math.max(1, Math.floor(g.removal / needed));
}
function skirtForLapRef(g, needed) {
  if (g.n <= 1) return null;
  const sinA = Math.sin(g.a);
  if (sinA <= 0) return null;
  const extra = needed - g.t;
  if (extra <= 0) return 0;
  return (extra * g.R * g.n) / (g.L * sinA);
}

function crownAt(g, x) {
  if (g.L <= g.knee || x <= g.knee) return g.crown0;
  return g.crown0 + (g.crownTail - g.crown0) * ((x - g.knee) / (g.L - g.knee));
}

function blank(s) {
  const g = geo(s);
  const cw = (x) => crownAt(g, x);
  const yFreeT = (x) => g.yc - cw(x) / 2 - g.skirt;
  const yFoldT = (x) => g.yc - cw(x) / 2;
  const yFoldB = (x) => g.yc + cw(x) / 2;
  const yFreeB = (x) => g.yc + cw(x) / 2 + g.skirt;

  const events = [{ x: 0 }];
  if (g.knee > 0 && g.knee < g.L) events.push({ x: g.knee });
  for (let i = 1; i < g.n; i++) events.push({ x: i * g.pitch, dart: true });
  events.push({ x: g.L });
  events.sort((p, q) => p.x - q.x);

  // PLAN §13.3 — new, not in the design source: a chamfer at the tongue-to-skirt
  // corner, running from the tongue's edge out to full skirt depth over the first
  // `s.bevel` mm, clamped short of whatever event comes next. Only meaningful with the
  // tongue on.
  const nextEvent = events[1];
  const nextX = nextEvent ? nextEvent.x - (nextEvent.dart ? g.notch / 2 : 0) : g.L;
  const bevelL = s.tongue ? Math.max(0, Math.min(s.bevel, nextX)) : 0;

  const edge = (isTop) => {
    const free = isTop ? yFreeT : yFreeB, fold = isTop ? yFoldT : yFoldB;
    const pts = [];
    for (const e of events) {
      if (e.dart) pts.push([e.x - g.notch / 2, free(e.x)], [e.x, fold(e.x)], [e.x + g.notch / 2, free(e.x)]);
      else if (e.x === 0 && bevelL > 0) {
        const tongueY = isTop ? g.yc - TONGUE_W / 2 : g.yc + TONGUE_W / 2;
        pts.push([0, tongueY], [bevelL, free(bevelL)]);
      } else pts.push([e.x, free(e.x)]);
    }
    return pts;
  };
  // WP23 §23.2 — mirrors src/fender/pattern.ts's own dedup exactly (see its comment):
  // a zero-notch dart can round to the same point as a coincident knee event.
  const seg = (pts) => {
    const rounded = pts.map((p) => `${f1(p[0])},${f1(p[1])}`);
    return rounded.filter((p, i) => i === 0 || p !== rounded[i - 1]).join(' L ');
  };
  let outline = `M ${seg(edge(true))} L ${seg(edge(false).reverse())}`;
  // DIVERGENCE (PLAN §13.3): with a bevel the reversed bottom edge already ends on the
  // tongue's lower corner, so repeating it would leave a zero-length segment in a CUT
  // path (laser dwell mark, repeated DXF vertex). Skipped when bevelL > 0.
  if (s.tongue) {
    if (bevelL <= 0) outline += ` L 0,${f1(g.yc + TONGUE_W / 2)}`;
    outline += ` L ${-TONGUE_L},${f1(g.yc + TONGUE_W / 2)} L ${-TONGUE_L},${f1(g.yc - TONGUE_W / 2)} L 0,${f1(g.yc - TONGUE_W / 2)}`;
  }
  outline += ' Z';
  // WP23 §23.3/§23.5 — the punched-tongue release cut (below) appends MORE subpaths to
  // `outline` after this point, mirroring src/fender/pattern.ts's own single mutable
  // `outline` exactly (its `blankOutline` used to snapshot the string here, which would
  // silently drop those later subpaths).

  const foldPath = (fold) => {
    const xs = g.knee > 0 && g.knee < g.L ? [0, g.knee, g.L] : [0, g.L];
    return `M ${xs.map((x) => `${f1(x)},${f1(fold(x))}`).join(' L ')}`;
  };
  const foldLines = [
    { d: foldPath(yFoldT) },
    { d: foldPath(yFoldB) },
    { d: `M ${s.tongue ? -TONGUE_L : 0},${f1(g.yc)} L ${f1(g.L)},${f1(g.yc)}` }
  ];

  const holes = [], slots = [], scoreLines = [], lapLines = [], lapArrows = [];

  // WP27 §27.2 — computed up front, mirroring src/fender/pattern.ts: the seam grid is
  // pinned now, not searched for, so it has to exist before the dart loop can know which
  // darts merge with it.
  const x0 = tileOriginX(s);
  const stepX = PW - LAP;
  const seamGridResult = s.stock === 'a4' ? seamGridRef(g, x0, stepX) : { panelCount: 1, seamXs: [] };
  const panelCount = seamGridResult.panelCount;
  const seamXs = seamGridResult.seamXs;
  const seamXms = seamXs.map((x) => x + LAP / 2);
  const mergedDarts = new Set();
  for (const xm of seamXms) {
    const k = mergedDartAtRef(s, g, xm);
    if (k !== null) mergedDarts.add(k);
  }

  if (g.hem > 0) {
    const hemT = (x) => yFreeT(x) + g.hem, hemB = (x) => yFreeB(x) - g.hem;
    const xs = g.knee > 0 && g.knee < g.L ? [0, g.knee, g.L] : [0, g.L];
    scoreLines.push({ d: `M ${xs.map((x) => `${f1(x)},${f1(hemT(x))}`).join(' L ')}` });
    scoreLines.push({ d: `M ${xs.map((x) => `${f1(x)},${f1(hemB(x))}`).join(' L ')}` });
  }
  // WP23 §23.3/§23.6 — mirrors src/fender/pattern.ts's dart-fastening block exactly.
  // WP29 §29.3 — mirrors src/fender/assembly.ts and src/fender/develop.ts. A dart
  // feature is declared once in ASSEMBLED coordinates (an arc angle, a depth below the
  // free edge, and the panels it pierces) and unrolled onto each of those panels; the
  // flat offset falls out of the panel map rather than being written by hand. Round 4
  // §9.35: the round-3 form used `d / skirt` where the overlap triangle needs
  // `(skirt - d) / skirt`, so its two layers could never coincide once assembled.
  // WP32 — on a prism the fold is a straight chord, so the flat-to-angle map is `tan`,
  // and panel/dart angles are multiples of `dA` rather than of `pitch / R`.
  const panelMid = (p) => g.aNose + (p + 0.5) * g.dA;
  const uAt = (depth) => (g.skirt <= 0 ? 0 : Math.max(0, Math.min(1, (g.skirt - depth) / g.skirt)));
  const flatXAt = (panel, aa, depth) => {
    const dphi = aa - panelMid(panel);
    const rq = g.R - uAt(depth) * g.drop;
    return (panel + 0.5) * g.pitch + (g.faceted ? rq * Math.tan(dphi) : dphi * rq);
  };
  const flatYAt = (x, depth, side) => (side === 0 ? yFreeT(x) + depth : yFreeB(x) - depth);

  for (let k = 1; k < g.n; k++) {
    const aa = g.aNose + k * g.dA;
    if (s.join === 'none') {
      const x = k * g.pitch;
      scoreLines.push({ d: `M ${f1(x)},${f1(yFreeT(x))} L ${f1(x)},${f1(yFreeB(x))}` });
      continue;
    }
    if (s.join === 'cinch') {
      const depth = g.skirt * 0.5;
      const off = g.lap / 2 + 6;
      const rMid = g.R - uAt(depth) * g.drop;
      // `off` is a FLAT clearance, converted through the same chord map.
      const half = g.faceted ? Math.tan(g.dA / 2) : g.dA / 2;
      const back = (sign) => (g.faceted ? Math.atan(sign * (half - off / rMid)) : sign * (half - off / rMid));
      // WP27 §27.2 — a merged four-layer corner bumps the radius, mirroring
      // src/fender/assembly.ts exactly.
      const cinchR = 2 + (mergedDarts.has(k) ? FOUR_LAYER_R_BONUS : 0);
      for (const side of [0, 3]) {
        for (const [ao, panel] of [[panelMid(k - 1) + back(1), k - 1], [panelMid(k) + back(-1), k]]) {
          const x = flatXAt(panel, ao, depth);
          holes.push({ cx: f1(x), cy: f1(flatYAt(x, depth, side)), r: cinchR });
        }
      }
      continue;
    }
    if (s.join === 'slot') {
      const tw = 8;
      const reach = Math.max(2, Math.min(14, g.skirt * 0.45));
      const d0 = 2;
      for (const side of [0, 3]) {
        for (const [layerIndex, panel] of [[0, k - 1], [1, k]]) {
          const xNear = flatXAt(panel, aa, d0);
          const xFar = flatXAt(panel, aa, d0 + reach);
          const yNear = flatYAt(xNear, d0, side);
          const yFar = flatYAt(xFar, d0 + reach, side);
          if (layerIndex === 0) {
            outline += ` M ${f1(xNear - tw / 2)},${f1(yNear)} L ${f1(xFar - tw / 2)},${f1(yFar)} L ${f1(xFar + tw / 2)},${f1(yFar)} L ${f1(xNear + tw / 2)},${f1(yNear)}`;
            scoreLines.push({ d: `M ${f1(xNear - tw / 2)},${f1(yNear)} L ${f1(xNear + tw / 2)},${f1(yNear)}` });
          } else {
            slots.push({ x: f1(Math.min(xNear, xFar) - tw / 2), y: f1(Math.min(yNear, yFar)), w: f1(tw + Math.abs(xFar - xNear)), h: f1(Math.abs(yFar - yNear)) });
          }
        }
      }
      continue;
    }
    // WP34 §34.1/§34.5 — mirrors src/fender/assembly.ts's ZIP_DEPTHS/RIVET_DEPTHS.
    const depths = s.join === 'zip' ? [6, ZIP_INNER_DEPTH] : [6.4];
    // WP27 §27.2 — a merged four-layer corner bumps the radius, mirroring
    // src/fender/assembly.ts exactly.
    const r = (s.join === 'zip' ? ZIP_R : 1.6) + (mergedDarts.has(k) ? FOUR_LAYER_R_BONUS : 0);
    for (const depth of depths) {
      for (const side of [0, 3]) {
        for (const panel of [k - 1, k]) {
          const x = flatXAt(panel, aa, depth);
          holes.push({ cx: f1(x), cy: f1(flatYAt(x, depth, side)), r });
        }
      }
    }
  }

  const xTDC = (s.lead / Math.max(1, g.cov)) * g.L;
  const mountsNominal = s.side === 'front'
    ? [{ x: xTDC, label: 'FORK CROWN' }]
    : [{ x: Math.min(xTDC * 0.4, g.L - 40), label: 'CHAINSTAY BRIDGE' }, { x: xTDC, label: 'SEATSTAY BRIDGE' }];
  // WP27 §27.2 — mounts move to clear a pinned seam column, mirroring
  // src/fender/pattern.ts's `nudgeAway` exactly.
  const mounts = mountsNominal.map((m) => ({ ...m, x: nudgeAwayRef(m.x, seamXms, SEAM_CLEAR + 8, m.x - 15, m.x + 15) }));
  mounts.forEach((m) => {
    slots.push({ x: f1(m.x - 8), y: f1(g.yc - 2.5), w: 16, h: 5 });
  });

  const strutFrac = [];
  const inset = Math.max(5, Math.min(7, g.skirt * 0.22));
  const sSpan = s.side === 'front' ? [0.5, 0.95] : [0.5, 0.96];
  for (let i = 0; i < s.struts; i++) {
    const fr = s.struts === 1 ? (sSpan[0] + sSpan[1]) / 2 : sSpan[0] + ((sSpan[1] - sSpan[0]) * i) / (s.struts - 1);
    // WP27 §27.2 — a strut moves to clear a pinned seam column too, `strutFrac` pushed
    // AFTER nudging so it stays what `isometric.ts`/`warnings.ts` actually draw from.
    const x = nudgeAwayRef(g.L * fr, seamXms, SEAM_CLEAR + 8, g.L * sSpan[0], g.L * sSpan[1]);
    strutFrac.push(x / g.L);
    holes.push({ cx: f1(x - 5), cy: f1(yFreeT(x) + inset), r: 2.5 }, { cx: f1(x + 5), cy: f1(yFreeT(x) + inset), r: 2.5 });
    holes.push({ cx: f1(x - 5), cy: f1(yFreeB(x) - inset), r: 2.5 }, { cx: f1(x + 5), cy: f1(yFreeB(x) - inset), r: 2.5 });
  }
  if (s.mudflap > 0) {
    for (const k of [-0.3, 0, 0.3]) holes.push({ cx: f1(g.L - 10), cy: f1(g.yc + g.crownTail * k), r: 2 });
  }
  if (s.tongue) slots.push({ x: f1(-TONGUE_L + 6), y: f1(g.yc - 2.5), w: 16, h: 5 });

  const seams = [];
  // WP27 §27.3 — the lowest y any label reaches, mirroring src/fender/tiling.ts's
  // `labelMaxY`: only the panel-seam "WHEEL SIDE" note (at `yFreeB(xm) + 9`) ever draws
  // below the outline, so it is the only one tracked here.
  let labelMaxY = 0;
  // WP27 §27.2 — `x`/`xm` come straight from `seamXs`/`seamXms`, pinned up front; no
  // search, no drift, mirroring src/fender/pattern.ts exactly.
  {
    for (let i = 1; i < panelCount; i++) {
      const x = seamXs[i - 1];
      seams.push({ d: `M ${f1(x)},${f1(yFreeT(x) - 5)} L ${f1(x)},${f1(yFreeB(x) + 5)}` });
      lapLines.push({ d: `M ${f1(x + LAP)},${f1(yFreeT(x + LAP) - 5)} L ${f1(x + LAP)},${f1(yFreeB(x + LAP) + 5)}` });
      const xm = seamXms[i - 1];
      // WP27 §27.2 — where this seam merges with a dart, that dart's own (already
      // bumped) fastener closes the seam too, so the row below is skipped.
      if (mergedDartAtRef(s, g, xm) === null) {
        const rowN = Math.max(3, Math.floor(g.Wd / 30));
        for (let j = 0; j <= rowN; j++) {
          const y = yFreeT(xm) + 7 + ((yFreeB(xm) - yFreeT(xm) - 14) * j) / rowN;
          // WP23 §23.3 — panel seams always use holes now; the old `slot` join's clip
          // (its only reason to cut slots here) is gone with the join it belonged to.
          holes.push({ cx: f1(xm), cy: f1(y), r: s.join === 'rivet' ? 1.6 : 2 });
        }
      }
      // PLAN FEEDBACK WP15 §15.2 — lapArrows is new, not in the design source: a small
      // drawn arrow at each lap pointing the direction water runs (downstream, from the
      // top panel onto the one underneath), mirroring pattern.ts exactly.
      const arrowY = g.yc + 8;
      const arrowHalf = 6;
      const head = 2.5;
      const ax0 = xm - arrowHalf;
      const ax1 = xm + arrowHalf;
      lapArrows.push({
        d: `M ${f1(ax0)},${f1(arrowY)} L ${f1(ax1)},${f1(arrowY)} M ${f1(ax1 - head)},${f1(arrowY - head)} L ${f1(ax1)},${f1(arrowY)} L ${f1(ax1 - head)},${f1(arrowY + head)}`
      });
      labelMaxY = Math.max(labelMaxY, yFreeB(xm) + 9);
    }
  }

  const M = 22;
  const bboxW = g.L + (s.tongue ? TONGUE_L : 0);
  // WP20 §20.1 — nesting removed outright; bboxH is always g.Wd now.
  const bboxH = g.Wd;
  const viewBox = `${f1(x0 - M)} ${f1(-M)} ${f1(bboxW + M * 2 + 12)} ${f1(bboxH + M * 2)}`;

  return { g, blankOutline: outline, foldLines, scoreLines, holes, slots, seams, lapLines, lapArrows, panelCount, strutFrac, viewBox, bboxW, bboxH, mounts, inset, labelMaxY };
}

function parts(s, g) {
  const partsOutlines = [], partsFolds = [], partsHoles = [], partsSlots = [], partsLabels = [];
  const SWD = 14;
  const r = SWD / 2;
  // PLAN FEEDBACK WP21 §21.1 — strap end: the frame end flares from the plain SWD
  // strip to a paddle wide enough for two transverse slots, over a short transition.
  // Both eat into the strut's own length rather than extending it.
  const strap = s.strutEnd === 'strap';
  const halfPaddle = STRUT_STRAP_PADDLE_W / 2;
  const offset = strap ? halfPaddle - r : 0;
  const cy = r + offset;
  const strutH = strap ? STRUT_STRAP_PADDLE_W : SWD;
  const xTrans = s.strutLen - STRUT_STRAP_TRANS_L - STRUT_STRAP_PADDLE_L;
  const xPaddle = s.strutLen - STRUT_STRAP_PADDLE_L;
  const slotMargin = (STRUT_STRAP_PADDLE_L - STRUT_STRAP_SLOT_GAP) / 2;
  let py = 12;
  for (let i = 0; i < s.struts; i++) {
    const y = py + i * (strutH + 9);
    partsOutlines.push({
      d: strap
        ? `M ${f1(r)},${f1(y + offset)} h ${f1(xTrans - r)} L ${f1(xPaddle)},${f1(y)} L ${f1(s.strutLen)},${f1(y)} L ${f1(s.strutLen)},${f1(y + strutH)} L ${f1(xPaddle)},${f1(y + strutH)} L ${f1(xTrans)},${f1(y + offset + SWD)} h ${f1(-(xTrans - r))} a ${r} ${r} 0 0 1 0 ${f1(-SWD)} Z`
        : `M ${r},${f1(y)} h ${f1(s.strutLen - SWD)} a ${r} ${r} 0 0 1 0 ${SWD} h ${f1(-(s.strutLen - SWD))} a ${r} ${r} 0 0 1 0 ${-SWD} Z`
    });
    partsFolds.push({
      d: strap
        ? `M 26,${f1(y + offset)} v ${SWD} M ${f1(s.strutLen - 26)},${f1(y)} v ${f1(strutH)}`
        : `M 26,${f1(y)} v ${SWD} M ${f1(s.strutLen - 26)},${f1(y)} v ${SWD}`
    });
    partsHoles.push({ cx: 12, cy: f1(y + cy), r: 2.5 }, { cx: f1(s.strutLen / 2), cy: f1(y + cy), r: 2 });
    if (!strap) partsHoles.push({ cx: f1(s.strutLen - 12), cy: f1(y + cy), r: 2.5 }, { cx: f1(s.strutLen - 22), cy: f1(y + cy), r: 2.5 });
    else for (const scx of [xPaddle + slotMargin, xPaddle + slotMargin + STRUT_STRAP_SLOT_GAP]) {
      partsSlots.push({ x: f1(scx - STRUT_STRAP_SLOT_W / 2), y: f1(y + cy - STRUT_STRAP_SLOT_L / 2), w: STRUT_STRAP_SLOT_W, h: STRUT_STRAP_SLOT_L });
    }
    partsLabels.push({ x: f1(s.strutLen + 8), y: f1(y + cy + 2), size: 5, text: `STRUT ${i + 1}, ${f0(s.strutLen)} × ${SWD}${strap ? ', STRAP END' : ''}` });
  }
  py += s.struts * (strutH + 9) + 14;
  if (s.mudflap > 0) {
    const w = g.crownTail, h = s.mudflap, rr = Math.min(18, w / 3);
    partsOutlines.push({ d: `M 0,${f1(py)} h ${f1(w)} v ${f1(h - rr)} q 0,${f1(rr)} ${f1(-rr)},${f1(rr)} h ${f1(-(w - 2 * rr))} q ${f1(-rr)},0 ${f1(-rr)},${f1(-rr)} Z` });
    partsFolds.push({ d: `M 0,${f1(py + 16)} h ${f1(w)}` });
    for (const k of [-0.3, 0, 0.3]) partsHoles.push({ cx: f1(w / 2 + w * k), cy: f1(py + 8), r: 2 });
    partsLabels.push({ x: f1(w + 8), y: f1(py + 10), size: 5, text: `MUDFLAP, ${f0(w)} × ${f0(h)} mm, lap 16 mm under the tail` });
    py += s.mudflap + 16;
  }
  // WP23 §23.3 — no join needs a separate hardware piece any more (see parts.ts).
  const extraN = 0;
  const extraLabel = '';
  const partsW = Math.max(s.strutLen + 96, g.crownTail + 150);
  const partsH = py + Math.max(1, Math.ceil(extraN / 6)) * 22 + 10;
  const partsViewBox = `-2 0 ${f1(partsW)} ${f1(partsH)}`;
  const partsFits = partsW <= PW;
  return { partsOutlines, partsFolds, partsHoles, partsSlots, partsLabels, partsViewBox, partsW, partsH, extraN, extraLabel, partsFits };
}

function xsec(s, g) {
  const tR = s.tyre / 2, tCy = s.clear + tR;
  const rimW = Math.max(15, s.tyre * 0.55), rimH = Math.max(14, s.tyre * 0.42);
  const dimY = Math.max(g.drop, s.clear + s.tyre + rimH) + 14;
  const finished = g.crown0 + 2 * g.proj;
  const xsecPaths = [
    { d: `M ${f1(-tR)},${f1(tCy)} a ${f1(tR)} ${f1(tR)} 0 1 1 ${f1(s.tyre)} 0 a ${f1(tR)} ${f1(tR)} 0 1 1 ${f1(-s.tyre)} 0 Z`, fill: '#EDE8DC', stroke: '#A8A49C', sw: 0.9, dash: '0' },
    { d: `M ${f1(-rimW / 2)},${f1(tCy + tR * 0.55)} h ${f1(rimW)} v ${f1(rimH)} h ${f1(-rimW)} Z`, fill: '#FAF8F3', stroke: '#8898A8', sw: 0.9, dash: '0' },
    { d: `M 0,0 v ${f1(s.clear)} m -3,0 h 6 m -3,${f1(-s.clear)} m -3,0 h 6`, fill: 'none', stroke: '#D4614E', sw: 0.7, dash: '0' },
    { d: `M ${f1(-g.crown0 / 2 - g.proj)},${f1(g.drop)} L ${f1(-g.crown0 / 2)},0 L ${f1(g.crown0 / 2)},0 L ${f1(g.crown0 / 2 + g.proj)},${f1(g.drop)}`, fill: 'none', stroke: '#1A2232', sw: 2.4, dash: '0' },
    { d: `M ${f1(-finished / 2)},${f1(dimY)} h ${f1(finished)} m 0,-4 v 8 m ${f1(-finished)},-8 v 8`, fill: 'none', stroke: '#8898A8', sw: 0.7, dash: '0' }
  ];
  const xsecLabels = [
    { x: 0, y: f1(dimY + 12), size: 7, fill: '#1A2232', anchor: 'middle', text: `FINISHED ${f0(finished)} mm` },
    { x: 0, y: -7, size: 6, fill: '#8898A8', anchor: 'middle', text: `CROWN ${f0(g.crown0)}` },
    { x: f1(g.crown0 / 2 + g.proj + 6), y: f1(g.drop + 8), size: 6, fill: '#8898A8', anchor: 'start', text: `SKIRT ${f0(g.skirt)} @ ${s.angle}°` },
    { x: 16, y: f1(s.clear / 2 + 2), size: 6, fill: '#D4614E', anchor: 'start', text: `GAP ${f0(s.clear)}` },
    // PLAN §14 — relabelled TYRE SECTION: the circle's diameter is the tyre section
    // width, not the wheel diameter, and reads as a wheel unless said plainly.
    { x: 0, y: f1(tCy + 2), size: 6, fill: '#8898A8', anchor: 'middle', text: `TYRE SECTION ⌀${f0(s.tyre)}` },
    { x: 0, y: f1(tCy + tR * 0.55 + rimH + 8), size: 5.5, fill: '#8898A8', anchor: 'middle', text: 'RIM' }
  ];
  // PLAN §14 — pin to the tyre envelope, floor'd on the tyre alone and rounded to the
  // next 10 mm, widening past that floor only once `finished` genuinely exceeds it.
  const wheelSpan = Math.max(s.tyre, rimW);
  const xw = Math.ceil((Math.max(wheelSpan, finished) + XSEC_MARGIN) / 10) * 10;
  const vh = Math.ceil((dimY + 40) / 10) * 10;
  const xsecViewBox = `${f1(-xw / 2)} -22 ${f1(xw)} ${f1(vh)}`;
  return { xsecPaths, xsecLabels, xsecViewBox, finished };
}

// ---- isometric (verbatim transcription of renderVals() lines ~848-954)
function isometric(s, g, strutFrac, spin) {
  const yaw = spin * D2;
  const P = (x, y, z) => {
    const xr = x * Math.cos(yaw) - y * Math.sin(yaw);
    const yr = x * Math.sin(yaw) + y * Math.cos(yaw);
    return [(xr - yr) * 0.866, (xr + yr) * 0.5 - z];
  };
  const aEnd = g.aNose + g.th;
  // WP32 — prism, not cylinder: panel-relative chord maps, mirroring src/fender.
  const panelMidIso = (p) => g.aNose + (p + 0.5) * g.dA;
  const panelAtIso = (aa) => (g.n <= 1 || g.dA <= 0 ? 0 : Math.max(0, Math.min(g.n - 1, Math.floor((aa - g.aNose) / g.dA))));
  const xAt = (aa) => {
    if (!g.faceted) return (aa - g.aNose) * g.R;
    const p = panelAtIso(aa);
    return (p + 0.5) * g.pitch + g.R * Math.tan(aa - panelMidIso(p));
  };
  const pf = (aa) => { const c = crownAt(g, xAt(aa)) / 2; return [[-c - g.proj, -g.drop], [-c, 0], [c, 0], [c + g.proj, -g.drop]]; };
  const p3 = (v, aa) => {
    const rq = g.R + v[1];
    const r = g.faceted ? rq / Math.cos(aa - panelMidIso(panelAtIso(aa))) : rq;
    return [v[0], r * Math.sin(aa), r * Math.cos(aa)];
  };
  const pt = (v, aa) => { const q = p3(v, aa); return P(q[0], q[1], q[2]); };
  // WP28 §28.2 + WP31 — mirrors src/fender/isometric.ts. Every band of the FENDER is
  // faceted at `g.n`, crown included: once both skirts are folded down the section is a
  // channel, which creases at the dart slits rather than curving smoothly. This section
  // had been left on the pre-WP28 three-quads-per-`NS`-segment sweep, which is a shape
  // the app has not drawn since WP28 and never drew at all after WP31.
  const nSkirt = Math.max(1, g.n);
  const aAt = (i) => g.aNose + (g.th * i) / nSkirt;
  const mix = (t) => { const A = [26, 34, 50], B = [244, 240, 232]; return `rgb(${A.map((c, i) => Math.round(c + (B[i] - c) * t)).join(',')})`; };
  const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const note = (p) => { if (p[0] < ext.x0) ext.x0 = p[0]; if (p[0] > ext.x1) ext.x1 = p[0]; if (p[1] < ext.y0) ext.y0 = p[1]; if (p[1] > ext.y1) ext.y1 = p[1]; };
  const inward = (v) => [v[0], v[1] - g.t];
  const quad = (q) => `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z`;
  const isoFacets = [];
  for (const j of [0, 2]) {
    for (let i = 0; i < nSkirt; i++) {
      const a0 = aAt(i), a1 = aAt(i + 1), P0 = pf(a0), P1 = pf(a1);
      const q = [pt(P0[j], a0), pt(P0[j + 1], a0), pt(P1[j + 1], a1), pt(P1[j], a1)];
      q.forEach(note);
      const u = Math.abs((i / nSkirt) * 2 - 1);
      isoFacets.push({ d: quad(q), fill: mix(Math.max(0.1, 0.52 - 0.3 * u)) });
    }
  }
  for (let i = 0; i < nSkirt; i++) {
    const a0 = aAt(i), a1 = aAt(i + 1), P0 = pf(a0), P1 = pf(a1);
    const q = [pt(P0[1], a0), pt(P0[2], a0), pt(P1[2], a1), pt(P1[1], a1)];
    q.forEach(note);
    const u = Math.abs((i / nSkirt) * 2 - 1);
    isoFacets.push({ d: quad(q), fill: mix(Math.max(0.1, 0.88 - 0.52 * u)) });
  }
  if (g.t > 0) {
    for (const j of [0, 3]) {
      for (let i = 0; i < nSkirt; i++) {
        const a0 = aAt(i), a1 = aAt(i + 1);
        const o0 = pf(a0)[j], o1 = pf(a1)[j];
        const q = [pt(o0, a0), pt(inward(o0), a0), pt(inward(o1), a1), pt(o1, a1)];
        q.forEach(note);
        isoFacets.push({ d: quad(q), fill: mix(0.05) });
      }
    }
  }
  if (g.lap > 0 && nSkirt > 1) {
    const dAngle = g.lap / g.R;
    for (const j of [0, 3]) {
      for (let i = 1; i < nSkirt; i++) {
        const a0 = aAt(i), a1 = a0 + dAngle;
        const o0 = pf(a0)[j], o1 = pf(a1)[j];
        const q = [pt(o0, a0), pt(inward(o0), a0), pt(inward(o1), a1), pt(o1, a1)];
        q.forEach(note);
        isoFacets.push({ d: quad(q), fill: mix(0.05) });
      }
    }
  }
  const rail = (j) => { const p = []; for (let i = 0; i <= nSkirt; i++) { const aa = aAt(i); const q = pt(pf(aa)[j], aa); p.push(`${f1(q[0])},${f1(q[1])}`); } return `M ${p.join(' L ')}`; };
  const railRev = (j) => { const p = []; for (let i = nSkirt; i >= 0; i--) { const aa = aAt(i); const q = pt(pf(aa)[j], aa); p.push(`${f1(q[0])},${f1(q[1])}`); } return p.join(' L '); };
  const cap = (aa) => `M ${pf(aa).map((v) => { const q = pt(v, aa); return `${f1(q[0])},${f1(q[1])}`; }).join(' L ')}`;
  const isoEdges = [{ d: rail(1) }, { d: rail(2) }, { d: cap(g.aNose) }, { d: cap(aEnd) }];
  const isoOutline = [{ d: `${rail(0)} L ${railRev(3)} Z` }];
  // PLAN §14 — `wheelExt` tracks the wheel's own bounding box separately, anchoring the
  // viewBox floor to `tyreR` instead of to the fender's own (crown/skirt-driven) extent.
  const wheelExt = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const noteWheel = (p) => { if (p[0] < wheelExt.x0) wheelExt.x0 = p[0]; if (p[0] > wheelExt.x1) wheelExt.x1 = p[0]; if (p[1] < wheelExt.y0) wheelExt.y0 = p[1]; if (p[1] > wheelExt.y1) wheelExt.y1 = p[1]; };
  const isoWheel = [];
  for (const offx of [-s.tyre / 2, s.tyre / 2]) {
    const p = [];
    for (let i = 0; i <= 84; i++) { const aa = (i / 84) * 2 * Math.PI; const q = P(offx, g.tyreR * Math.sin(aa), g.tyreR * Math.cos(aa)); note(q); noteWheel(q); p.push(q); }
    isoWheel.push({ d: `M ${p.join(' L ')} Z`.replace(/([\d.-]+),([\d.-]+)/g, (m0, a, b) => `${f1(+a)},${f1(+b)}`) });
  }

  // WP29 §29.3 — mirrors src/fender/isometric.ts. Every fastener position now comes from
  // the assembled model via `point3`, the same function develop.ts inverts to reach the
  // flat pattern. This section used to carry its own `notch/2 + 6` offsets and fractional
  // depths, which is round 4 §9.36: a second transcription that could disagree with the
  // blank, and did.
  const isoSeams = [], isoHoles = [], isoSlots = [];
  const uAt3 = (depth) => (g.skirt <= 0 ? 0 : Math.max(0, Math.min(1, (g.skirt - depth) / g.skirt)));
  const point3 = (panel, aa, depth, side) => {
    const u = uAt3(depth);
    const rq = g.R - u * g.drop;
    const dphi = aa - panelMidIso(panel);
    const r = g.faceted ? rq / Math.cos(dphi) : rq;
    // Taper read at the FOLD (radius R), so both layers of a lap agree exactly.
    const xFold = (panel + 0.5) * g.pitch + (g.faceted ? g.R * Math.tan(dphi) : dphi * g.R);
    const c = crownAt(g, xFold) / 2;
    const lateral = (side === 0 ? -1 : 1) * (c + u * g.proj);
    return P(lateral, r * Math.sin(aa), r * Math.cos(aa));
  };

  for (let i = 1; i < g.n; i++) {
    const aa = g.aNose + (g.th * i) / g.n, pr = pf(aa);
    for (const side of [0, 3]) {
      const free = pr[side], fold = pr[side === 0 ? 1 : 2];
      const A = pt(free, aa), B = pt(fold, aa);
      isoSeams.push({ d: `M ${f1(A[0])},${f1(A[1])} L ${f1(B[0])},${f1(B[1])}` });
    }
  }

  // The assembly feature list, in the same order src/fender/assembly.ts emits it.
  for (let k = 1; k < g.n; k++) {
    const aa = g.aNose + k * g.dA;
    if (s.join === 'none') continue;
    if (s.join === 'cinch') {
      const depth = g.skirt * 0.5;
      const off = g.lap / 2 + 6;
      const rMid = g.R - uAt3(depth) * g.drop;
      const half = g.faceted ? Math.tan(g.dA / 2) : g.dA / 2;
      const back = (sign) => (g.faceted ? Math.atan(sign * (half - off / rMid)) : sign * (half - off / rMid));
      for (const side of [0, 3]) {
        for (const [ao, panel] of [[panelMidIso(k - 1) + back(1), k - 1], [panelMidIso(k) + back(-1), k]]) {
          const q = point3(panel, ao, depth, side);
          isoHoles.push({ cx: f1(q[0]), cy: f1(q[1]), r: 2 });
        }
      }
      continue;
    }
    if (s.join === 'slot') {
      const tw = 8, d0 = 2;
      const reach = Math.max(2, Math.min(14, g.skirt * 0.45));
      const dw = tw / 2 / g.R;
      for (const side of [0, 3]) {
        const corners = [
          point3(k - 1, aa - dw, d0, side),
          point3(k - 1, aa - dw, d0 + reach, side),
          point3(k - 1, aa + dw, d0 + reach, side),
          point3(k - 1, aa + dw, d0, side)
        ];
        isoSlots.push({ d: `M ${corners.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' L ')} Z` });
      }
      continue;
    }
    // WP34 §34.1/§34.5 — mirrors src/fender/assembly.ts's ZIP_DEPTHS/RIVET_DEPTHS.
    const depths = s.join === 'zip' ? [6, ZIP_INNER_DEPTH] : [6.4];
    const r = s.join === 'zip' ? ZIP_R : 1.6;
    for (const depth of depths) {
      for (const side of [0, 3]) {
        const q = point3(k - 1, aa, depth, side);
        isoHoles.push({ cx: f1(q[0]), cy: f1(q[1]), r });
      }
    }
  }

  // Same absolute inset the blank is actually pierced at, not a fraction of the skirt.
  const strutInset = Math.max(5, Math.min(7, g.skirt * 0.22));
  strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr;
    for (const side of [0, 3]) {
      for (const dir of [-1, 1]) {
        const ao = aa + (dir * 5) / g.R;
        const q = point3(panelAtIso(ao), ao, strutInset, side);
        isoHoles.push({ cx: f1(q[0]), cy: f1(q[1]), r: 2.5 });
      }
    }
  });

  const isoStruts = [];
  strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr, pr = pf(aa);
    const tan = [0, Math.cos(aa), -Math.sin(aa)];
    for (const side of [0, 3]) {
      const from = p3(pr[side], aa);
      const to = [Math.sign(pr[side][0]) * (s.tyre / 2 + 6), from[1] * 0.2, from[2] * 0.2];
      const dv = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const len = Math.hypot(dv[0], dv[1], dv[2]) || 1;
      // PLAN §13.4 — drop the clamp: draw the true `strutLen`, not the distance to the
      // hub, so an over-long strut visibly overshoots instead of the picture silently
      // stopping at ~290 mm. New, not in the design source.
      const k = s.strutLen / len;
      const end = [from[0] + dv[0] * k, from[1] + dv[1] * k, from[2] + dv[2] * k];
      const q = [
        [from[0] - tan[0] * 7, from[1] - tan[1] * 7, from[2] - tan[2] * 7],
        [from[0] + tan[0] * 7, from[1] + tan[1] * 7, from[2] + tan[2] * 7],
        [end[0] + tan[0] * 7, end[1] + tan[1] * 7, end[2] + tan[2] * 7],
        [end[0] - tan[0] * 7, end[1] - tan[1] * 7, end[2] - tan[2] * 7]
      ].map((v) => P(v[0], v[1], v[2]));
      q.forEach(note);
      isoStruts.push({ d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z` });
    }
  });

  const isoMudflap = [];
  if (s.mudflap > 0) {
    const pr = pf(aEnd), tan = [0, Math.cos(aEnd), -Math.sin(aEnd)];
    const A = p3(pr[1], aEnd), B = p3(pr[2], aEnd);
    const extend = (v) => [v[0] + tan[0] * s.mudflap, v[1] + tan[1] * s.mudflap, v[2] + tan[2] * s.mudflap];
    const q = [A, B, extend(B), extend(A)].map((v) => P(v[0], v[1], v[2]));
    q.forEach(note);
    isoMudflap.push({ d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z` });
  }
  // PLAN §14 — floor the box on `wheelExt` (anchored on `tyreR`, never on crown/skirt),
  // centred on the content's own midpoint so extra room lands symmetrically, and
  // rounded up to the next 10 mm for hysteresis.
  const pad = 14;
  const cx = (ext.x0 + ext.x1) / 2, cy = (ext.y0 + ext.y1) / 2;
  const contentBw = Math.max(1, ext.x1 - ext.x0) + pad * 2;
  const contentBh = Math.max(1, ext.y1 - ext.y0) + pad * 2;
  const wheelBw = Math.max(1, wheelExt.x1 - wheelExt.x0) + pad * 2;
  const wheelBh = Math.max(1, wheelExt.y1 - wheelExt.y0) + pad * 2;
  const bw = Math.ceil(Math.max(contentBw, wheelBw) / 10) * 10;
  const bh = Math.ceil(Math.max(contentBh, wheelBh) / 10) * 10;
  const isoViewBox = `${f1(cx - bw / 2)} ${f1(cy - bh / 2)} ${f1(bw)} ${f1(bh)}`;
  const isoAspect = `${f1(bw)} / ${f1(bh)}`;

  return { isoFacets, isoEdges, isoOutline, isoWheel, isoSeams, isoHoles, isoSlots, isoStruts, isoMudflap, isoViewBox, isoAspect };
}

// ---- print tiling, incl. the §9.4 divergence: the design computes `rows` from g.Wd
// (rowsSource); the on-screen viewBox uses bboxH (nest ? Wd*2+10 : Wd), so the port
// computes `rows` from bboxH instead (rowsFixed). Both are emitted so the fixture makes
// the divergence explicit.
// WP20 §20.2 — mirrors src/fender/packer.ts's `packRects` exactly, so the "Sheets to
// print" spec row (now `printLayout.pageCount`, not the old rows×cols+2 estimate) can be
// computed here too.
function packRectsRef(rects, pageW, pageH) {
  const order = [...rects].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
  const shelves = [];
  const pageUsedHeight = [0];
  const placed = [];
  for (const rect of order) {
    const natural = { w: rect.w, h: rect.h, rotated: false };
    const rotated = { w: rect.h, h: rect.w, rotated: true };
    const orientations = [natural, rotated];
    let onShelf = false;
    for (const shelf of shelves) {
      for (const o of orientations) {
        if (o.w <= pageW - shelf.usedWidth && o.h <= shelf.height) {
          placed.push({ id: rect.id, page: shelf.page, x: shelf.usedWidth, y: shelf.y, w: o.w, h: o.h, rotated: o.rotated, overflow: false });
          shelf.usedWidth += o.w;
          onShelf = true;
          break;
        }
      }
      if (onShelf) break;
    }
    if (onShelf) continue;
    const fitsAnyPage = (o) => o.w <= pageW && o.h <= pageH;
    const candidates = orientations.filter(fitsAnyPage);
    if (candidates.length === 0) {
      const currentPage = pageUsedHeight.length - 1;
      const page = pageUsedHeight[currentPage] === 0 ? currentPage : pageUsedHeight.length;
      if (page === pageUsedHeight.length) pageUsedHeight.push(natural.h);
      else pageUsedHeight[page] = Math.max(pageUsedHeight[page], natural.h);
      placed.push({ id: rect.id, page, x: 0, y: 0, w: natural.w, h: natural.h, rotated: false, overflow: true });
      continue;
    }
    const currentPage = pageUsedHeight.length - 1;
    const remaining = pageH - pageUsedHeight[currentPage];
    const fitsRemaining = (o) => o.h <= remaining;
    const chosen =
      candidates.find((o) => !o.rotated && fitsRemaining(o)) ??
      candidates.find((o) => fitsRemaining(o)) ??
      candidates.find((o) => !o.rotated) ??
      candidates[0];
    let page = currentPage;
    if (!fitsRemaining(chosen)) {
      page += 1;
      pageUsedHeight.push(0);
    }
    const y = pageUsedHeight[page];
    shelves.push({ page, y, height: chosen.h, usedWidth: chosen.w });
    pageUsedHeight[page] = y + chosen.h;
    placed.push({ id: rect.id, page, x: 0, y, w: chosen.w, h: chosen.h, rotated: chosen.rotated, overflow: false });
  }
  return placed;
}

const PARTS_PH = 172;
const LABEL_ROW_H = 8;
const STRUT_W = 14;
const PRINT_CAPTION_H = 6;

// PLAN FEEDBACK WP21 §21.1 — strap-mounted strut end is new, not in the design source
// (which only ever had the plain hole/fuse frame end). Added here the same way BEVEL_L
// was (see its own comment above), so the golden fixture pins the port's own geometry.
const STRUT_STRAP_TRANS_L = 20;
const STRUT_STRAP_PADDLE_L = 24;
const STRUT_STRAP_PADDLE_W = 32;
const STRUT_STRAP_SLOT_L = 27;
const STRUT_STRAP_SLOT_W = 3.5;
const STRUT_STRAP_SLOT_GAP = 10;

// Mirrors src/fender/parts.ts's `packParts` rect list (struts, mudflap, hardware),
// packed at PW × PARTS_PH, then src/fender/printLayout.ts's own combining of the last
// Sheet-A tile row with these Sheet-B pages — enough to get a real `pageCount`, not the
// rows×cols+2 estimate `TilingModel.sheetCount` used to report (§20.2).
function pageCountRef(s, g, rows, cols, lastRowH) {
  const partRects = [];
  // PLAN FEEDBACK WP21 §21.1 — a strap-ended strut's paddle is taller than the plain
  // STRUT_W strip, so its packed footprint (and therefore the page count) must reflect
  // that, the same way the port's `packParts` reads `local.h` rather than a constant.
  const strutH = s.strutEnd === 'strap' ? STRUT_STRAP_PADDLE_W : STRUT_W;
  for (let i = 0; i < s.struts; i++) partRects.push({ id: `strut-${i}`, w: s.strutLen, h: strutH + LABEL_ROW_H });
  if (s.mudflap > 0) partRects.push({ id: 'mudflap', w: g.crownTail, h: s.mudflap + LABEL_ROW_H });
  // WP23 §23.3 — no join needs a separate hardware piece any more.
  const extraN = 0;
  for (let i = 0; i < extraN; i++) partRects.push({ id: `extra-${i}`, w: 34, h: 14 + LABEL_ROW_H });

  const partsPlaced = packRectsRef(partRects, PW, PARTS_PH);
  const partsPageCount = partsPlaced.reduce((m, p) => Math.max(m, p.page + 1), 0);
  const partsPageUsedH = new Array(partsPageCount).fill(0);
  for (const p of partsPlaced) partsPageUsedH[p.page] = Math.max(partsPageUsedH[p.page], p.y + p.h);

  const lastRowStart = (rows - 1) * cols;
  const combineRects = [];
  for (let c = 0; c < cols; c++) combineRects.push({ id: `A${lastRowStart + c}`, w: PW, h: lastRowH + PRINT_CAPTION_H });
  for (let i = 0; i < partsPageCount; i++) combineRects.push({ id: `B${i}`, w: PW, h: Math.max(1, partsPageUsedH[i]) + PRINT_CAPTION_H });

  const combinePlaced = packRectsRef(combineRects, PW, PH);
  const combinedPageCount = combinePlaced.reduce((m, p) => Math.max(m, p.page + 1), 0);

  return lastRowStart + combinedPageCount + 1; // full tile rows + combined pages + instructions
}

function tiling(s, g, bboxW, bboxH, panelCount, labelMaxY) {
  // WP19 §19.1 — `a4` stock's tile step is now `LAP`, since one tile is one panel;
  // `single` stock keeps the plain registration `OV`. Mirrors src/fender/tiling.ts.
  const overlapX = s.stock === 'a4' ? LAP : OV;
  const stepX = PW - overlapX, stepY = PH - OV;
  // WP27 §27.3 — for `a4` stock a tile IS a panel now, so `cols` reads `panelCount`
  // directly rather than a second `ceil()` that merely happened to agree with it.
  const cols = s.stock === 'a4' ? panelCount : Math.max(1, Math.ceil((bboxW + 12 - overlapX) / stepX));
  const rowsSource = Math.max(1, Math.ceil((g.Wd + 12 - OV) / stepY));
  // WP27 §27.3 — `contentH`/`TAIL_MARGIN` replace the bare `bboxH + 12`: the panel-seam
  // annotation and the calibration ruler both need clear room below the outline, which
  // the old fixed margin didn't reliably leave. Mirrors src/fender/tiling.ts exactly.
  const contentH = Math.max(bboxH, labelMaxY + 3);
  const TAIL_MARGIN = 20;
  const rowsFixed = Math.max(1, Math.ceil((contentH + TAIL_MARGIN - OV) / stepY));
  const rows = rowsFixed;
  const x0 = tileOriginX(s);
  const tileRects = [], printTiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = x0 + c * stepX, oy = r * stepY - 6;
      tileRects.push({ x: f1(ox), y: f1(oy), w: PW, h: PH });
      printTiles.push({
        label: `Sheet A, tile ${r + 1}×${c + 1} of ${rows}×${cols}`,
        meta: `${WHEELS[s.wheel].label}, ${f0(g.cov)}°, 1:1`,
        viewBox: `${f1(ox)} ${f1(oy)} ${PW} ${PH}`,
        frame: `M ${f1(ox)},${f1(oy)} h ${PW} v ${PH} h ${-PW} Z`,
        ruler: `M ${f1(ox + 8)},${f1(oy + PH - 5)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
        rulerX: f1(ox + 8),
        rulerY: f1(oy + PH - 9)
      });
    }
  }
  // WP27 §27.3 — capped at `PH - PRINT_CAPTION_H`, not `PH`: `buildPrintLayout` always
  // adds its own caption band on top before packing this onto a page.
  const lastRowH = Math.max(1, Math.min(PH - PRINT_CAPTION_H, contentH + TAIL_MARGIN - (rows - 1) * stepY));
  return { cols, rows, rowsSource, rowsFixed, tileRects, printTiles, lastRowH };
}

// ---- export: buildSvg, buildDxf, and a straight-line-only pathPolys (verbatim
// transcription of fender.html:502-535, 538-600, 602-622).
//
// This script has no DOM, so pathPolysStraightOnly reproduces only the M/L/H/V/Z branch
// of the real pathPolys() and THROWS if a subpath contains a curve command. Per PLAN
// §9.2 the blank is pure M/L, so feeding it blank-only geometry (empty partsOutlines/
// partsFolds — struts and the mudflap are the only curves) is always safe; it is never
// called with real parts data. buildSvg needs no sampling at all — SVG keeps `d`
// verbatim — so it is fed the FULL blank+parts data for every case.
function baseName(s, g) {
  return `fender-${s.side}-${s.wheel}-${Math.round(g.L)}x${Math.round(g.Wd)}mm`;
}

function pathPolysStraightOnly(d) {
  const subs = d.split(/(?=[Mm])/).map((x) => x.trim()).filter(Boolean);
  const polys = [];
  for (const sub of subs) {
    if (/[acqst]/i.test(sub)) {
      throw new Error(`pathPolysStraightOnly: subpath has a curve command — "${sub}"`);
    }
    const pts = [];
    let cx = 0, cy = 0, cmd = 'M';
    const re = /([MLHVZmlhvz])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
    const nums = [];
    let m;
    const push = () => {
      if (!nums.length) return;
      if (cmd === 'M' || cmd === 'L' || cmd === 'm' || cmd === 'l') {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          if (cmd === 'M' || cmd === 'L') { cx = nums[i]; cy = nums[i + 1]; } else { cx += nums[i]; cy += nums[i + 1]; }
          pts.push([cx, cy]);
        }
      } else if (cmd === 'H' || cmd === 'h') {
        for (const n of nums) { cx = cmd === 'H' ? n : cx + n; pts.push([cx, cy]); }
      } else if (cmd === 'V' || cmd === 'v') {
        for (const n of nums) { cy = cmd === 'V' ? n : cy + n; pts.push([cx, cy]); }
      }
      nums.length = 0;
    };
    while ((m = re.exec(sub))) {
      if (m[1]) { push(); cmd = m[1]; }
      else nums.push(parseFloat(m[2]));
    }
    push();
    if (pts.length > 1) polys.push(pts);
  }
  return polys;
}

// WP20 §20.1 — nesting is removed outright, so the second-blank branch this used to
// carry (PLAN §9.4) is gone. Mirrors src/export/svg.ts exactly.
function buildSvgRef(v, g, s, name) {
  const x0 = s.tongue ? -40 : -6;
  const w = g.L + (s.tongue ? 40 : 0) + 12;
  const gap = 30;
  const pw = v.partsViewBox.split(' ').map(Number);
  const H = g.Wd + gap + pw[3] + 12;
  const p = (d, sw) => `<path d="${d}" fill="none" stroke="#000" stroke-width="${sw}"/>`;
  const L = [];
  L.push(`<g id="CUT" inkscape:label="CUT" inkscape:groupmode="layer" stroke="#000">`);
  L.push(p(v.blankOutline, 0.2));
  v.partsOutlines.forEach((o) => L.push(`<g transform="translate(0,${(g.Wd + gap).toFixed(1)})">${p(o.d, 0.2)}</g>`));
  v.slots.forEach((sl) => L.push(`<rect x="${sl.x}" y="${sl.y}" width="${sl.w}" height="${sl.h}" rx="1.5" fill="none" stroke="#000" stroke-width="0.2"/>`));
  (v.partsSlots || []).forEach((sl) => L.push(`<g transform="translate(0,${(g.Wd + gap).toFixed(1)})"><rect x="${sl.x}" y="${sl.y}" width="${sl.w}" height="${sl.h}" rx="1.5" fill="none" stroke="#000" stroke-width="0.2"/></g>`));
  L.push('</g>');
  L.push(`<g id="FOLD" inkscape:label="FOLD" inkscape:groupmode="layer" stroke="#0000ff">`);
  v.foldLines.concat(v.scoreLines).forEach((f) => L.push(`<path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2"/>`));
  v.seams.forEach((f) => L.push(`<path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2" stroke-dasharray="4 2"/>`));
  v.partsFolds.forEach((f) => L.push(`<g transform="translate(0,${(g.Wd + gap).toFixed(1)})"><path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2"/></g>`));
  L.push('</g>');
  L.push(`<g id="HOLES" inkscape:label="HOLES" inkscape:groupmode="layer" stroke="#ff0000">`);
  v.holes.forEach((c) => L.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#f00" stroke-width="0.2"/>`));
  v.partsHoles.forEach((c) => L.push(`<g transform="translate(0,${(g.Wd + gap).toFixed(1)})"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#f00" stroke-width="0.2"/></g>`));
  L.push('</g>');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="${x0} -6 ${w.toFixed(1)} ${H.toFixed(1)}">
<title>${name}</title>
${L.join('\n')}
</svg>`;
}

// PLAN §9.3 — the HEADER/TABLES sections are new (source emitted only ENTITIES);
// entity geometry below this point is byte-identical to the source's buildDxf().
//
// WP20 §20.1 — nesting is removed outright, so the second-blank branch this used to
// carry (PLAN §9.4) is gone. Mirrors src/export/dxf.ts exactly.
function buildDxfRef(v, g, pathPolysFn) {
  const dy = g.Wd + 30;
  const out = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '3',
    '0', 'LAYER', '2', 'CUT', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'FOLD', '70', '0', '62', '5', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'HOLES', '70', '0', '62', '1', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'
  ];
  const poly = (pts, layer, closed, off) => {
    out.push('0', 'LWPOLYLINE', '8', layer, '100', 'AcDbEntity', '100', 'AcDbPolyline', '90', String(pts.length), '70', closed ? '1' : '0');
    pts.forEach((pp) => out.push('10', pp[0].toFixed(3), '20', (-(pp[1] + (off || 0))).toFixed(3)));
  };
  const circle = (c, layer, off) => out.push('0', 'CIRCLE', '8', layer, '10', (+c.cx).toFixed(3), '20', (-(+c.cy + (off || 0))).toFixed(3), '30', '0.0', '40', (+c.r).toFixed(3));
  pathPolysFn(v.blankOutline).forEach((pts) => poly(pts, 'CUT', true, 0));
  const closed = (d) => /z\s*$/i.test(d.trim());
  v.slots.forEach((s) => poly([[+s.x, +s.y], [+s.x + +s.w, +s.y], [+s.x + +s.w, +s.y + +s.h], [+s.x, +s.y + +s.h]], 'CUT', true, 0));
  v.foldLines.concat(v.scoreLines).forEach((f) => pathPolysFn(f.d).forEach((pts) => poly(pts, 'FOLD', false, 0)));
  v.seams.forEach((f) => pathPolysFn(f.d).forEach((pts) => poly(pts, 'FOLD', false, 0)));
  v.holes.forEach((c) => circle(c, 'HOLES', 0));
  v.partsOutlines.forEach((o) => pathPolysFn(o.d).forEach((pts) => poly(pts, 'CUT', closed(o.d), dy)));
  v.partsFolds.forEach((f) => pathPolysFn(f.d).forEach((pts) => poly(pts, 'FOLD', false, dy)));
  v.partsHoles.forEach((c) => circle(c, 'HOLES', dy));
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}

// ---- warnings, joinNote, steps, engNotes, specs (verbatim transcription of renderVals()
// lines ~979-984, 986-994, 1092, 1110, 1112-1156)
function joinNote(join) {
  return {
    cinch: 'One 4 mm hole per panel, outside the lap. Pull the lap shut with a zip tie spanning across and snip the tail flush.',
    zip: 'Two 4 mm holes at top and bottom of each dart, both sides. Pull the dart closed with a zip tie through each pair and snip the tails flush.',
    rivet: 'One 3.2 mm hole per layer, top and bottom of each dart, straight through the lap. Rivet each pair together.',
    slot: 'A tongue punched from the lap folds through a slot in the panel beneath and lies flat against the inside. No hardware.',
    none: 'No holes at all. Score the marked line across both skirts and run one zip tie right around the girth of the fender in the scored channel. Nothing pierces the crown.'
  }[join];
}

function warnings(s, g, partsFits, partsW) {
  const w = [];
  if (g.cov > 220) w.push({ text: `${f0(g.cov)}° of coverage wraps past the frame. Measure from the tyre to the fork crown (front) or seat tube (rear) before cutting — most frames foul somewhere between 200° and 240°.` });
  if (s.measuredR === 0) w.push({ text: `Tyre radius is estimated at ${f0(g.tyreRcalc)} mm from BSD + section width. Measure the real thing and set “Measured tyre radius” — a 5 mm error here shifts every dart.` });
  if (g.crownTail < s.tyre + 6) w.push({ text: `Tapered tail is ${f0(g.crownTail)} mm, narrower than the ${s.tyre} mm tyre. It will throw spray sideways at the very end — keep the taper under ${f0((1 - (s.tyre + 6) / g.crown0) * 100)}% or widen the crown.` });
  if (g.notch > 8) w.push({ text: `Darts are ${f1(g.notch)} mm wide — the curve will read as facets and the gaps are hard to close cleanly. Add flaps.` });
  if (g.skirt < 12 && s.join !== 'none') w.push({ text: `A ${f0(g.skirt)} mm skirt leaves almost no material around the fastener holes. Either lengthen the skirt or switch to the hole-free join.` });
  if (s.stock === 'single' && g.L > 1000) w.push({ text: `A single blank needs ${f0(g.L)} mm of stock in one piece. Switch to A4 panels unless you have a roll.` });
  if (!partsFits) w.push({ text: `Sheet B is ${f0(partsW)} mm wide and will not print 1:1 on A4. Shorten the struts to about ${f0(PW - 96)} mm, or cut them from stock by measurement instead.` });
  return w;
}

function steps(s, g, panelCount, cols, rows) {
  const list = [
    { n: '01', title: 'Check the scale', body: 'Print at 100% with margins set to none. Measure the 100 mm ruler on every sheet before cutting — if it is short, the printer scaled the page and nothing will fit.' },
    { n: '02', title: 'Tape the tiles', body: `Trim each tile on the grey dashed frame and overlap the next by ${OV} mm, matching the cut line where it crosses. ${cols * rows} tiles for the blank.` },
    { n: '03', title: 'Cut the blank', body: 'Cut the solid outline including every V dart. Do not cut the blue dashed lines — those are folds and score lines.' },
    { n: '04', title: 'Score, don’t slice', body: 'Score the fold lines about a third of the way through, on the outside face, with a blunt point or the back of a blade. Cut deeper than half and the fold becomes a hinge that will crack. Warm material folds cleaner than cold.' },
    { n: '05', title: 'Fold the skirts', body: `Bend both skirts down to ${s.angle}° over a straight edge. Work along the fold in stages rather than creasing it all at once.` },
    { n: '06', title: 'Close the darts', body: joinNote(s.join) },
    ...(panelCount > 1 ? [{ n: '07', title: 'Lap the panels', body: `Cut ${panelCount} panels. Each panel except the last is cut ${LAP} mm past its seam line — that tail is the lap, and it goes UNDERNEATH the panel in front so water runs across the joint, not into it. Slide the panels together until the fastener row sits in the middle of the lap, then fasten through both layers: one ${s.join === 'rivet' ? 'rivet' : s.join === 'slot' ? 'clip' : 'zip tie'} per hole, across the full width. The lapped joint ends up stiffer than the sheet around it.` }] : []),
    { n: panelCount > 1 ? '08' : '07', title: 'Bend the struts', body: `Fold each strut 26 mm from both ends. One end takes the pair of holes at the skirt edge; the other zip-ties, velcros, or bolts to the stay or eyelet.${s.fuse ? ' The single oversize hole is deliberate — it is the end you want to fail first.' : ''}` },
    ...(s.mudflap > 0 ? [{ n: panelCount > 1 ? '09' : '08', title: 'Add the mudflap', body: `Lap the ${f0(g.crownTail)} × ${f0(s.mudflap)} mm flap 16 mm under the tail, holes aligned, and fasten through the three crown holes. It is a separate part on purpose — it is the bit that gets destroyed.` }] : []),
    { n: 'LAST', title: 'Fit to the bike', body: `${s.side === 'front' ? 'Bolt the fork-crown slot first and slide it until the fender sits central, then ' : 'Bolt the chainstay-bridge slot, then the seastay bridge, then '}set the ${s.struts} struts so the gap to the tyre stays even at ${s.clear} mm all the way round. Spin the wheel and listen before you ride.` }
  ];
  return list;
}

function engNotes(s, g, panelCount, inset, mounts) {
  return [
    // WP23 §23.1/§23.2 — title only, renamed to match the port's corrected note
    // (buildNotes()'s index 0); body/formula stay the historical wording on purpose,
    // same as every other CORRECTED_INDICES entry — see notes.test.ts.
    { title: 'Why the shingle exists', body: 'The blank is a developable cylinder along its length, so bending it round the wheel is free. Folding the skirts down is not: the skirt free edge sits on a smaller radius than the fold line, so it must be shorter. Each dart removes exactly that surplus.', formula: `take-up = L × drop / R = ${f0(g.L)} × ${f0(g.drop)} / ${f0(g.R)} = ${f1(g.removal)} mm over ${g.n} darts → ${f1(g.notch)} mm each` },
    { title: 'Radius chain', body: s.measuredR > 0 ? 'You have overridden the estimate with a measured radius, which is the right way round — the BSD approximation is the largest single error in the whole pattern.' : 'Tyre outer radius is approximated as BSD/2 + section width, i.e. a round section as tall as it is wide. Measure and override it.', formula: `R = ${s.measuredR > 0 ? 'measured' : 'BSD/2 + tyre'} + clearance = ${f0(g.tyreR)} + ${s.clear} = ${f0(g.R)} mm` },
    { title: 'Taper is local, not global', body: 'Crown width is held constant until the taper knee, then interpolated linearly to the tail. Because every dart is computed from the local crown width, the pattern edge follows the taper automatically — dart positions do not move, the edge they sit on does. Taper exists so the tail can pass a chainstay bridge or fork crown, not for looks.', formula: `crown ${f0(g.crown0)} mm until ${f0(g.knee)} mm, then → ${f0(g.crownTail)} mm at ${f0(g.L)} mm` },
    { title: 'Asymmetric coverage', body: 'Lead and trail are separate because a front fender wants material ahead of the axle (that is where the spray at your feet comes from) and a rear wants a long tail. Zero lead gives you a rear-only fender that starts at the top of the wheel.', formula: `lead ${s.lead}° + trail ${s.trail}° = ${f0(g.cov)}°` },
    { title: s.side === 'front' ? 'Front mounting' : 'Rear mounting', body: s.side === 'front' ? 'A front fender hangs from one bolt through the fork crown at top dead centre, with the struts running to the blade eyelets. Everything behind that bolt is cantilevered, so the struts sit on the trailing half of the arc where they actually resist flutter. The crown slot runs along the length so the fender can slide fore and aft to centre it.' : 'A rear fender takes two frame bolts — the chainstay bridge low at the front and the seatstay bridge higher up — with the struts running back to the dropouts. Two mounts on different radii is what stops a long rear fender from oscillating. Both are slots, not holes, because no two frames put those bridges the same distance apart.', formula: mounts.map((m) => `${m.label} at ${f0(m.x)} mm`).join(' · ') },
    { title: 'How the panel seam works', body: `Butting two panels edge to edge has nothing to fasten. Instead each panel is cut ${LAP} mm past its seam and laps under the next, so a single row of fasteners passes through both layers in the middle of the lap. Lap direction matters more than fastener choice: forward panel on top, always.`, formula: panelCount > 1 ? `${panelCount} panels · ${LAP} mm lap · fastener row at lap centre` : 'single sheet — no seams' },
    // WP23 §23.1/§23.3 — title only; see the comment on index 0 above.
    { title: 'Rivets go straight through the lap', body: 'A rivet cannot pull a V-shaped gap closed the way a zip tie can — it needs two layers to squeeze. The butt strap is a small separate rectangle that sits behind the dart and bridges it: two rivets into the left flap, two into the right. The dart stays open by design; the strap carries the load. Zip ties and clips need no strap because they pull through both sides at once.', formula: 'strap 34 × 14 mm · 4 × 3.2 mm holes · one per dart' },
    { title: 'Every hole is a crack initiator', body: 'In thin plastic, fatigue cracks start at holes, and the crown is the worst place to put one because that is where water sits. Hence the hole-free option: a scored channel and one zip tie round the girth, nothing pierced. Struts fasten at the skirt edge for the same reason.', formula: `strut pairs at ${f0(inset)} mm inset, 10 mm apart · crown unpierced` },
    { title: 'Sacrificial strut end', body: 'A fender that jams should let go before it stops the wheel. The optional single oversize hole at the frame end is the intended failure point: one fastener in tension, nothing redundant. This is a safety feature, not a tolerance.', formula: s.fuse ? 'single 6.4 mm hole, one fastener' : 'off — both ends fully fastened' },
    { title: 'Nesting', body: 'A tapered blank nests tail-to-nose with a second one, so a front and rear pair costs less than twice one fender in stock width. The ghost outline shows the pair; cut the shared edge once.', formula: s.nest ? `pair stock ≈ ${f0(g.L)} × ${f0(g.Wd * 2 + 10)} mm` : 'off' },
    { title: 'Print geometry', body: `Each tile draws into ${PW} × ${PH} mm inside a 15 mm safe margin, which clears the unprintable edge on essentially every consumer inkjet and laser. Tiles overlap ${OV} mm so the cut line crosses both sheets and can be aligned by eye.`, formula: `A4 landscape 297 × 210 − 2 × 15 mm = ${PW} × ${PH} mm live` },
    { title: 'Bend allowance, properly', body: 'A fold does not consume the length a sharp corner would. The flat pattern needs the two legs measured to the theoretical sharp corner, minus twice the setback, plus the arc length along the neutral axis. Bend radius is taken as equal to thickness (a hand fold over a straight edge, not a press brake) and the k-factor as 0.44, which is the usual figure for soft sheet in air bending. At zero thickness every term collapses to zero and the pattern is the ideal one.', formula: `setback = (r+t)·tan(α/2) = ${f1(g.setback)} · BA = α(r+0.44t) = ${f1(g.BA)} · net ${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm per fold` },
    // WP23 §23.2 — title only; see the comment on index 0 above.
    { title: 'The lap gets wider with thickness', body: 'Two folded flaps meeting at a closed dart collide edge-on if the dart is cut to the ideal width — the material has to go somewhere. Adding one thickness to every dart gives the two edges room to sit alongside each other rather than fighting.', formula: `dart = L·drop/R/n + t = ${f1(g.notch)} mm` },
    { title: 'Hemmed edge', body: 'Folding the skirt edge back on itself doubles the material at the most vulnerable line on the fender, removes the cut edge you would otherwise brush your ankle against, and stiffens the whole skirt far more than extra thickness would. Cost is a wider blank and one more fold to make cleanly.', formula: s.hem ? `hem ${f0(g.hem)} mm = 2t + 4 · blank ${f0(g.Wd)} mm wide` : 'off' },
    { title: 'Export', body: 'SVG and DXF both come out at 1 unit = 1 mm with no transform, so they land at true size in Inkscape, LightBurn, Illustrator or any CAM tool. Cut geometry, fold and score lines, and hole centres go on separate layers — a laser wants to score the folds at low power and cut the outline at full, and it cannot guess which is which from the geometry alone.', formula: 'SVG: 1 user unit = 1 mm · DXF: R12 ASCII, LWPOLYLINE + CIRCLE, layers CUT / FOLD / HOLES' },
    { title: 'Still open', body: 'Cross-section as a true arc rather than a crown plus two flat facets — better spray control, much harder pattern. A measured k-factor for real sheet rather than the 0.44 rule of thumb. And strut stiffness: a rolled or channel-section strut would outperform a flat strip by a large margin, but it stops being cuttable with scissors, which is the whole point of this thing.', formula: '' }
  ];
}

function specs(s, g, finished, panelCount, cols, rows, lastRowH) {
  return [
    { label: 'Fender radius', value: `${f0(g.R)} mm`, note: s.measuredR > 0 ? 'measured tyre radius + clearance' : 'estimated tyre radius + clearance' },
    { label: 'Developed length', value: `${f0(g.L)} mm`, note: `R × ${f0(g.cov)}° in radians` },
    { label: 'Developed width', value: `${f0(g.Wd)} mm`, note: 'crown + 2 × skirt, at full width' },
    { label: 'Finished width', value: `${f0(finished)} mm`, note: `tail ${f0(g.crownTail + 2 * g.proj)} mm after taper` },
    { label: 'Flap pitch', value: `${f0(g.pitch)} mm`, note: `arc ÷ ${g.n} flaps` },
    // WP23 §23.2 — renamed to match src/fender/specs.ts's own correction: the dart is
    // a plain slit now, so this reports the shingled lap it left behind instead.
    { label: 'Lap width', value: `${f1(g.lap)} mm`, note: s.thick > 0 ? `incl. ${f1(s.thick)} mm thickness clearance` : 'at the free edge, tapering to 0 at the fold' },
    { label: 'Bend allowance', value: `${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm`, note: s.thick > 0 ? `per fold, setback ${f1(g.setback)}, arc ${f1(g.BA)}` : 'zero-thickness model' },
    { label: 'Total take-up', value: `${f1(g.removal)} mm`, note: 'taken up as lap by all darts, one side' },
    // WP20 §20.1 — nesting removed outright, so the nested-pair branch goes with it.
    { label: 'Blank area', value: `${f1((g.L * g.Wd) / 1e6)} m²`, note: 'before darts are cut' },
    // WP19 §19.1 — every panel is one PW-wide tile window (only the last is shorter),
    // so the note states the window size directly rather than an averaged panelL + LAP.
    { label: 'Material panels', value: panelCount === 1 ? 'one sheet' : `× ${panelCount}`, note: panelCount === 1 ? `needs ${f0(g.L)} mm of stock` : `each up to ${PW} × ${f0(g.Wd)} mm incl. lap` },
    // WP20 §20.2 — `printLayout.pageCount` (via `pageCountRef`) is the single source,
    // not the old rows×cols+2 estimate.
    { label: 'Sheets to print', value: `${pageCountRef(s, g, rows, cols, lastRowH)}`, note: `${cols} × ${rows} tiles + parts + instructions` }
  ];
}

// PLAN §13.1 / FEEDBACK §16.5 (decision A1) — lead/trail are DEFAULTS' own 120/100
// literal in src/fender/defaults.ts. Up to WP16 that literal was `COVERAGE.rear.lead`/
// `.trail`; A1 decoupled DEFAULTS from COVERAGE (COVERAGE is now PRESETS-only), so this
// is no longer a read of the same constant — but the effective value is unchanged, so
// this fixture generator's own 120/100 still matches it, on purpose rather than by
// coincidence.
const DEFAULTS = {
  side: 'rear', wheel: '700c', tyre: 35, measuredR: 0, clear: 14, crown: 55, skirt: 26, angle: 55,
  thick: 0.8, lead: 120, trail: 100, taper: 15, taperAt: 70, flaps: 20, struts: 2, strutLen: 160,
  mudflap: 100, join: 'zip', stock: 'a4', tongue: true, fuse: false, nest: false, hem: false,
  bevel: BEVEL_L, strutEnd: 'bolt'
};
const CARGO20 = {
  side: 'rear', wheel: '20in', tyre: 50, measuredR: 0, clear: 16, crown: 62, skirt: 30, angle: 55,
  thick: 0.8, lead: 60, trail: 200, taper: 25, taperAt: 70, flaps: 16, struts: 3, strutLen: 220,
  mudflap: 90, join: 'zip', stock: 'single', tongue: true, fuse: false, nest: false, hem: false,
  bevel: BEVEL_L, strutEnd: 'bolt'
};

const CASES = {
  'default-700c-rear': DEFAULTS,
  'cargo-20in-single': CARGO20,
  'front-700c': { ...CARGO20, side: 'front', wheel: '700c', tyre: 35, clear: 14, crown: 55, skirt: 26, lead: 55, trail: 120, flaps: 20, struts: 2, strutLen: 160, mudflap: 60 },
  'gravel-650b-hem-a4': { ...CARGO20, wheel: '650b', tyre: 50, clear: 18, crown: 72, skirt: 32, flaps: 22, hem: true, stock: 'a4', thick: 1.2 },
  'measured-no-taper-nojoin': { ...CARGO20, measuredR: 250, taper: 0, join: 'none', tongue: false },
  'mtb-26in-slot-thick': { ...CARGO20, wheel: '26in', tyre: 55, crown: 78, thick: 2.0, join: 'slot', flaps: 12 },
  'nested-pair': { ...DEFAULTS, nest: true },
  'rivet-join': { ...DEFAULTS, join: 'rivet' },
  'nested-cargo-20in': { ...CARGO20, nest: true },
  // PLAN FEEDBACK WP21 §21.1/§21.2 — strap-mounted strut end, both alone and combined
  // with multiple struts (CARGO20 has 3), so the fixture pins a case where the taller
  // paddle footprint actually changes packing.
  'strap-strut-end': { ...DEFAULTS, strutEnd: 'strap' },
  'strap-strut-end-cargo': { ...CARGO20, strutEnd: 'strap' },
  // WP34 — every other zip fixture sits at 4.1-5.4 mm of lap, far under what a stitch
  // needs, so none of them exercise the geometry this package is about. A deep skirt at
  // a low section count is where zip actually fits (§34.1's own measured example).
  'deep-skirt-zip': { ...DEFAULTS, skirt: 60, flaps: 8 }
};

const GEO_KEYS = ['bsd','tyreRcalc','tyreR','R','cov','th','aNose','L','a','skirt','skirtTrue','t','rBend','setback','BA','bendComp','hem','proj','drop','crown0','crownTail','knee','Wd','yc','n','pitch','removal','notch','lap'];

// Isometric spins pinned by the fixture: 18 is the source default (spin: 18 at line
// 480), -45 is an off-default pose so the yaw projection maths is checked, not just the
// identity-ish default angle.
const ISO_SPINS = [18, -45];

function summarizeIso(iso) {
  const first = (arr) => arr[0] ?? null;
  const last = (arr) => arr[arr.length - 1] ?? null;
  return {
    facetCount: iso.isoFacets.length,
    firstFacet: first(iso.isoFacets),
    lastFacet: last(iso.isoFacets),
    edges: iso.isoEdges.map((e) => e.d),
    outline: iso.isoOutline[0].d,
    wheelCount: iso.isoWheel.length,
    wheel: iso.isoWheel.map((w) => w.d),
    seamCount: iso.isoSeams.length,
    firstSeam: first(iso.isoSeams),
    lastSeam: last(iso.isoSeams),
    holeCount: iso.isoHoles.length,
    firstHole: first(iso.isoHoles),
    lastHole: last(iso.isoHoles),
    slotCount: iso.isoSlots.length,
    firstSlot: first(iso.isoSlots),
    lastSlot: last(iso.isoSlots),
    strutCount: iso.isoStruts.length,
    firstStrut: first(iso.isoStruts),
    lastStrut: last(iso.isoStruts),
    mudflapCount: iso.isoMudflap.length,
    mudflap: first(iso.isoMudflap),
    viewBox: iso.isoViewBox,
    aspect: iso.isoAspect
  };
}

const out = {};
const exportOut = {};
for (const [name, cfg] of Object.entries(CASES)) {
  const r = blank(cfg);
  const g = {};
  for (const k of GEO_KEYS) g[k] = r.g[k];
  const p = parts(cfg, r.g);
  const x = xsec(cfg, r.g);
  const t = tiling(cfg, r.g, r.bboxW, r.bboxH, r.panelCount, r.labelMaxY);
  const iso = {};
  for (const spin of ISO_SPINS) {
    iso[spin] = summarizeIso(isometric(cfg, r.g, r.strutFrac, spin));
  }
  const w = warnings(cfg, r.g, p.partsFits, p.partsW);
  const st = steps(cfg, r.g, r.panelCount, t.cols, t.rows);
  const en = engNotes(cfg, r.g, r.panelCount, r.inset, r.mounts);
  const sp = specs(cfg, r.g, x.finished, r.panelCount, t.cols, t.rows, t.lastRowH);
  const jn = joinNote(cfg.join);
  const assembledLabel = `${cfg.side === 'front' ? 'Front' : 'Rear'}, ${WHEELS[cfg.wheel].label}, ${f0(r.g.cov)}° (${cfg.lead}/${cfg.trail}), ${f0(x.finished)} mm wide, ${r.g.n} flaps, ${cfg.struts} struts${cfg.mudflap > 0 ? `, ${f0(cfg.mudflap)} mm flap` : ''}`;
  const printSpecLine = `${WHEELS[cfg.wheel].label}, tyre ${cfg.tyre} (R ${f0(r.g.tyreR)}), crown ${cfg.crown} → ${f0(r.g.crownTail)}, skirt ${cfg.skirt} @ ${cfg.angle}°, clearance ${cfg.clear}, ${cfg.lead}°/${cfg.trail}°, ${r.g.n} flaps, ${cfg.struts} struts, mudflap ${cfg.mudflap}`;
  out[name] = {
    config: cfg,
    geo: g,
    blank: {
      outline: r.blankOutline,
      foldLines: r.foldLines.map((f) => f.d),
      scoreLineCount: r.scoreLines.length,
      holeCount: r.holes.length,
      slotCount: r.slots.length,
      seamCount: r.seams.length,
      lapCount: r.lapLines.length,
      lapArrows: r.lapArrows.map((f) => f.d),
      panelCount: r.panelCount,
      strutFrac: r.strutFrac,
      viewBox: r.viewBox,
      bboxW: r.bboxW,
      bboxH: r.bboxH,
      firstHole: r.holes[0] ?? null,
      lastHole: r.holes[r.holes.length - 1] ?? null,
      firstSlot: r.slots[0] ?? null,
      lastSlot: r.slots[r.slots.length - 1] ?? null
    },
    parts: {
      outlines: p.partsOutlines.map((o) => o.d),
      folds: p.partsFolds.map((f) => f.d),
      holes: p.partsHoles,
      slots: p.partsSlots,
      labels: p.partsLabels,
      viewBox: p.partsViewBox,
      width: p.partsW,
      height: p.partsH,
      fitsA4: p.partsFits,
      extraCount: p.extraN,
      extraLabel: p.extraLabel
    },
    xsec: {
      paths: x.xsecPaths,
      labels: x.xsecLabels,
      viewBox: x.xsecViewBox,
      finished: x.finished
    },
    tiling: {
      cols: t.cols,
      rows: t.rows,
      rowsSource: t.rowsSource,
      rowsFixed: t.rowsFixed,
      rects: t.tileRects,
      tiles: t.printTiles
    },
    iso,
    joinNote: jn,
    warnings: w,
    steps: st,
    engNotes: en,
    specs: sp,
    assembledLabel,
    printSpecLine
  };

  // Export golden: svgFull is buildSvgRef fed the whole model (blank + parts) — SVG
  // keeps `d` verbatim, so no DOM is needed for the curved parts outlines either.
  // dxfBlankOnly is buildDxfRef fed blank data with EMPTY parts arrays, using the
  // straight-line-only pathPolys — safe because the blank never contains a curve
  // command (PLAN §9.2), and it is the piece a silent DXF regression would hurt most.
  const name_ = baseName(cfg, r.g);
  const vFull = {
    blankOutline: r.blankOutline,
    foldLines: r.foldLines,
    scoreLines: r.scoreLines,
    holes: r.holes,
    slots: r.slots,
    seams: r.seams,
    partsOutlines: p.partsOutlines,
    partsFolds: p.partsFolds,
    partsHoles: p.partsHoles,
    partsSlots: p.partsSlots,
    partsViewBox: p.partsViewBox
  };
  const vBlankOnly = { ...vFull, partsOutlines: [], partsFolds: [], partsHoles: [] };
  exportOut[name] = {
    config: cfg,
    baseName: name_,
    svgFull: buildSvgRef(vFull, r.g, cfg, name_),
    dxfBlankOnly: buildDxfRef(vBlankOnly, r.g, pathPolysStraightOnly)
  };
}

const path = process.argv[2];
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${Object.keys(out).length} cases → ${path}`);
for (const [k, v] of Object.entries(out)) {
  console.log(`  ${k.padEnd(26)} L=${v.geo.L.toFixed(4)} Wd=${v.geo.Wd.toFixed(4)} holes=${v.blank.holeCount} slots=${v.blank.slotCount} panels=${v.blank.panelCount}`);
}

const exportPath = process.argv[3];
if (exportPath) {
  writeFileSync(exportPath, JSON.stringify(exportOut, null, 2) + '\n');
  console.log(`wrote ${Object.keys(exportOut).length} cases → ${exportPath}`);
}
