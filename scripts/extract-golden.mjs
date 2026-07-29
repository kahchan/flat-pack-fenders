/**
 * Verbatim transcription of the blank-pattern section of renderVals() from
 * "Fender Pattern.dc.html". Deliberately NOT refactored — this is the ground truth the
 * TypeScript port is checked against, so it must stay shaped like the original.
 * Emits src/fender/__tests__/golden.json.
 */
import { writeFileSync } from 'node:fs';

const WHEELS = {
  '700c': { bsd: 622, label: '700c · 622' },
  '650b': { bsd: 584, label: '650b · 584' },
  '26in': { bsd: 559, label: '26" · 559' },
  '20in': { bsd: 406, label: '20" · 406' }
};
const D2 = Math.PI / 180;
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const f0 = (n) => String(Math.round(n));
const TONGUE_L = 34, TONGUE_W = 24, OVERLAP = 20;
const PW = 267, PH = 180, OV = 12;

function geo(s) {
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
  return { bsd, tyreRcalc, tyreR, R, cov, th, aNose, L, a, skirt: skirtFlat, skirtTrue: s.skirt, t, rBend, setback, BA, bendComp, hem, proj, drop, crown0: s.crown, crownTail, knee, Wd, yc: Wd / 2, n, pitch, removal, notch };
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

  const edge = (isTop) => {
    const free = isTop ? yFreeT : yFreeB, fold = isTop ? yFoldT : yFoldB;
    const pts = [];
    for (const e of events) {
      if (e.dart) pts.push([e.x - g.notch / 2, free(e.x)], [e.x, fold(e.x)], [e.x + g.notch / 2, free(e.x)]);
      else pts.push([e.x, free(e.x)]);
    }
    return pts;
  };
  const seg = (pts) => pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ');
  let outline = `M ${seg(edge(true))} L ${seg(edge(false).reverse())}`;
  if (s.tongue) outline += ` L 0,${f1(g.yc + TONGUE_W / 2)} L ${-TONGUE_L},${f1(g.yc + TONGUE_W / 2)} L ${-TONGUE_L},${f1(g.yc - TONGUE_W / 2)} L 0,${f1(g.yc - TONGUE_W / 2)}`;
  const blankOutline = `${outline} Z`;

  const foldPath = (fold) => {
    const xs = g.knee > 0 && g.knee < g.L ? [0, g.knee, g.L] : [0, g.L];
    return `M ${xs.map((x) => `${f1(x)},${f1(fold(x))}`).join(' L ')}`;
  };
  const foldLines = [
    { d: foldPath(yFoldT) },
    { d: foldPath(yFoldB) },
    { d: `M ${s.tongue ? -TONGUE_L : 0},${f1(g.yc)} L ${f1(g.L)},${f1(g.yc)}` }
  ];

  const holes = [], slots = [], scoreLines = [], lapLines = [];
  if (g.hem > 0) {
    const hemT = (x) => yFreeT(x) + g.hem, hemB = (x) => yFreeB(x) - g.hem;
    const xs = g.knee > 0 && g.knee < g.L ? [0, g.knee, g.L] : [0, g.L];
    scoreLines.push({ d: `M ${xs.map((x) => `${f1(x)},${f1(hemT(x))}`).join(' L ')}` });
    scoreLines.push({ d: `M ${xs.map((x) => `${f1(x)},${f1(hemB(x))}`).join(' L ')}` });
  }
  const off = g.notch / 2 + 6;
  for (let i = 1; i < g.n; i++) {
    const xc = i * g.pitch;
    if (s.join === 'none') {
      scoreLines.push({ d: `M ${f1(xc)},${f1(yFreeT(xc))} L ${f1(xc)},${f1(yFreeB(xc))}` });
      continue;
    }
    for (const dir of [-1, 1]) {
      const x = xc + dir * off;
      const tT = (t) => yFreeT(x) + g.skirt * t;
      const tB = (t) => yFreeB(x) - g.skirt * t;
      if (s.join === 'zip') {
        for (const t of [0.3, 0.78]) holes.push({ cx: f1(x), cy: f1(tT(t)), r: 2 }, { cx: f1(x), cy: f1(tB(t)), r: 2 });
      } else if (s.join === 'rivet') {
        for (const t of [0.4, 0.78]) holes.push({ cx: f1(x), cy: f1(tT(t)), r: 1.6 }, { cx: f1(x), cy: f1(tB(t)), r: 1.6 });
      } else {
        const h = Math.min(12, g.skirt * 0.5);
        slots.push({ x: f1(x - 1.5), y: f1(tT(0.28)), w: 3, h: f1(h) }, { x: f1(x - 1.5), y: f1(tB(0.28) - h), w: 3, h: f1(h) });
      }
    }
  }

  const xTDC = (s.lead / Math.max(1, g.cov)) * g.L;
  const mounts = s.side === 'front'
    ? [{ x: xTDC, label: 'FORK CROWN' }]
    : [{ x: Math.min(xTDC * 0.4, g.L - 40), label: 'CHAINSTAY BRIDGE' }, { x: xTDC, label: 'SEATSTAY BRIDGE' }];
  mounts.forEach((m) => { slots.push({ x: f1(m.x - 8), y: f1(g.yc - 2.5), w: 16, h: 5 }); });

  const strutFrac = [];
  const inset = Math.max(5, Math.min(7, g.skirt * 0.22));
  const sSpan = s.side === 'front' ? [0.5, 0.95] : [0.5, 0.96];
  for (let i = 0; i < s.struts; i++) {
    const fr = s.struts === 1 ? (sSpan[0] + sSpan[1]) / 2 : sSpan[0] + ((sSpan[1] - sSpan[0]) * i) / (s.struts - 1);
    strutFrac.push(fr);
    const x = g.L * fr;
    holes.push({ cx: f1(x - 5), cy: f1(yFreeT(x) + inset), r: 2.5 }, { cx: f1(x + 5), cy: f1(yFreeT(x) + inset), r: 2.5 });
    holes.push({ cx: f1(x - 5), cy: f1(yFreeB(x) - inset), r: 2.5 }, { cx: f1(x + 5), cy: f1(yFreeB(x) - inset), r: 2.5 });
  }
  if (s.mudflap > 0) {
    for (const k of [-0.3, 0, 0.3]) holes.push({ cx: f1(g.L - 10), cy: f1(g.yc + g.crownTail * k), r: 2 });
  }
  if (s.tongue) slots.push({ x: f1(-TONGUE_L + 6), y: f1(g.yc - 2.5), w: 16, h: 5 });

  const seams = [];
  let panelCount = 1;
  if (s.stock === 'a4') {
    panelCount = Math.max(1, Math.ceil(g.L / 250));
    const panelL = g.L / panelCount;
    for (let i = 1; i < panelCount; i++) {
      const x = i * panelL;
      seams.push({ d: `M ${f1(x)},${f1(yFreeT(x) - 5)} L ${f1(x)},${f1(yFreeB(x) + 5)}` });
      lapLines.push({ d: `M ${f1(x + OVERLAP)},${f1(yFreeT(x + OVERLAP) - 5)} L ${f1(x + OVERLAP)},${f1(yFreeB(x + OVERLAP) + 5)}` });
      const xm = x + OVERLAP / 2;
      const rowN = Math.max(3, Math.floor(g.Wd / 30));
      for (let j = 0; j <= rowN; j++) {
        const y = yFreeT(xm) + 7 + ((yFreeB(xm) - yFreeT(xm) - 14) * j) / rowN;
        if (s.join === 'slot') slots.push({ x: f1(xm - 1.5), y: f1(y - 6), w: 3, h: 12 });
        else holes.push({ cx: f1(xm), cy: f1(y), r: s.join === 'rivet' ? 1.6 : 2 });
      }
    }
  }

  const M = 22;
  const bboxW = g.L + (s.tongue ? TONGUE_L : 0);
  const bboxH = s.nest ? g.Wd * 2 + 10 : g.Wd;
  const x0 = (s.tongue ? -TONGUE_L : 0) - 6;
  const viewBox = `${f1(x0 - M)} ${f1(-M)} ${f1(bboxW + M * 2 + 12)} ${f1(bboxH + M * 2)}`;

  return { g, blankOutline, foldLines, scoreLines, holes, slots, seams, lapLines, panelCount, strutFrac, viewBox, bboxW, bboxH, mounts, inset };
}

