import { LAP, PARAM_SPECS, PW, f0, f1 } from '../fender/defaults';
import type { ConfigKey, FenderConfig, Geometry, NumericSpec, PartsModel } from '../fender/types';

/**
 * Text and slider-bound generation for the control rail — the bits of the design
 * source's `groups`/hint strings (fender.html:1034-1071) that mix live geometry into
 * copy. Kept out of the components so the decisions in here (which number goes in which
 * sentence) are unit-testable without a DOM.
 */

export interface SliderItem {
  key: ConfigKey;
  label: string;
  display: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

export interface SliderGroup {
  title: string;
  items: SliderItem[];
}

function numeric(key: ConfigKey): NumericSpec {
  const spec = PARAM_SPECS[key];
  if (spec.kind !== 'number') throw new Error(`${key} is not a numeric param`);
  return spec;
}

const item = (
  key: ConfigKey,
  label: string,
  display: string,
  hint: string
): SliderItem => {
  const { min, max, step } = numeric(key);
  return { key, label, display, hint, min, max, step };
};

/**
 * WP22 §22.2: essentials/fine-tuning split, replacing the five flat groups. Essentials
 * are the four sliders that decide whether the fender fits the bike (side/wheel are
 * selectors, not sliders, and stay in their own rail components) — always visible, no
 * disclosure. Everything else lives behind one "Fine tuning" disclosure, grouped into
 * labelled clusters that are headings, not a second layer of collapsibles.
 */
export function buildEssentialSliders(s: FenderConfig, g: Geometry): SliderItem[] {
  return [
    item('tyre', 'Tyre width', `${s.tyre} mm`, `Estimated tyre radius ${f0(g.tyreRcalc)} mm`),
    item(
      'measuredR',
      'Measured tyre radius',
      s.measuredR > 0 ? `${s.measuredR} mm` : 'estimate',
      'Overrides the BSD estimate. 0 = use the estimate'
    ),
    item('clear', 'Clearance from tyre', `${s.clear} mm`, 'Gap between tyre and fender inner face')
  ];
}

/** Fine-tuning slider clusters (§22.2's table, sliders only — Construction and Struts &
 * mudflap also carry selector/toggle components that ControlRail composes alongside
 * these, and Options has no sliders at all so it isn't represented here). */
export function buildFineTuningClusters(
  s: FenderConfig,
  g: Geometry,
  finished: number
): SliderGroup[] {
  return [
    {
      title: 'Shape',
      items: [
        item(
          'crown',
          'Crown width',
          `${s.crown} mm`,
          `Flat panel over the tyre, finished ${f0(finished)} mm`
        ),
        item(
          'skirt',
          'Skirt length',
          `${s.skirt} mm`,
          `Drops ${f0(g.drop)} mm, adds ${f0(g.proj)} mm width each side, ${f1(g.lap)} mm lap`
        ),
        item(
          'angle',
          'Skirt angle',
          `${s.angle}°`,
          `From the crown plane. Steeper = deeper, narrower, more lap (${f1(g.lap)} mm now)`
        ),
        item(
          'taper',
          'Tail taper',
          `${s.taper}%`,
          `Tail narrows to ${f0(g.crownTail)} mm: clears the frame at the mount`
        ),
        item(
          'taperAt',
          'Taper starts at',
          `${s.taperAt}%`,
          `Full width until ${f0(g.knee)} mm along the arc`
        )
      ]
    },
    {
      title: 'Coverage',
      items: [
        item('lead', 'Lead (ahead of the axle)', `${s.lead}°`, 'Front fenders want more here'),
        item(
          'trail',
          'Trail (behind the axle)',
          `${s.trail}°`,
          `Total ${f0(g.cov)}°, ${f0(g.L)} mm of arc`
        )
      ]
    },
    {
      title: 'Construction',
      items: [
        item(
          'flaps',
          'Flap count',
          `× ${s.flaps}`,
          `${f0(g.pitch)} mm pitch, ${f1(g.lap)} mm lap. More flaps = smoother curve, less lap to fasten through.`
        ),
        item(
          'thick',
          'Material thickness',
          `${f1(s.thick)} mm`,
          `Bend allowance ${g.bendComp >= 0 ? '+' : ''}${f1(g.bendComp)} mm per fold, darts widened by ${f1(s.thick)} mm`
        )
      ]
    },
    {
      title: 'Struts & mudflap',
      items: [
        item(
          'struts',
          'Strut count',
          `× ${s.struts}`,
          'Evenly spaced along the arc, fastened at the skirt edge'
        ),
        item('strutLen', 'Strut length', `${s.strutLen} mm`, 'Flat strip, bend 26 mm from each end'),
        item(
          'mudflap',
          'Mudflap length',
          s.mudflap > 0 ? `${s.mudflap} mm` : 'none',
          'Separate bolt-on part: replace it without recutting the fender'
        )
      ]
    }
  ];
}

/** The "Hemmed skirt edge" toggle's note. Source line 1038. */
export function hemHint(s: FenderConfig): string {
  return s.thick > 0
    ? `Folds ${f0(2 * s.thick + 4)} mm back on itself: stiffer, no sharp edge`
    : 'Set a material thickness first';
}

/** The two Stock option notes. Source lines 1027-1029. WP19 §19.1: `PANEL_L`/`OVERLAP`
 * collapse into `LAP` — one printed tile is one panel, so the panel count is the same
 * `PW - LAP` tile-window arithmetic `tiling.ts` uses. */
export function stockNotes(g: Geometry): { single: string; a4: string } {
  return {
    single: `${f0(g.L)} × ${f0(g.Wd)} mm in one piece`,
    a4: `${Math.max(1, Math.ceil(g.L / (PW - LAP)))} panels, ${LAP} mm laps`
  };
}

/** Sheet B's size summary line. Source line 1094. */
export function partsSizeLabel(s: FenderConfig, parts: PartsModel): string {
  const flap = s.mudflap > 0 ? ', 1 mudflap' : '';
  const extra = parts.extraCount ? `, ${parts.extraCount} ${parts.extraLabel.toLowerCase()}s` : '';
  return `${s.struts} struts${flap}${extra}`;
}

/** Whether Sheet B prints 1:1 on A4. Source line 1095. */
export function partsFitNote(parts: PartsModel): string {
  return parts.fitsA4 ? 'fits A4 at full size' : 'wider than A4: cut struts by measurement';
}
