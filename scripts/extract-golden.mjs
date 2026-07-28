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

  return { g, blankOutline, foldLines, scoreLines, holes, slots, seams, lapLines, panelCount, strutFrac, viewBox, bboxW, bboxH };
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
  'nested-pair': { ...DEFAULTS, nest: true }
};

const GEO_KEYS = ['bsd','tyreRcalc','tyreR','R','cov','th','aNose','L','a','skirt','skirtTrue','t','rBend','setback','BA','bendComp','hem','proj','drop','crown0','crownTail','knee','Wd','yc','n','pitch','removal','notch'];

const out = {};
for (const [name, cfg] of Object.entries(CASES)) {
  const r = blank(cfg);
  const g = {};
  for (const k of GEO_KEYS) g[k] = r.g[k];
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
    }
  };
}

const path = process.argv[2];
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${Object.keys(out).length} cases → ${path}`);
for (const [k, v] of Object.entries(out)) {
  console.log(`  ${k.padEnd(26)} L=${v.geo.L.toFixed(4)} Wd=${v.geo.Wd.toFixed(4)} holes=${v.blank.holeCount} slots=${v.blank.slotCount} panels=${v.blank.panelCount}`);
}
