import { PW, WHEELS, f0, f1 } from './defaults';
import { buildCrossSection } from './crossSection';
import { geo } from './geometry';
import { buildParts } from './parts';
import { buildBlank } from './pattern';
import { buildPrintLayout } from './printLayout';
import { buildTiling } from './tiling';
import type { BlankModel, FenderConfig, Geometry, PrintLayout, SpecRow, TilingModel, XsecModel } from './types';

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
  tiling: TilingModel = buildTiling(s, g, blank),
  printLayout: PrintLayout = buildPrintLayout(tiling, buildParts(s, g))
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
      // WP23 §23.2 — the dart is a plain slit now (`notch` is always 0); the surplus
      // it used to remove is left in as this shingled overlap instead.
      label: 'Lap width',
      value: `${f1(g.lap)} mm`,
      note: s.thick > 0 ? `incl. ${f1(s.thick)} mm thickness clearance` : 'at the free edge, tapering to 0 at the fold'
    },
    {
      label: 'Bend allowance',
      value: `${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm`,
      note: s.thick > 0 ? `per fold, setback ${f1(g.setback)}, arc ${f1(g.BA)}` : 'zero-thickness model'
    },
    {
      label: 'Total take-up',
      value: `${f1(g.removal)} mm`,
      note: 'taken up as lap by all darts, one side'
    },
    // WP20 §20.1 (decision B2) — nesting is removed outright, so the nested-pair branch
    // this note used to carry goes with it.
    {
      label: 'Blank area',
      value: `${f1((g.L * g.Wd) / 1e6)} m²`,
      note: 'before darts are cut'
    },
    {
      label: 'Material panels',
      value: panelCount === 1 ? 'one sheet' : `× ${panelCount}`,
      note:
        panelCount === 1
          ? `needs ${f0(g.L)} mm of stock`
          : // WP19 §19.1: every panel is one PW-wide tile window (only the last is
            // shorter, since it only runs to the end of the blank).
            `each up to ${PW} × ${f0(g.Wd)} mm incl. lap`
    },
    // WP20 §20.2 — `printLayout.pageCount` is the single source for "how many sheets to
    // print"; `TilingModel.sheetCount` (rows × cols + 2, a nominal tile/piece count that
    // could disagree with the real print job) is gone.
    {
      label: 'Sheets to print',
      value: `${printLayout.pageCount}`,
      note: `${tiling.cols} × ${tiling.rows} tiles + parts + instructions`
    }
  ];
}

/**
 * e.g. "Rear, 700c / 29″ / 622, 215° (40/175), 85 mm wide, 20 flaps, 2 struts". Source
 * line ~1092.
 *
 * PLAN FEEDBACK WP17 (decision A3) — the list separator between distinct facts is now a
 * comma, not `·`. The wheel label's own `/` (700c / 29″ / 622, settled by WP16 §16.4) is
 * untouched: it separates alternate names for the SAME fact, not different facts, so
 * mixing it with the outer comma reads fine rather than ambiguous.
 */
export function assembledLabel(
  s: FenderConfig,
  g: Geometry = geo(s),
  xsec: XsecModel = buildCrossSection(s, g)
): string {
  return `${s.side === 'front' ? 'Front' : 'Rear'}, ${WHEELS[s.wheel].label}, ${f0(g.cov)}° (${s.lead}/${s.trail}), ${f0(xsec.finished)} mm wide, ${g.n} flaps, ${s.struts} struts${s.mudflap > 0 ? `, ${f0(s.mudflap)} mm flap` : ''}`;
}

/** One-line spec printed on the instruction sheet. Source line ~1110. */
export function printSpecLine(s: FenderConfig, g: Geometry = geo(s)): string {
  return `${WHEELS[s.wheel].label}, tyre ${s.tyre} (R ${f0(g.tyreR)}), crown ${s.crown} → ${f0(g.crownTail)}, skirt ${s.skirt} @ ${s.angle}°, clearance ${s.clear}, ${s.lead}°/${s.trail}°, ${g.n} flaps, ${s.struts} struts, mudflap ${s.mudflap}`;
}
