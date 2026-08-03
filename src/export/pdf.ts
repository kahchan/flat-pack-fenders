import { RULER_CAPTION } from '../lib/printStrokes';
import { pathPolys } from './pathPolys';
import type { AssemblyStep, DrawingModel, Hole, Label, BlankModel, PartsPage, PrintTile, Slot } from '../fender/types';

/**
 * Hand-written PDF export — the print tree (`src/components/print/`), rendered without
 * a print dialog. PLAN §11.2. Zero dependencies: every byte below is assembled by hand,
 * the same discipline as `dxf.ts`.
 *
 * **Why `Uint8Array`, not a string.** WinAnsiEncoding (the encoding this file declares
 * for its one font, see below) needs single bytes above 0x7F for em dashes, curly
 * quotes and the degree sign — real text this app prints (`printSpecLine`, assembly
 * step bodies, part labels). `downloadText`'s `new Blob([text])` UTF-8-encodes a JS
 * string, which would silently re-encode every one of those bytes to two bytes and
 * shift every subsequent `xref` offset — the file would open as garbage text AND fail
 * to parse structurally. Building the file as a byte buffer (`downloadBinary` in
 * `download.ts`, added alongside this) makes that class of bug impossible: the bytes
 * this module writes are the bytes on disk.
 *
 * **Scale, by construction (PLAN §9.18, §11.2).** Every page's content stream opens
 * with one `cm`: `2.834645669 0 0 -2.834645669 e f cm` (2.834645669 = 72/25.4 exactly,
 * PLAN's literal constant). After that, every coordinate below is the *same millimetre
 * number the model already computed* — verbatim, no re-scaling, no DPI guesswork. The
 * `-2.834645669` (not `+`) is the SVG→PDF Y-flip PLAN calls out as "the easiest thing
 * here to get subtly wrong": SVG's viewBox is Y-down from the page's top-left; PDF's
 * device space is Y-up from the bottom-left. Folding the flip into the one `cm` per
 * page — rather than negating every coordinate by hand, the way `dxf.ts` does for DXF's
 * Y-up-with-no-group-transform — means every path/circle/rect helper below reads
 * exactly like the SVG it mirrors. Verified by measurement, not assertion: see
 * `pdf.test.ts`'s ruler test and this package's own report.
 *
 * **Text mirrors too — and needs a second fix.** The same negative-`d` `cm` that
 * flips geometry the right way up also flips glyphs upside down, because a font's "up"
 * is baked into its outlines. `textOps` counters this with the text matrix (`Tm`), not
 * `Td`: `Td` only translates, so plain text under this page's CTM would render mirrored
 * top-to-bottom. `Tm`'s own linear part is chosen so that, composed with whatever CTM
 * is active at that point (page-level, or nested inside a Sheet B part's rotate(-90)
 * group), the *reflection* introduced by the page flip cancels while any *rotation*
 * introduced by a part transform survives — because that rotation is wanted: PLAN §12
 * requires a rotated strut's label to rotate with it. The two `mirrorMode`s below
 * (`'normal'` / `'rotated'`) are the two cases this file's geometry ever nests text in;
 * the derivation (composing 2×2 linear parts) is in the design notes, not reproduced
 * as a code comment because the two resulting constants are all that matters here.
 *
 * **Text encoding — WinAnsiEncoding, not strict Latin-1.** The 14 standard fonts need
 * no embedding, but `printSpecLine`, assembly steps and several labels use ° · × – — ’
 * “ ” … — all outside ASCII. Latin-1 (ISO-8859-1) covers °·×÷ (identical code points to
 * Unicode) but leaves the em dash, curly quotes and ellipsis unrepresentable in a single
 * byte. WinAnsiEncoding — the PDF spec's standard name for the Windows-1252 code page —
 * covers all of those too (0x80–0x9F is where it and Latin-1 diverge) and needs no
 * `/Differences` array, just `/Encoding /WinAnsiEncoding` on the font dict. `winAnsiByte`
 * below is that mapping table for the small set of characters this app's text actually
 * uses; anything outside it (this app has nothing outside it in printed text — verified,
 * see `pdf.test.ts`) falls back to `?` rather than throwing.
 *
 * **Layer→OCG mapping.** PLAN says "optional content groups for CUT / FOLD / HOLES" —
 * the same three buckets `dxf.ts` already uses, reused here for consistency rather than
 * invented fresh. Two elements have no DXF precedent (DXF never draws them): `lapLines`
 * and the tile `frame`/ruler/labels. `lapLines` join `seams` in FOLD — both are dashed
 * "cut/lap here" reference lines, DXF already put seams there (its own comment doesn't
 * explain why; this file just matches it), and grouping the two dashed reference-line
 * kinds together is the more defensible reading than inventing a fourth OCG. The frame,
 * ruler, caption and every text label are drawn outside all three OCGs — they're page
 * furniture and measurement aids, not cuttable/foldable geometry, so hiding FOLD must
 * not also hide the ruler that proves the page's own scale.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** 72/25.4, PLAN's literal figure — kept as a string so every `cm` operator emits the
 * exact digits PLAN specifies, not whatever `(72/25.4).toString()` happens to produce. */
