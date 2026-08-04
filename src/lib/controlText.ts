import { LAP, MEASURED_R_MIN, PARAM_SPECS, PW, f0, f1 } from '../fender/defaults';
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
  /**
   * WP24 §24.2/§24.4: the number a slider drag OR an in-place typed edit should start
   * from and clamp within `[min, max]` — usually `config[key]`, but overridden where the
   * displayed number isn't the stored one: the angle item shows `g.angleEff` (D4 — the
   * floor-held value), and the radius item shows the BSD estimate while `measuredR` is
   * still 0. Committing a typed edit always writes back through `key`, never through
   * whatever produced this seed, so `config.angle` is never overwritten with `angleEff`.
   */
  editValue: number;
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
  s: FenderConfig,
  key: ConfigKey,
  label: string,
  display: string,
  hint: string
): SliderItem => {
  const { min, max, step } = numeric(key);
  return { key, label, display, hint, min, max, step, editValue: s[key] as number };
};

/**
 * The skirt-angle slider, whose `min` is derived rather than fixed (WP30 §30.2). Split
 * out because it is the only slider whose bound depends on other fields, and burying
 * that in the cluster list would hide it.
 */
function angleItem(s: FenderConfig, g: Geometry): SliderItem {
  // The value shown is the angle actually built at. It differs from `s.angle` only when
  // the config carries a value below the current floor — from a shared link, or from
  // shallowing the skirt after setting it — and per decision D4 that set value is kept,
  // not overwritten, so deepening the skirt again brings it back.
  const held = Math.abs(g.angleEff - s.angle) > 1e-9;
  const base = item(
    s,
    'angle',
    'Skirt angle',
    `${f0(g.angleEff)}°`,
    `From the crown plane. Steeper = deeper, narrower, more lap (${f1(g.lap)} mm now)`
  );
  // WP24 §24.4: the field is edited (and its slider dragged) from the angle actually
  // built at, never from the possibly-lower stored `s.angle` — otherwise starting an
  // edit while held at the floor would silently re-commit the floor value over the
  // user's real setting the moment they touch the field without changing it.
  const withEditValue = { ...base, editValue: g.angleEff };
  if (g.angleMin === null) {
    return {
      ...withEditValue,
      hint: `From the crown plane. At ${g.n} sections no angle leaves a fastenable lap — reduce sections or deepen the skirt`
    };
  }
  const floor = Math.ceil(g.angleMin);
  return {
    ...withEditValue,
    min: Math.max(withEditValue.min, floor),
    hint: held
      ? `Held at ${floor}° so there is still a shingle to fasten at ${g.n} sections. Your ${s.angle}° returns if you deepen the skirt`
      : `From the crown plane. Steeper = deeper, narrower, more lap (${f1(g.lap)} mm now). ` +
        `Below ${floor}° there is no shingle to fasten at ${g.n} sections`
  };
}

/**
 * The measured-radius slider, whose `min` is the real-world floor `MEASURED_R_MIN`
 * rather than `PARAM_SPECS`' wire-format 0 (WP24 §24.1, decision C7). "Estimate" —
 * `measuredR === 0` — is an explicit state, not a value on the same numeric line: the
 * slider and any typed edit start from the current BSD estimate instead, so leaving
 * estimate seeds a real radius rather than jumping to 150.
 */
function measuredRItem(s: FenderConfig, g: Geometry): SliderItem {
  const isEstimate = s.measuredR === 0;
  const base = item(
    s,
    'measuredR',
    'Measured tyre radius',
    isEstimate ? 'estimate' : `${s.measuredR} mm`,
    'Overrides the BSD estimate.'
  );
  return {
    ...base,
    min: MEASURED_R_MIN,
    editValue: isEstimate ? Math.round(g.tyreRcalc) : s.measuredR
  };
}

/**
 * WP22 §22.2: essentials/fine-tuning split, replacing the five flat groups. Essentials
 * are the four sliders that decide whether the fender fits the bike (side/wheel are
 * selectors, not sliders, and stay in their own rail components) — always visible, no
 * disclosure. Everything else lives behind one "Fine tuning" disclosure, grouped into
 * labelled clusters that are headings, not a second layer of collapsibles.
 */
export function buildEssentialSliders(s: FenderConfig, g: Geometry): SliderItem[] {
  return [
    item(s, 'tyre', 'Tyre width', `${s.tyre} mm`, `Estimated tyre radius ${f0(g.tyreRcalc)} mm`),
    measuredRItem(s, g),
    item(s, 'clear', 'Clearance from tyre', `${s.clear} mm`, 'Gap between tyre and fender inner face')
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
          s,
          'crown',
          'Crown width',
          `${s.crown} mm`,
          `Flat panel over the tyre, finished ${f0(finished)} mm`
        ),
        item(
          s,
          'skirt',
          'Skirt length',
          `${s.skirt} mm`,
          `Drops ${f0(g.drop)} mm, adds ${f0(g.proj)} mm width each side, ${f1(g.lap)} mm lap`
        ),
        // WP30 §30.2 (decision D3): the floor is derived, not the fixed 20° in
        // PARAM_SPECS — below it the fender is flat enough to leave no shingle for any
        // join to fasten, and where that lands depends on skirt depth and flap count. It
        // moves when they move, so the hint has to say why rather than leave a minimum
        // shifting silently. `null` (§30.3) means no angle can get there at this flap
        // count: the static floor stands and the lever named is sections, not angle.
        angleItem(s, g),
        item(
          s,
          'taper',
          'Tail taper',
          `${s.taper}%`,
          `Tail narrows to ${f0(g.crownTail)} mm: clears the frame at the mount`
        ),
        item(
          s,
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
        item(s, 'lead', 'Lead (ahead of the axle)', `${s.lead}°`, 'Front fenders want more here'),
        item(
          s,
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
          s,
          'flaps',
          'Flap count',
          `× ${s.flaps}`,
          `${f0(g.pitch)} mm pitch, ${f1(g.lap)} mm lap. More flaps = smoother curve, less lap to fasten through.`
        ),
        item(
          s,
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
          s,
          'struts',
          'Strut count',
          `× ${s.struts}`,
          'Evenly spaced along the arc, fastened at the skirt edge'
        ),
        item(s, 'strutLen', 'Strut length', `${s.strutLen} mm`, 'Flat strip, bend 26 mm from each end'),
        item(
          s,
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

/** Digits after the decimal point in a step, e.g. `0.1` → 1, `5` → 0. Mirrors
 * `urlCodec.ts`'s own copy — kept separate rather than shared since the two operate on
 * different shapes (`SliderItem` here, `NumericSpec` there) and the URL codec is a wire
 * concern this control-layer module otherwise has no reason to import. */
function stepDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Clamp a typed edit to the item's LIVE bounds (`item.min`/`item.max` — already the
 * derived angle floor or the 150 mm radius floor, not the static `PARAM_SPECS` value —
 * WP24 §24.4) and snap it to the slider's own step grid, the same grid a drag walks.
 * Returns `null` for unparsable input so the caller can revert instead of committing.
 */
export function clampSliderEdit(item: SliderItem, raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw.trim() === '') return null;
  const steps = Math.round((n - item.min) / item.step);
  const snapped = item.min + steps * item.step;
  const clamped = Math.min(item.max, Math.max(item.min, snapped));
  const p = 10 ** stepDecimals(item.step);
  return Math.round(clamped * p) / p;
}
