import { OVERLAP, WHEELS, f0, f1 } from './defaults';
import { buildCrossSection } from './crossSection';
import { geo } from './geometry';
import { buildBlank } from './pattern';
import { buildTiling } from './tiling';
import type { BlankModel, FenderConfig, Geometry, SpecRow, TilingModel, XsecModel } from './types';

/**
 * The 11-row spec table, plus the two summary one-liners (`assembledLabel`,
 * `printSpecLine`). Transcribed verbatim from source lines ~1092–1124.
 *
 * `assembledLabel` and `printSpecLine` live here rather than in a separate module: both
 * are short, WHEELS-keyed summary strings built from the same Geometry + XsecModel
 * inputs as the spec rows, so they share this file's imports and read as one family of
 * "describe this fender in one line" functions.
 */

export function buildSpecs(
  s: FenderConfig,
  g: Geometry = geo(s),
  blank: BlankModel = buildBlank(s, g),
  xsec: XsecModel = buildCrossSection(s, g),
  tiling: TilingModel = buildTiling(s, g, blank)
): SpecRow[] {
  const { panelCount } = blank;

  return [
    {
      label: 'Fender radius',
      value: `${f0(g.R)} mm`,
      note: s.measuredR > 0 ? 'measured tyre radius + clearance' : 'estimated tyre radius + clearance'
    },
    {
      label: 'Developed length',
      value: `${f0(g.L)} mm`,
      note: `R × ${f0(g.cov)}° in radians`
    },
    {
      label: 'Developed width',
      value: `${f0(g.Wd)} mm`,
      note: 'crown + 2 × skirt, at full width'
    },
    {
      label: 'Finished width',
      value: `${f0(xsec.finished)} mm`,
      note: `tail ${f0(g.crownTail + 2 * g.proj)} mm after taper`
    },
    {
      label: 'Flap pitch',
      value: `${f0(g.pitch)} mm`,
      note: `arc ÷ ${g.n} flaps`
    },
    {
      label: 'Dart width',
      value: `${f1(g.notch)} mm`,
      note: s.thick > 0 ? `incl. ${f1(s.thick)} mm thickness clearance` : 'at the free edge, tapering to 0 at the fold'
    },
    {
      label: 'Bend allowance',
      value: `${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm`,
      note: s.thick > 0 ? `per fold · setback ${f1(g.setback)}, arc ${f1(g.BA)}` : 'zero-thickness model'
    },
    {
      label: 'Total take-up',
      value: `${f1(g.removal)} mm`,
      note: 'removed by all darts, one side'
    },
    {
      label: 'Blank area',
      value: `${f1((g.L * g.Wd) / 1e6)} m²`,
      note: s.nest ? 'each · nested pair shares the stock width' : 'before darts are cut'
    },
    {
      label: 'Material panels',
      value: panelCount === 1 ? 'one sheet' : `× ${panelCount}`,
      note:
        panelCount === 1
          ? `needs ${f0(g.L)} mm of stock`
          : `each ≈ ${f0(g.L / panelCount + OVERLAP)} × ${f0(g.Wd)} mm incl. lap`
    },
    {
      label: 'Sheets to print',
      value: `${tiling.sheetCount}`,
      note: `${tiling.cols} × ${tiling.rows} tiles + parts + instructions`
    }
  ];
}

/** e.g. "Rear · 700c · 622 · 215° (40/175) · 85 mm wide · 20 flaps · 2 struts". Source line ~1092. */
export function assembledLabel(
  s: FenderConfig,
  g: Geometry = geo(s),
  xsec: XsecModel = buildCrossSection(s, g)
): string {
  return `${s.side === 'front' ? 'Front' : 'Rear'} · ${WHEELS[s.wheel].label} · ${f0(g.cov)}° (${s.lead}/${s.trail}) · ${f0(xsec.finished)} mm wide · ${g.n} flaps · ${s.struts} struts${s.mudflap > 0 ? ` · ${f0(s.mudflap)} mm flap` : ''}`;
}

/** One-line spec printed on the instruction sheet. Source line ~1110. */
export function printSpecLine(s: FenderConfig, g: Geometry = geo(s)): string {
  return `${WHEELS[s.wheel].label} · tyre ${s.tyre} (R ${f0(g.tyreR)}) · crown ${s.crown} → ${f0(g.crownTail)} · skirt ${s.skirt} @ ${s.angle}° · clearance ${s.clear} · ${s.lead}°/${s.trail}° · ${g.n} flaps · ${s.struts} struts · mudflap ${s.mudflap}`;
}