const SCALE = '2.834645669';
const SCALE_N = 2.834645669;

/** A4 landscape, PLAN §11.2's literal figures (mm-derived, rounded to 2dp same as the spec). */
const PAGE_W_PT = 841.89;
const PAGE_H_PT = 595.28;

/** Safe margin, mm — same figure the print tiles are already laid out inside (PLAN §11.2,
 * and `defaults.ts`'s `PW`/`PH` comment: "A4 landscape live area inside a 15 mm safe margin"). */
const MARGIN = 15;

/** PLAN §11.2: "hairline 0.35 mm" — one width for every stroked element in this export,
 * deliberately not the varied `PRINT_STROKE` weights the screen/print CSS uses for visual
 * hierarchy. A laser or a print shop wants one unambiguous cut weight, not a hierarchy. */
const HAIRLINE = 0.35;

const KAPPA = 0.5522847498307936; // 4-arc bezier circle approximation constant

// ── Number/text formatting ──────────────────────────────────────────────────

function num(n: number): string {
  let r = Math.round(n * 1e6) / 1e6;
  if (Object.is(r, -0)) r = 0;
  const s = r.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' ? '0' : s;
}

/** Windows-1252 (WinAnsiEncoding)'s 0x80–0x9F block — the only place it diverges from
 * Latin-1. Only the code points this app's printed text actually contains are listed;
 * `winAnsiByte` falls back to `?` for anything else (see file header). */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function winAnsiByte(codePoint: number): number {
  if (codePoint <= 0xff && !(codePoint >= 0x80 && codePoint <= 0x9f)) return codePoint;
  return WIN_ANSI_HIGH[codePoint] ?? 0x3f; // '?'
}

/** A PDF literal string `(...)`, WinAnsi-encoded and with `()\` escaped. Every character
 * that reaches the content stream as text goes through here — nothing else in this file
 * ever writes a JS string's raw UTF-16 units into the output. */
export function pdfTextLiteral(text: string): string {
  let out = '';
  for (const ch of text) {
    const b = winAnsiByte(ch.codePointAt(0)!);
    const c = String.fromCharCode(b);
    out += c === '(' || c === ')' || c === '\\' ? '\\' + c : c;
  }
  return `(${out})`;
}

/** Standard Adobe Helvetica AFM widths, /1000 em, for ASCII 32–126 — used only to
 * right/middle-align labels and to word-wrap the instructions page. Approximate for the
 * WinAnsi-only characters outside this range (falls back to 556, the lower-case average)
 * since none of them appear at the start/end of an anchored label in this app's output. */
const HELV_WIDTH: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333,
  42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 48: 556, 49: 556, 50: 556, 51: 556,
  52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584,
  62: 584, 63: 556, 64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778,
  82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611, 91: 278,
  92: 278, 93: 278, 94: 469, 95: 556, 96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556,
  102: 278, 103: 556, 104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
  111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
  120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584
};

function helvTextWidth(text: string, size: number): number {
  let sum = 0;
  for (const ch of text) sum += HELV_WIDTH[winAnsiByte(ch.codePointAt(0)!)] ?? 556;
  return (sum / 1000) * size;
}

// ── Transform matrices (PDF `cm`/`Tm`, [a b c d e f]) ────────────────────────

type Mat = readonly [number, number, number, number, number, number];

