import type { DrawingModel } from '../fender/types';

/**
 * Distance Sheet B (parts) sits below Sheet A (blank) in the combined drawing, mm.
 * Shared with `dxf.ts`'s vertical offset — both must agree or the two exports disagree
 * with each other about where the parts sheet is.
 */
const PARTS_GAP = 30;

/**
 * Sheet A + Sheet B as one SVG, 1 user unit = 1 mm, Inkscape layers CUT / FOLD / HOLES.
 *
 * Colours here are literal (`#000`/`#00f`/`#f00`), not design tokens — a laser cutter
 * and Inkscape read these, not the app's `--draw-*` palette. Ported verbatim from the
 * design source's `buildSvg()` (fender.html:507-535).
 */
export function buildSvg(model: DrawingModel): string {
  const { config, geo: g, blank, parts } = model;
  const x0 = config.tongue ? -40 : -6;
  const w = g.L + (config.tongue ? 40 : 0) + 12;
  const partsBox = parts.viewBox.split(' ').map(Number);
  const H = g.Wd + PARTS_GAP + partsBox[3]! + 12;
  const dy = (g.Wd + PARTS_GAP).toFixed(1);

  const strokePath = (d: string, sw: number) => `<path d="${d}" fill="none" stroke="#000" stroke-width="${sw}"/>`;
  const lines: string[] = [];

  lines.push('<g id="CUT" inkscape:label="CUT" inkscape:groupmode="layer" stroke="#000">');
  lines.push(strokePath(blank.outline, 0.2));
  parts.outlines.forEach((o) => lines.push(`<g transform="translate(0,${dy})">${strokePath(o.d, 0.2)}</g>`));
  blank.slots.forEach((sl) =>
    lines.push(`<rect x="${sl.x}" y="${sl.y}" width="${sl.w}" height="${sl.h}" rx="1.5" fill="none" stroke="#000" stroke-width="0.2"/>`)
  );
  parts.slots.forEach((sl) =>
    lines.push(
      `<g transform="translate(0,${dy})"><rect x="${sl.x}" y="${sl.y}" width="${sl.w}" height="${sl.h}" rx="1.5" fill="none" stroke="#000" stroke-width="0.2"/></g>`
    )
  );
  lines.push('</g>');

  lines.push('<g id="FOLD" inkscape:label="FOLD" inkscape:groupmode="layer" stroke="#0000ff">');
  blank.foldLines
    .concat(blank.scoreLines)
    .forEach((f) => lines.push(`<path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2"/>`));
  blank.seams.forEach((f) =>
    lines.push(`<path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2" stroke-dasharray="4 2"/>`)
  );
  parts.folds.forEach((f) =>
    lines.push(`<g transform="translate(0,${dy})"><path d="${f.d}" fill="none" stroke="#00f" stroke-width="0.2"/></g>`)
  );
  lines.push('</g>');

  lines.push('<g id="HOLES" inkscape:label="HOLES" inkscape:groupmode="layer" stroke="#ff0000">');
  blank.holes.forEach((c) =>
    lines.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#f00" stroke-width="0.2"/>`)
  );
  parts.holes.forEach((c) =>
    lines.push(`<g transform="translate(0,${dy})"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#f00" stroke-width="0.2"/></g>`)
  );
  lines.push('</g>');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="${x0} -6 ${w.toFixed(1)} ${H.toFixed(1)}">
<title>${model.baseName}</title>
${lines.join('\n')}
</svg>`;
}
