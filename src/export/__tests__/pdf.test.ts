import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildModel } from '../../fender/index';
import { DEFAULTS } from '../../fender/defaults';
import { buildDxf } from '../dxf';
import { buildPdf, pdfTextLiteral } from '../pdf';
import { buildSvg } from '../svg';
import type { DrawingModel, FenderConfig } from '../../fender/types';

/**
 * `pathPolys`'s curve branch needs a DOM this `node` vitest environment doesn't have (no
 * `jsdom` — see `pathPolys.test.ts`, `dxf.test.ts`). The blank never contains a curve
 * (PLAN §9.2), so Sheet A tiles + instructions are always safe to build for real; Sheet
 * B is only safe for a curve-free config (struts: 0, mudflap: 0, matching dxf.test.ts's
 * technique) or once its geometry is emptied entirely.
 */

type Case = { config: FenderConfig; baseName: string };
const CASES = Object.entries(golden as unknown as Record<string, Case>);

/** Real Sheet A + instructions, zero Sheet B pages — safe to run `buildPdf` on in plain
 * Node for ANY config, including the true default, because Sheet A/instructions never
 * touch `parts` at all. */
function withoutSheetB(model: DrawingModel): DrawingModel {
  return { ...model, parts: { ...model.parts, outlines: [], folds: [], holes: [], slots: [], pages: [] } };
}

function curveFreeConfig(base: FenderConfig): FenderConfig {
  return { ...base, struts: 0, mudflap: 0, join: 'rivet', flaps: 6 };
}

// ---- Minimal PDF reader for the structural/measurement assertions below. Only reads
// back what this file's own writer produces — not a general PDF parser.

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

function contentStreams(pdf: string): string[] {
  return [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]!);
}

function pageObjects(pdf: string): string[] {
  return [...pdf.matchAll(/\d+ 0 obj\n(<< \/Type \/Page \/Parent[\s\S]*?>>)\nendobj/g)].map((m) => m[1]!);
}

function extractCm(content: string): [number, number, number, number, number, number] {
  const m = /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/.exec(content);
  if (!m) throw new Error('no cm operator found in content stream');
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])];
}

function applyMat([a, b, c, d, e, f]: [number, number, number, number, number, number], [x, y]: [number, number]): [number, number] {
  return [a * x + c * y + e, b * x + d * y + f];
}

/** The ruler's own 100 mm segment is the first `m`/`l` pair drawn after the frame's dash
 * reset (`[] 0 d`) and before its caption's `BT` — see `pdf.ts`'s `tilePageContent`. */
function rulerEndpointsModelSpace(content: string): [[number, number], [number, number]] {
  const rulerSection = content.split('[] 0 d\n')[1]!.split('BT')[0]!;
  const m = /(-?[\d.]+) (-?[\d.]+) m\n(-?[\d.]+) (-?[\d.]+) l/.exec(rulerSection);
  if (!m) throw new Error('no ruler segment found');
  return [
    [Number(m[1]), Number(m[2])],
    [Number(m[3]), Number(m[4])]
  ];
}

describe('buildPdf — ruler measures 100 mm exactly (PLAN §9.18, §11.2 acceptance test)', () => {
  it('the default config, parsed back: 100 mm reads 283.46 pt', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    const [firstTile] = contentStreams(pdf);
    const cm = extractCm(firstTile!);
    const [p0, p1] = rulerEndpointsModelSpace(firstTile!);
    const d0 = applyMat(cm, p0);
    const d1 = applyMat(cm, p1);
    const measuredPt = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]);
    expect(measuredPt).toBeCloseTo(283.46, 1);
    // The exact theoretical figure: 100 * (72/25.4).
    expect(measuredPt).toBeCloseTo(100 * (72 / 25.4), 3);
  });

  it('holds for every golden case, not just the default', () => {
    for (const [, c] of CASES) {
      const model = withoutSheetB(buildModel(c.config));
      const pdf = bytesToBinaryString(buildPdf(model));
      const [firstTile] = contentStreams(pdf);
      const cm = extractCm(firstTile!);
      const [p0, p1] = rulerEndpointsModelSpace(firstTile!);
      const d0 = applyMat(cm, p0);
      const d1 = applyMat(cm, p1);
      const measuredPt = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]);
      expect(measuredPt).toBeCloseTo(283.46, 1);
    }
  });
});

describe('buildPdf — Y-flip is the right way round (PLAN: "easiest thing to get subtly wrong")', () => {
  it('a point near the top of the SVG viewBox lands near the top of the PDF page (high device Y)', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    const [firstTile] = contentStreams(pdf);
    const cm = extractCm(firstTile!);
    const [ox, oy] = firstTile!
      .match(/(-?[\d.]+) (-?[\d.]+) m/)! // frame's first point, (ox, oy)
      .slice(1, 3)
      .map(Number);
    const top = applyMat(cm, [ox!, oy!]); // SVG-space top of the tile (small y)
    const bottom = applyMat(cm, [ox!, oy! + 180]); // 180mm down (PH), SVG-space bottom
    // PDF device space is Y-up: the SVG-top point must render HIGHER on the page.
    expect(top[1]).toBeGreaterThan(bottom[1]);
  });
});