/** The one `cm` per page: millimetre user space (SVG-style, Y down from the page's own
 * top-left corner at `(ox, oy)` plus `MARGIN`), mapped to PDF device space (points,
 * Y up from the bottom). Derivation: PLAN §11.2 fixes the scale; MARGIN/ox/oy are this
 * file's own bookkeeping for "which window of model space this page shows" — see the
 * per-page builders below, each of which knows its own `(ox, oy)` the way the print
 * tree's own `viewBox` does.
 *
 * The scale slots are emitted as the literal `SCALE` string, not `num(SCALE_N)` — PLAN
 * gives 2.834645669 as the exact figure to use, and rounding the full double
 * (2.834645669291339…) to `num`'s 6dp would quietly print 2.834646 instead. The
 * translation (e/f) has no such literal to match, so it's fine through `num`. */
function pageCmOp(ox: number, oy: number): string {
  const e = SCALE_N * (MARGIN - ox);
  const f = PAGE_H_PT - SCALE_N * (MARGIN - oy);
  return `${SCALE} 0 0 -${SCALE} ${num(e)} ${num(f)} cm\n`;
}

function translateMat(tx: number, ty: number): Mat {
  return [1, 0, 0, 1, tx, ty];
}

/** `rotate(-90)` then `translate(tx,ty)`, PDF-matrix form of `packedPartTransform`'s
 * `translate(x,y+w) rotate(-90)` (SVG transform lists apply right-to-left to a point). */
function rotateNeg90TranslateMat(tx: number, ty: number): Mat {
  return [0, -1, 1, 0, tx, ty];
}

function cmOp(m: Mat): string {
  return `${num(m[0])} ${num(m[1])} ${num(m[2])} ${num(m[3])} ${num(m[4])} ${num(m[5])} cm\n`;
}

// ── Content-stream drawing helpers ──────────────────────────────────────────

function polylineOps(pts: [number, number][], closed: boolean): string {
  if (pts.length < 2) return '';
  let s = `${num(pts[0]![0])} ${num(pts[0]![1])} m\n`;
  for (let i = 1; i < pts.length; i++) s += `${num(pts[i]![0])} ${num(pts[i]![1])} l\n`;
  s += closed ? 's\n' : 'S\n';
  return s;
}

/** Draws a path `d` string — `pathPolys` (shared with `dxf.ts`) tokenises it, sampling
 * any strut/mudflap curve at 0.4 mm (PLAN §9.2); the blank never contains one. Closedness
 * is read off the whole `d` string once (a trailing `Z`) and applied to every resulting
 * subpath, matching `dxf.ts`'s `closed()`. */
function pathOps(d: string): string {
  const closed = /z\s*$/i.test(d.trim());
  return pathPolys(d)
    .map((pts) => polylineOps(pts, closed))
    .join('');
}

function slotOps(sl: Slot): string {
  const x = +sl.x;
  const y = +sl.y;
  const w = +sl.w;
  const h = +sl.h;
  return polylineOps(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ],
    true
  );
}

/** PDF has no circle primitive — approximated with the standard 4-arc Bezier construction
 * (the same trick every PDF-writing library uses; `κ = 0.5522847498…`). */
function circleOps(h: Hole): string {
  const cx = +h.cx;
  const cy = +h.cy;
  const r = h.r;
  const k = r * KAPPA;
  return (
    `${num(cx + r)} ${num(cy)} m\n` +
    `${num(cx + r)} ${num(cy + k)} ${num(cx + k)} ${num(cy + r)} ${num(cx)} ${num(cy + r)} c\n` +
    `${num(cx - k)} ${num(cy + r)} ${num(cx - r)} ${num(cy + k)} ${num(cx - r)} ${num(cy)} c\n` +
    `${num(cx - r)} ${num(cy - k)} ${num(cx - k)} ${num(cy - r)} ${num(cx)} ${num(cy - r)} c\n` +
    `${num(cx + k)} ${num(cy - r)} ${num(cx + r)} ${num(cy - k)} ${num(cx + r)} ${num(cy)} c\n` +
    's\n'
  );
}

type MirrorMode = 'normal' | 'rotated';

/** One label. `mode` picks the `Tm` linear part that cancels the page's Y-flip without
 * undoing an ancestor rotation — see the file header. `font` selects `/F1` (Helvetica)
 * or `/F2` (Helvetica-Bold, instructions-page step titles only). */
function textOps(l: Label, mode: MirrorMode, font: 'F1' | 'F2' = 'F1'): string {
  const anchor = l.anchor ?? 'start';
  const width = helvTextWidth(l.text, l.size);
  const dx = anchor === 'middle' ? -width / 2 : anchor === 'end' ? -width : 0;
  const x = +l.x + dx;
  const y = +l.y;
  const [a, b, c, d] = mode === 'rotated' ? [-1, 0, 0, 1] : [1, 0, 0, -1];
  return `BT\n/${font} ${num(l.size)} Tf\n${num(a)} ${num(b)} ${num(c)} ${num(d)} ${num(x)} ${num(y)} Tm\n${pdfTextLiteral(l.text)} Tj\nET\n`;
}