function parts(s, g) {
  const partsOutlines = [], partsFolds = [], partsHoles = [], partsSlots = [], partsLabels = [];
  const SWD = 14;
  let py = 12;
  for (let i = 0; i < s.struts; i++) {
    const y = py + i * (SWD + 9);
    const r = SWD / 2;
    partsOutlines.push({ d: `M ${r},${f1(y)} h ${f1(s.strutLen - SWD)} a ${r} ${r} 0 0 1 0 ${SWD} h ${f1(-(s.strutLen - SWD))} a ${r} ${r} 0 0 1 0 ${-SWD} Z` });
    partsFolds.push({ d: `M 26,${f1(y)} v ${SWD} M ${f1(s.strutLen - 26)},${f1(y)} v ${SWD}` });
    partsHoles.push({ cx: 12, cy: f1(y + r), r: 2.5 }, { cx: f1(s.strutLen / 2), cy: f1(y + r), r: 2 });
    if (s.fuse) partsHoles.push({ cx: f1(s.strutLen - 12), cy: f1(y + r), r: 3.2 });
    else partsHoles.push({ cx: f1(s.strutLen - 12), cy: f1(y + r), r: 2.5 }, { cx: f1(s.strutLen - 22), cy: f1(y + r), r: 2.5 });
    partsLabels.push({ x: f1(s.strutLen + 8), y: f1(y + r + 2), size: 5, text: `STRUT ${i + 1} · ${f0(s.strutLen)} × ${SWD}${s.fuse ? ' · FUSE END' : ''}` });
  }
  py += s.struts * (SWD + 9) + 14;
  if (s.mudflap > 0) {
    const w = g.crownTail, h = s.mudflap, rr = Math.min(18, w / 3);
    partsOutlines.push({ d: `M 0,${f1(py)} h ${f1(w)} v ${f1(h - rr)} q 0,${f1(rr)} ${f1(-rr)},${f1(rr)} h ${f1(-(w - 2 * rr))} q ${f1(-rr)},0 ${f1(-rr)},${f1(-rr)} Z` });
    partsFolds.push({ d: `M 0,${f1(py + 16)} h ${f1(w)}` });
    for (const k of [-0.3, 0, 0.3]) partsHoles.push({ cx: f1(w / 2 + w * k), cy: f1(py + 8), r: 2 });
    partsLabels.push({ x: f1(w + 8), y: f1(py + 10), size: 5, text: `MUDFLAP · ${f0(w)} × ${f0(h)} mm · lap 16 mm under the tail` });
    py += s.mudflap + 16;
  }
  const extraN = s.join === 'rivet' || s.join === 'slot' ? g.n - 1 : 0;
  const extraLabel = s.join === 'rivet' ? 'BUTT STRAP' : 'CLIP';
  for (let i = 0; i < extraN; i++) {
    const col = i % 6, row = Math.floor(i / 6);
    const x = 2 + col * 42, y = py + row * 22, w = 34, h = 14;
    partsOutlines.push({ d: `M ${f1(x)},${f1(y)} h ${w} v ${h} h ${-w} Z` });
    if (s.join === 'rivet') for (const cx of [8, 26]) for (const cy of [4.5, 9.5]) partsHoles.push({ cx: f1(x + cx), cy: f1(y + cy), r: 1.6 });
    else partsFolds.push({ d: `M ${f1(x + 6)},${f1(y)} v ${h} M ${f1(x + 28)},${f1(y)} v ${h}` });
    if (i === 0) partsLabels.push({ x: f1(x), y: f1(y - 3), size: 5, text: `${extraLabel} × ${extraN} · 34 × 14 mm` });
  }
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
    { x: 0, y: f1(tCy + 2), size: 6, fill: '#8898A8', anchor: 'middle', text: `TYRE ⌀${f0(s.tyre)}` },
    { x: 0, y: f1(tCy + tR * 0.55 + rimH + 8), size: 5.5, fill: '#8898A8', anchor: 'middle', text: 'RIM' }
  ];
  const xw = finished + 130;
  const xsecViewBox = `${f1(-xw / 2)} -22 ${f1(xw)} ${f1(dimY + 40)}`;
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
  const xAt = (aa) => (aa - g.aNose) * g.R;
  const pf = (aa) => { const c = crownAt(g, xAt(aa)) / 2; return [[-c - g.proj, -g.drop], [-c, 0], [c, 0], [c + g.proj, -g.drop]]; };
  const p3 = (v, aa) => { const r = g.R + v[1]; return [v[0], r * Math.sin(aa), r * Math.cos(aa)]; };
  const pt = (v, aa) => { const q = p3(v, aa); return P(q[0], q[1], q[2]); };
  const NS = 64;
  const aAt = (i) => g.aNose + (g.th * i) / NS;
  const mix = (t) => { const A = [26, 34, 50], B = [244, 240, 232]; return `rgb(${A.map((c, i) => Math.round(c + (B[i] - c) * t)).join(',')})`; };
  const ext = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const note = (p) => { if (p[0] < ext.x0) ext.x0 = p[0]; if (p[0] > ext.x1) ext.x1 = p[0]; if (p[1] < ext.y0) ext.y0 = p[1]; if (p[1] > ext.y1) ext.y1 = p[1]; };
  const isoFacets = [];
  for (let i = 0; i < NS; i++) {
    const a0 = aAt(i), a1 = aAt(i + 1), P0 = pf(a0), P1 = pf(a1);
    for (let j = 0; j < 3; j++) {
      const q = [pt(P0[j], a0), pt(P0[j + 1], a0), pt(P1[j + 1], a1), pt(P1[j], a1)];
      q.forEach(note);
      const u = Math.abs((i / NS) * 2 - 1);
      const shade = j === 1 ? 0.88 - 0.52 * u : 0.52 - 0.3 * u;
      isoFacets.push({ d: `M ${q.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' L ')} Z`, fill: mix(Math.max(0.1, shade)) });
    }
  }
  const rail = (j) => { const p = []; for (let i = 0; i <= NS; i++) { const aa = aAt(i); const q = pt(pf(aa)[j], aa); p.push(`${f1(q[0])},${f1(q[1])}`); } return `M ${p.join(' L ')}`; };
  const railRev = (j) => { const p = []; for (let i = NS; i >= 0; i--) { const aa = aAt(i); const q = pt(pf(aa)[j], aa); p.push(`${f1(q[0])},${f1(q[1])}`); } return p.join(' L '); };
  const cap = (aa) => `M ${pf(aa).map((v) => { const q = pt(v, aa); return `${f1(q[0])},${f1(q[1])}`; }).join(' L ')}`;
  const isoEdges = [{ d: rail(1) }, { d: rail(2) }, { d: cap(g.aNose) }, { d: cap(aEnd) }];
  const isoOutline = [{ d: `${rail(0)} L ${railRev(3)} Z` }];
  const isoWheel = [];
  for (const offx of [-s.tyre / 2, s.tyre / 2]) {
    const p = [];
    for (let i = 0; i <= 84; i++) { const aa = (i / 84) * 2 * Math.PI; const q = P(offx, g.tyreR * Math.sin(aa), g.tyreR * Math.cos(aa)); note(q); p.push(q); }
    isoWheel.push({ d: `M ${p.join(' L ')} Z`.replace(/([\d.-]+),([\d.-]+)/g, (m0, a, b) => `${f1(+a)},${f1(+b)}`) });
  }

  const isoSeams = [], isoHoles = [], isoSlots = [];
  const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  for (let i = 1; i < g.n; i++) {
    const aa = g.aNose + (g.th * i) / g.n, pr = pf(aa);
    for (const side of [0, 3]) {
      const free = pr[side], fold = pr[side === 0 ? 1 : 2];
      const A = pt(free, aa), B = pt(fold, aa);
      isoSeams.push({ d: `M ${f1(A[0])},${f1(A[1])} L ${f1(B[0])},${f1(B[1])}` });
      const ts = s.join === 'zip' ? [0.3, 0.78] : s.join === 'rivet' ? [0.4, 0.78] : [];
      for (const t of ts) for (const dir of [-1, 1]) {
        const q = pt(lerp(free, fold, t), aa + (dir * (g.notch / 2 + 6)) / g.R);
        isoHoles.push({ cx: f1(q[0]), cy: f1(q[1]), r: s.join === 'rivet' ? 1.6 : 2 });
      }
      if (s.join === 'slot') for (const dir of [-1, 1]) {
        const ao = aa + (dir * (g.notch / 2 + 6)) / g.R;
        const q1 = pt(lerp(free, fold, 0.28), ao), q2 = pt(lerp(free, fold, 0.62), ao);
        isoSlots.push({ d: `M ${f1(q1[0])},${f1(q1[1])} L ${f1(q2[0])},${f1(q2[1])}` });
      }
    }
  }
  strutFrac.forEach((fr) => {
    const aa = g.aNose + g.th * fr, pr = pf(aa);
    for (const side of [0, 3]) {
      const free = pr[side], fold = pr[side === 0 ? 1 : 2];
      for (const dir of [-1, 1]) {
        const q = pt(lerp(free, fold, 0.2), aa + (dir * 5) / g.R);
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
      const k = Math.min(s.strutLen, len) / len;
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
  const pad = 14;
  const bw = Math.max(1, ext.x1 - ext.x0) + pad * 2;
  const bh = Math.max(1, ext.y1 - ext.y0) + pad * 2;
  const isoViewBox = `${f1(ext.x0 - pad)} ${f1(ext.y0 - pad)} ${f1(bw)} ${f1(bh)}`;
  const isoAspect = `${f1(bw)} / ${f1(bh)}`;

  return { isoFacets, isoEdges, isoOutline, isoWheel, isoSeams, isoHoles, isoSlots, isoStruts, isoMudflap, isoViewBox, isoAspect };
}

// ---- print tiling, incl. the §9.4 divergence: the design computes `rows` from g.Wd
// (rowsSource); the on-screen viewBox uses bboxH (nest ? Wd*2+10 : Wd), so the port
// computes `rows` from bboxH instead (rowsFixed). Both are emitted so the fixture makes
// the divergence explicit.
function tiling(s, g, bboxW, bboxH) {
  const stepX = PW - OV, stepY = PH - OV;
  const cols = Math.max(1, Math.ceil((bboxW + 12 - OV) / stepX));
  const rowsSource = Math.max(1, Math.ceil((g.Wd + 12 - OV) / stepY));
  const rowsFixed = Math.max(1, Math.ceil((bboxH + 12 - OV) / stepY));
  const rows = rowsFixed;
  const x0 = (s.tongue ? -TONGUE_L : 0) - 6;
  const tileRects = [], printTiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = x0 + c * stepX, oy = r * stepY - 6;
      tileRects.push({ x: f1(ox), y: f1(oy), w: PW, h: PH });
      printTiles.push({
        label: `Sheet A — tile ${r + 1}·${c + 1} of ${rows}·${cols}`,
        meta: `${WHEELS[s.wheel].label} · ${f0(g.cov)}° · 1:1`,
        viewBox: `${f1(ox)} ${f1(oy)} ${PW} ${PH}`,
        frame: `M ${f1(ox)},${f1(oy)} h ${PW} v ${PH} h ${-PW} Z`,
        ruler: `M ${f1(ox + 8)},${f1(oy + PH - 10)} h 100 m 0,-3 v 6 m -100,-6 v 6 m 50,-4 v 4`,
        rulerX: f1(ox + 8),
        rulerY: f1(oy + PH - 14)
      });
    }
  }
  const sheetCount = rows * cols + 2; // + Sheet B + instructions
  const nestTransform = s.nest ? `translate(${f1(g.L)}, ${f1(g.Wd * 2 + 10)}) rotate(180)` : null;
  return { cols, rows, rowsSource, rowsFixed, sheetCount, tileRects, printTiles, nestTransform };
}

// ---- warnings, joinNote, steps, engNotes, specs (verbatim transcription of renderVals()
// lines ~979-984, 986-994, 1092, 1110, 1112-1156)
function joinNote(join) {
  return {
    zip: 'Two 4 mm holes at top and bottom of each dart, both sides. Pull the dart closed with a zip tie through each pair and snip the tails flush.',
    rivet: 'Four 3.2 mm holes per dart plus a butt strap bridging the gap — two rivets per side.',
    slot: 'Two 3 mm slots per dart. A folded clip threads both slots and holds the dart shut — no hardware.',
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
    ...(panelCount > 1 ? [{ n: '07', title: 'Lap the panels', body: `Cut ${panelCount} panels. Each panel except the last is cut ${OVERLAP} mm past its seam line — that tail is the lap, and it goes UNDERNEATH the panel in front so water runs across the joint, not into it. Slide the panels together until the fastener row sits in the middle of the lap, then fasten through both layers: one ${s.join === 'rivet' ? 'rivet' : s.join === 'slot' ? 'clip' : 'zip tie'} per hole, across the full width. The lapped joint ends up stiffer than the sheet around it.` }] : []),
    { n: panelCount > 1 ? '08' : '07', title: 'Bend the struts', body: `Fold each strut 26 mm from both ends. One end takes the pair of holes at the skirt edge; the other zip-ties, velcros, or bolts to the stay or eyelet.${s.fuse ? ' The single oversize hole is deliberate — it is the end you want to fail first.' : ''}` },
    ...(s.mudflap > 0 ? [{ n: panelCount > 1 ? '09' : '08', title: 'Add the mudflap', body: `Lap the ${f0(g.crownTail)} × ${f0(s.mudflap)} mm flap 16 mm under the tail, holes aligned, and fasten through the three crown holes. It is a separate part on purpose — it is the bit that gets destroyed.` }] : []),
    { n: 'LAST', title: 'Fit to the bike', body: `${s.side === 'front' ? 'Bolt the fork-crown slot first and slide it until the fender sits central, then ' : 'Bolt the chainstay-bridge slot, then the seastay bridge, then '}set the ${s.struts} struts so the gap to the tyre stays even at ${s.clear} mm all the way round. Spin the wheel and listen before you ride.` }
  ];
  return list;
}

function engNotes(s, g, panelCount, inset, mounts) {
  return [
    { title: 'Why the darts exist', body: 'The blank is a developable cylinder along its length, so bending it round the wheel is free. Folding the skirts down is not: the skirt free edge sits on a smaller radius than the fold line, so it must be shorter. Each dart removes exactly that surplus.', formula: `take-up = L × drop / R = ${f0(g.L)} × ${f0(g.drop)} / ${f0(g.R)} = ${f1(g.removal)} mm over ${g.n} darts → ${f1(g.notch)} mm each` },
    { title: 'Radius chain', body: s.measuredR > 0 ? 'You have overridden the estimate with a measured radius, which is the right way round — the BSD approximation is the largest single error in the whole pattern.' : 'Tyre outer radius is approximated as BSD/2 + section width, i.e. a round section as tall as it is wide. Measure and override it.', formula: `R = ${s.measuredR > 0 ? 'measured' : 'BSD/2 + tyre'} + clearance = ${f0(g.tyreR)} + ${s.clear} = ${f0(g.R)} mm` },
    { title: 'Taper is local, not global', body: 'Crown width is held constant until the taper knee, then interpolated linearly to the tail. Because every dart is computed from the local crown width, the pattern edge follows the taper automatically — dart positions do not move, the edge they sit on does. Taper exists so the tail can pass a chainstay bridge or fork crown, not for looks.', formula: `crown ${f0(g.crown0)} mm until ${f0(g.knee)} mm, then → ${f0(g.crownTail)} mm at ${f0(g.L)} mm` },
    { title: 'Asymmetric coverage', body: 'Lead and trail are separate because a front fender wants material ahead of the axle (that is where the spray at your feet comes from) and a rear wants a long tail. Zero lead gives you a rear-only fender that starts at the top of the wheel.', formula: `lead ${s.lead}° + trail ${s.trail}° = ${f0(g.cov)}°` },
    { title: s.side === 'front' ? 'Front mounting' : 'Rear mounting', body: s.side === 'front' ? 'A front fender hangs from one bolt through the fork crown at top dead centre, with the struts running to the blade eyelets. Everything behind that bolt is cantilevered, so the struts sit on the trailing half of the arc where they actually resist flutter. The crown slot runs along the length so the fender can slide fore and aft to centre it.' : 'A rear fender takes two frame bolts — the chainstay bridge low at the front and the seatstay bridge higher up — with the struts running back to the dropouts. Two mounts on different radii is what stops a long rear fender from oscillating. Both are slots, not holes, because no two frames put those bridges the same distance apart.', formula: mounts.map((m) => `${m.label} at ${f0(m.x)} mm`).join(' · ') },
    { title: 'How the panel seam works', body: `Butting two panels edge to edge has nothing to fasten. Instead each panel is cut ${OVERLAP} mm past its seam and laps under the next, so a single row of fasteners passes through both layers in the middle of the lap. Lap direction matters more than fastener choice: forward panel on top, always.`, formula: panelCount > 1 ? `${panelCount} panels · ${OVERLAP} mm lap · fastener row at lap centre` : 'single sheet — no seams' },
    { title: 'What a butt strap is', body: 'A rivet cannot pull a V-shaped gap closed the way a zip tie can — it needs two layers to squeeze. The butt strap is a small separate rectangle that sits behind the dart and bridges it: two rivets into the left flap, two into the right. The dart stays open by design; the strap carries the load. Zip ties and clips need no strap because they pull through both sides at once.', formula: 'strap 34 × 14 mm · 4 × 3.2 mm holes · one per dart' },
    { title: 'Every hole is a crack initiator', body: 'In thin plastic, fatigue cracks start at holes, and the crown is the worst place to put one because that is where water sits. Hence the hole-free option: a scored channel and one zip tie round the girth, nothing pierced. Struts fasten at the skirt edge for the same reason.', formula: `strut pairs at ${f0(inset)} mm inset, 10 mm apart · crown unpierced` },
    { title: 'Sacrificial strut end', body: 'A fender that jams should let go before it stops the wheel. The optional single oversize hole at the frame end is the intended failure point: one fastener in tension, nothing redundant. This is a safety feature, not a tolerance.', formula: s.fuse ? 'single 6.4 mm hole, one fastener' : 'off — both ends fully fastened' },
    { title: 'Nesting', body: 'A tapered blank nests tail-to-nose with a second one, so a front and rear pair costs less than twice one fender in stock width. The ghost outline shows the pair; cut the shared edge once.', formula: s.nest ? `pair stock ≈ ${f0(g.L)} × ${f0(g.Wd * 2 + 10)} mm` : 'off' },
    { title: 'Print geometry', body: `Each tile draws into ${PW} × ${PH} mm inside a 15 mm safe margin, which clears the unprintable edge on essentially every consumer inkjet and laser. Tiles overlap ${OV} mm so the cut line crosses both sheets and can be aligned by eye.`, formula: `A4 landscape 297 × 210 − 2 × 15 mm = ${PW} × ${PH} mm live` },
    { title: 'Bend allowance, properly', body: 'A fold does not consume the length a sharp corner would. The flat pattern needs the two legs measured to the theoretical sharp corner, minus twice the setback, plus the arc length along the neutral axis. Bend radius is taken as equal to thickness (a hand fold over a straight edge, not a press brake) and the k-factor as 0.44, which is the usual figure for soft sheet in air bending. At zero thickness every term collapses to zero and the pattern is the ideal one.', formula: `setback = (r+t)·tan(α/2) = ${f1(g.setback)} · BA = α(r+0.44t) = ${f1(g.BA)} · net ${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm per fold` },
    { title: 'Darts get wider with thickness', body: 'Two folded flaps meeting at a closed dart collide edge-on if the dart is cut to the ideal width — the material has to go somewhere. Adding one thickness to every dart gives the two edges room to sit alongside each other rather than fighting.', formula: `dart = L·drop/R/n + t = ${f1(g.notch)} mm` },
    { title: 'Hemmed edge', body: 'Folding the skirt edge back on itself doubles the material at the most vulnerable line on the fender, removes the cut edge you would otherwise brush your ankle against, and stiffens the whole skirt far more than extra thickness would. Cost is a wider blank and one more fold to make cleanly.', formula: s.hem ? `hem ${f0(g.hem)} mm = 2t + 4 · blank ${f0(g.Wd)} mm wide` : 'off' },
    { title: 'Export', body: 'SVG and DXF both come out at 1 unit = 1 mm with no transform, so they land at true size in Inkscape, LightBurn, Illustrator or any CAM tool. Cut geometry, fold and score lines, and hole centres go on separate layers — a laser wants to score the folds at low power and cut the outline at full, and it cannot guess which is which from the geometry alone.', formula: 'SVG: 1 user unit = 1 mm · DXF: R12 ASCII, LWPOLYLINE + CIRCLE, layers CUT / FOLD / HOLES' },
    { title: 'Still open', body: 'Cross-section as a true arc rather than a crown plus two flat facets — better spray control, much harder pattern. A measured k-factor for real sheet rather than the 0.44 rule of thumb. And strut stiffness: a rolled or channel-section strut would outperform a flat strip by a large margin, but it stops being cuttable with scissors, which is the whole point of this thing.', formula: '' }
  ];
}

function specs(s, g, finished, panelCount, cols, rows) {
  return [
    { label: 'Fender radius', value: `${f0(g.R)} mm`, note: s.measuredR > 0 ? 'measured tyre radius + clearance' : 'estimated tyre radius + clearance' },
    { label: 'Developed length', value: `${f0(g.L)} mm`, note: `R × ${f0(g.cov)}° in radians` },
    { label: 'Developed width', value: `${f0(g.Wd)} mm`, note: 'crown + 2 × skirt, at full width' },
    { label: 'Finished width', value: `${f0(finished)} mm`, note: `tail ${f0(g.crownTail + 2 * g.proj)} mm after taper` },
    { label: 'Flap pitch', value: `${f0(g.pitch)} mm`, note: `arc ÷ ${g.n} flaps` },
    { label: 'Dart width', value: `${f1(g.notch)} mm`, note: s.thick > 0 ? `incl. ${f1(s.thick)} mm thickness clearance` : 'at the free edge, tapering to 0 at the fold' },
    { label: 'Bend allowance', value: `${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm`, note: s.thick > 0 ? `per fold · setback ${f1(g.setback)}, arc ${f1(g.BA)}` : 'zero-thickness model' },
    { label: 'Total take-up', value: `${f1(g.removal)} mm`, note: 'removed by all darts, one side' },
    { label: 'Blank area', value: `${f1((g.L * g.Wd) / 1e6)} m²`, note: s.nest ? 'each · nested pair shares the stock width' : 'before darts are cut' },
    { label: 'Material panels', value: panelCount === 1 ? 'one sheet' : `× ${panelCount}`, note: panelCount === 1 ? `needs ${f0(g.L)} mm of stock` : `each ≈ ${f0(g.L / panelCount + OVERLAP)} × ${f0(g.Wd)} mm incl. lap` },
    { label: 'Sheets to print', value: `${rows * cols + 2}`, note: `${cols} × ${rows} tiles + parts + instructions` }
  ];
}

const DEFAULTS = {
  side: 'rear', wheel: '700c', tyre: 35, measuredR: 0, clear: 14, crown: 55, skirt: 26, angle: 55,
  thick: 0.8, lead: 40, trail: 175, taper: 15, taperAt: 70, flaps: 20, struts: 2, strutLen: 160,
  mudflap: 100, join: 'zip', stock: 'a4', tongue: true, fuse: false, nest: false, hem: false
};
const CARGO20 = {
  side: 'rear', wheel: '20in', tyre: 50, measuredR: 0, clear: 16, crown: 62, skirt: 30, angle: 55,
  thick: 0.8, lead: 60, trail: 200, taper: 25, taperAt: 70, flaps: 16, struts: 3, strutLen: 220,
  mudflap: 90, join: 'zip', stock: 'single', tongue: true, fuse: false, nest: false, hem: false
};

const CASES = {
  'default-700c-rear': DEFAULTS,
  'cargo-20in-single': CARGO20,
  'front-700c': { ...CARGO20, side: 'front', wheel: '700c', tyre: 35, clear: 14, crown: 55, skirt: 26, lead: 120, trail: 140, flaps: 20, struts: 2, strutLen: 160, mudflap: 60 },
  'gravel-650b-hem-a4': { ...CARGO20, wheel: '650b', tyre: 50, clear: 18, crown: 72, skirt: 32, flaps: 22, hem: true, stock: 'a4', thick: 1.2 },
  'measured-no-taper-nojoin': { ...CARGO20, measuredR: 250, taper: 0, join: 'none', tongue: false },
  'mtb-26in-slot-thick': { ...CARGO20, wheel: '26in', tyre: 55, crown: 78, thick: 2.0, join: 'slot', flaps: 12 },
  'nested-pair': { ...DEFAULTS, nest: true },
  'rivet-join': { ...DEFAULTS, join: 'rivet' },
  'nested-cargo-20in': { ...CARGO20, nest: true }
};

const GEO_KEYS = ['bsd','tyreRcalc','tyreR','R','cov','th','aNose','L','a','skirt','skirtTrue','t','rBend','setback','BA','bendComp','hem','proj','drop','crown0','crownTail','knee','Wd','yc','n','pitch','removal','notch'];

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
for (const [name, cfg] of Object.entries(CASES)) {
  const r = blank(cfg);
  const g = {};
  for (const k of GEO_KEYS) g[k] = r.g[k];
  const p = parts(cfg, r.g);
  const x = xsec(cfg, r.g);
  const t = tiling(cfg, r.g, r.bboxW, r.bboxH);
  const iso = {};
  for (const spin of ISO_SPINS) {
    iso[spin] = summarizeIso(isometric(cfg, r.g, r.strutFrac, spin));
  }
  const w = warnings(cfg, r.g, p.partsFits, p.partsW);
  const st = steps(cfg, r.g, r.panelCount, t.cols, t.rows);
  const en = engNotes(cfg, r.g, r.panelCount, r.inset, r.mounts);
  const sp = specs(cfg, r.g, x.finished, r.panelCount, t.cols, t.rows);
  const jn = joinNote(cfg.join);
  const assembledLabel = `${cfg.side === 'front' ? 'Front' : 'Rear'} · ${WHEELS[cfg.wheel].label} · ${f0(r.g.cov)}° (${cfg.lead}/${cfg.trail}) · ${f0(x.finished)} mm wide · ${r.g.n} flaps · ${cfg.struts} struts${cfg.mudflap > 0 ? ` · ${f0(cfg.mudflap)} mm flap` : ''}`;
  const printSpecLine = `${WHEELS[cfg.wheel].label} · tyre ${cfg.tyre} (R ${f0(r.g.tyreR)}) · crown ${cfg.crown} → ${f0(r.g.crownTail)} · skirt ${cfg.skirt} @ ${cfg.angle}° · clearance ${cfg.clear} · ${cfg.lead}°/${cfg.trail}° · ${r.g.n} flaps · ${cfg.struts} struts · mudflap ${cfg.mudflap}`;
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
      sheetCount: t.sheetCount,
      rects: t.tileRects,
      tiles: t.printTiles,
      nestTransform: t.nestTransform
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
}

const path = process.argv[2];
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${Object.keys(out).length} cases → ${path}`);
for (const [k, v] of Object.entries(out)) {
  console.log(`  ${k.padEnd(26)} L=${v.geo.L.toFixed(4)} Wd=${v.geo.Wd.toFixed(4)} holes=${v.blank.holeCount} slots=${v.blank.slotCount} panels=${v.blank.panelCount}`);
}