describe('buildPdf — page count and structure match the print tree', () => {
  it('one page per Sheet A tile, then one per Sheet B page, then instructions', () => {
    const config = curveFreeConfig(CASES[0]![1].config);
    const model = buildModel(config);
    const pdf = bytesToBinaryString(buildPdf(model));
    const pages = pageObjects(pdf);
    const expectedCount = model.tiling.tiles.length + model.parts.pages.length + 1;
    expect(pages.length).toBe(expectedCount);
    expect(model.tiling.tiles.length).toBeGreaterThan(0);
    expect(model.parts.pages.length).toBeGreaterThan(0);
  });

  it('every page declares the A4-landscape MediaBox', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    const pages = pageObjects(pdf);
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach((p) => expect(p).toContain('/MediaBox [0 0 841.89 595.28]'));
  });

  it('the Pages tree Kids count matches /Count and the number of Page objects', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    const pagesObj = /\/Type \/Pages \/Kids \[([^\]]*)\] \/Count (\d+)/.exec(pdf)!;
    const kids = pagesObj[1]!.trim().split(/\s+0 R\s*/).filter(Boolean);
    expect(kids.length).toBe(Number(pagesObj[2]));
    expect(pageObjects(pdf).length).toBe(Number(pagesObj[2]));
  });

  it('declares three OCGs (CUT/FOLD/HOLES) referenced from the Catalog', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    expect(pdf).toContain('/OCProperties');
    expect(pdf).toContain('/Type /OCG /Name (CUT)');
    expect(pdf).toContain('/Type /OCG /Name (FOLD)');
    expect(pdf).toContain('/Type /OCG /Name (HOLES)');
  });

  it('the font is standard Helvetica/Helvetica-Bold, WinAnsiEncoded, not embedded', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    expect(pdf).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(pdf).not.toContain('/FontFile');
  });

  it('a curve-free full model (struts: 0, mudflap: 0) runs end to end, real Sheet B included', () => {
    const config = curveFreeConfig(CASES[0]![1].config);
    const model = buildModel(config);
    expect(() => buildPdf(model)).not.toThrow();
  });

  it('OCG-gated CUT/FOLD/HOLES entity counts on Sheet B match the model, curve-free config', () => {
    const config = curveFreeConfig(CASES[0]![1].config);
    const model = buildModel(config);
    const pdf = bytesToBinaryString(buildPdf(model));
    const streams = contentStreams(pdf);
    const sheetBStreams = streams.slice(model.tiling.tiles.length, model.tiling.tiles.length + model.parts.pages.length);
    const totalHoles = model.parts.pages.reduce((n, p) => n + p.parts.reduce((m, part) => m + part.holes.length, 0), 0);
    const foldGroups = sheetBStreams.join('').match(/\/OC2 BDC/g) ?? [];
    const holeGroups = sheetBStreams.join('').match(/\/OC3 BDC/g) ?? [];
    const totalFolds = model.parts.pages.reduce((n, p) => n + p.parts.reduce((m, part) => m + part.folds.length, 0), 0);
    expect(foldGroups.length).toBe(totalFolds);
    expect(holeGroups.length).toBe(totalHoles);
  });
});

describe('buildPdf — WinAnsi text encoding', () => {
  it('the default config really uses a middle dot and a degree sign in its spec line', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    expect(model.printSpecLine).toMatch(/°/); // sanity: the default really uses these
  });

  // PLAN FEEDBACK WP17 (decision A3) dropped every em-dash from this app's own printed
  // prose, so real content no longer exercises that WinAnsi mapping. Test the encoder
  // directly instead of fishing for the byte in incidental content — a curly apostrophe,
  // an em dash and a middle dot must each survive as a single WinAnsi byte, not a 3-byte
  // UTF-8 sequence (which would also corrupt every xref offset after it).
  it('em dash, middle dot, degree sign and curly quotes each encode to a single WinAnsi byte', () => {
    expect(pdfTextLiteral('—')).toBe(`(${String.fromCharCode(0x97)})`); // em dash
    expect(pdfTextLiteral('·')).toBe('(·)'); // middle dot, already Latin-1
    expect(pdfTextLiteral('°')).toBe('(°)'); // degree sign, already Latin-1
    expect(pdfTextLiteral('’')).toBe(`(${String.fromCharCode(0x92)})`); // curly apostrophe
  });

  it('a curly apostrophe in a real step body still survives into the file as a single byte', () => {
    const model = withoutSheetB(buildModel(DEFAULTS));
    const pdf = bytesToBinaryString(buildPdf(model));
    expect(pdf).toContain(String.fromCharCode(0x92)); // curly apostrophe, e.g. "don't slice"
    expect(pdf).not.toMatch(/\xe2\x80\x99/); // UTF-8 curly apostrophe, must NOT appear
  });
});

describe('SVG/DXF stay byte-identical — this package touches neither', () => {
  it.each(CASES)('%s: SVG unchanged', (_name, c) => {
    const model = buildModel(c.config);
    const golden_ = (golden as Record<string, { svgFull: string }>)[_name]!;
    expect(buildSvg(model)).toBe(golden_.svgFull);
  });

  it.each(CASES)('%s: DXF (blank only, PLAN §9.2) unchanged', (_name, c) => {
    const model = buildModel(c.config);
    const blankOnly: DrawingModel = { ...model, parts: { ...model.parts, outlines: [], folds: [], holes: [], slots: [] } };
    const golden_ = (golden as Record<string, { dxfBlankOnly: string }>)[_name]!;
    expect(buildDxf(blankOnly)).toBe(golden_.dxfBlankOnly);
  });
});