/** Wraps `body` inside `/{tag} BDC … EMC` — the OCG marked-content sequence that lets a
 * viewer toggle CUT/FOLD/HOLES. No-op (and emits nothing) for empty geometry. */
function ocg(tag: 'OC1' | 'OC2' | 'OC3', body: string): string {
  return body ? `/${tag} BDC\n${body}EMC\n` : '';
}

// ── Per-page content streams ─────────────────────────────────────────────────

function tilePageContent(blank: BlankModel, tile: PrintTile): string {
  const [oxs, oys] = tile.viewBox.split(' ');
  const ox = Number(oxs);
  const oy = Number(oys);

  let s = 'q\n' + pageCmOp(ox, oy) + `${num(HAIRLINE)} w\n0 G\n`;

  s += '[4 3] 0 d\n' + pathOps(tile.frame) + '[] 0 d\n';
  s += pathOps(tile.ruler);
  s += textOps({ x: tile.rulerX, y: tile.rulerY, size: 4, text: RULER_CAPTION, anchor: 'start' }, 'normal');

  s += ocg('OC1', pathOps(blank.outline));
  blank.seams.forEach((sm) => (s += ocg('OC2', pathOps(sm.d))));
  blank.lapLines.forEach((lp) => (s += ocg('OC2', pathOps(lp.d))));
  blank.foldLines.forEach((f) => (s += ocg('OC2', pathOps(f.d))));
  blank.scoreLines.forEach((c) => (s += ocg('OC2', pathOps(c.d))));
  blank.holes.forEach((h) => (s += ocg('OC3', circleOps(h))));
  blank.slots.forEach((sl) => (s += ocg('OC1', slotOps(sl))));
  blank.labels.forEach((l) => (s += textOps(l, 'normal')));

  s += 'Q\n';
  return s;
}

function sheetBPageContent(page: PartsPage, pageIndex: number, pageCount: number): string {
  const ox = -2;
  const oy = 0;
  let s = 'q\n' + pageCmOp(ox, oy) + `${num(HAIRLINE)} w\n0 G\n`;

  s += textOps(
    {
      x: ox + 2,
      y: -6,
      size: 6,
      text: `Sheet B, struts, mudflap & hardware, 1:1, page ${pageIndex + 1} of ${pageCount}`,
      anchor: 'start'
    },
    'normal'
  );

  for (const part of page.parts) {
    const m = part.rotated ? rotateNeg90TranslateMat(part.x, part.y + part.w) : translateMat(part.x, part.y);
    s += 'q\n' + cmOp(m);
    s += ocg('OC1', pathOps(part.outline.d));
    part.folds.forEach((f) => (s += ocg('OC2', pathOps(f.d))));
    part.holes.forEach((h) => (s += ocg('OC3', circleOps(h))));
    s += textOps(part.label, part.rotated ? 'rotated' : 'normal');
    s += 'Q\n';
  }

  s += 'Q\n';
  return s;
}

function wrapText(text: string, maxWidthPt: number, size: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (cur && helvTextWidth(trial, size) > maxWidthPt) {
      lines.push(cur);
      cur = word;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** No model geometry here, so no dimensional exactness at stake — this page is drawn
 * directly in PDF's native (Y-up) point space rather than through `pageMatrix`, with a
 * plain top-down `Td` per line. Two columns, split by count (not by measured height) —
 * simple and, for the 6–9 steps this app ever produces, always fits. */
function instructionsContent(printSpecLine: string, steps: AssemblyStep[]): string {
  const left = MARGIN * SCALE_N;
  const right = PAGE_W_PT - MARGIN * SCALE_N;
  const gap = 10 * SCALE_N;
  const colW = (right - left - gap) / 2;
  const topY = (mmFromTop: number) => PAGE_H_PT - mmFromTop * SCALE_N;

  let s = '0 g\n';
  s += `BT\n/F2 18 Tf\n${num(left)} ${num(topY(20))} Td\n${pdfTextLiteral('Flat-pack fender: assembly')} Tj\nET\n`;
  s += `BT\n/F1 10 Tf\n${num(left)} ${num(topY(30))} Td\n${pdfTextLiteral(printSpecLine)} Tj\nET\n`;

  const mid = Math.ceil(steps.length / 2);
  const columns = [steps.slice(0, mid), steps.slice(mid)];
  columns.forEach((col, ci) => {
    const x = left + ci * (colW + gap);
    let y = 45;
    for (const step of col) {
      s += `BT\n/F2 11 Tf\n${num(x)} ${num(topY(y))} Td\n${pdfTextLiteral(`${step.n}: ${step.title}`)} Tj\nET\n`;
      y += 6;
      const bodyLines = wrapText(step.body, colW, 9);
      for (const line of bodyLines) {
        s += `BT\n/F1 9 Tf\n${num(x)} ${num(topY(y))} Td\n${pdfTextLiteral(line)} Tj\nET\n`;
        y += 4.5;
      }
      y += 5;
    }
  });

  return s;
}

// ── PDF object graph + serialisation ────────────────────────────────────────

/**
 * Assembles the whole file: a `%PDF-1.5` header, one object per font/OCG/page/content
 * stream, an `xref` table of exact byte offsets, and a trailer — the classic hand-rolled
 * PDF skeleton. Built as a "binary string" (one JS char = one byte, values 0–255 only,
 * enforced by every text-emitting helper above funnelling through `pdfTextLiteral`) and
 * converted to bytes in one shot at the end; see the file header for why this can't be a
 * plain JS string handed to `Blob` directly.
 */
export function buildPdf(model: DrawingModel): Uint8Array<ArrayBuffer> {
  const { blank, parts, tiling, steps, printSpecLine } = model;

  const pageContents: string[] = [];
  tiling.tiles.forEach((tile) => pageContents.push(tilePageContent(blank, tile)));
  parts.pages.forEach((page, i) => pageContents.push(sheetBPageContent(page, i, parts.pages.length)));
  pageContents.push(instructionsContent(printSpecLine, steps));

  let nextObj = 1;
  const alloc = () => nextObj++;

  const catalogNum = alloc();
  const pagesNum = alloc();
  const fontRegularNum = alloc();
  const fontBoldNum = alloc();
  const ocgCutNum = alloc();
  const ocgFoldNum = alloc();
  const ocgHolesNum = alloc();

  const pageNums = pageContents.map(() => alloc());
  const contentNums = pageContents.map(() => alloc());

  const bodies: string[] = new Array(nextObj);

  bodies[catalogNum] =
    `<< /Type /Catalog /Pages ${pagesNum} 0 R /OCProperties ` +
    `<< /OCGs [${ocgCutNum} 0 R ${ocgFoldNum} 0 R ${ocgHolesNum} 0 R] ` +
    `/D << /BaseState /ON /ON [${ocgCutNum} 0 R ${ocgFoldNum} 0 R ${ocgHolesNum} 0 R] ` +
    `/Order [${ocgCutNum} 0 R ${ocgFoldNum} 0 R ${ocgHolesNum} 0 R] >> >> >>`;
  bodies[pagesNum] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`;
  bodies[fontRegularNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  bodies[fontBoldNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  bodies[ocgCutNum] = '<< /Type /OCG /Name (CUT) >>';
  bodies[ocgFoldNum] = '<< /Type /OCG /Name (FOLD) >>';
  bodies[ocgHolesNum] = '<< /Type /OCG /Name (HOLES) >>';

  pageContents.forEach((content, i) => {
    const pn = pageNums[i]!;
    const cn = contentNums[i]!;
    bodies[pn] =
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W_PT} ${PAGE_H_PT}] ` +
      `/Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R >> ` +
      `/Properties << /OC1 ${ocgCutNum} 0 R /OC2 ${ocgFoldNum} 0 R /OC3 ${ocgHolesNum} 0 R >> >> ` +
      `/Contents ${cn} 0 R >>`;
    bodies[cn] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = '%PDF-1.5\n%' + String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3) + '\n';
  const offsets: number[] = new Array(nextObj).fill(0);
  for (let n = 1; n < nextObj; n++) {
    offsets[n] = pdf.length;
    pdf += `${n} 0 obj\n${bodies[n]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${nextObj}\n0000000000 65535 f \n`;
  for (let n = 1; n < nextObj; n++) pdf += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${nextObj} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Uint8Array.from(pdf, (ch) => ch.charCodeAt(0));
}
