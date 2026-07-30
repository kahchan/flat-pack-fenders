import type { ConfigKey, FenderConfig, ParamSpec, Side, WheelKey, WheelSpec } from './types';

/**
 * Labels are written dot-free already (PLAN FEEDBACK WP16 §16.4, decision A3): WP17
 * strips `·` from the rest of the app's prose, and a label written with one today
 * would only have to be revisited then. 700c gets its imperial name added too — 700c
 * and 29″ share the 622 mm bead seat, same rim under two different marketing names,
 * which is worth stating rather than assuming.
 */
export const WHEELS: Record<WheelKey, WheelSpec> = {
  '700c': { bsd: 622, label: '700c / 29″ / 622' },
  '650b': { bsd: 584, label: '650b / 584' },
  '26in': { bsd: 559, label: '26" / 559' },
  '20in': { bsd: 406, label: '20" / 406' }
};

export const D2 = Math.PI / 180;

/** Slotted mount tongue at the nose. */
export const TONGUE_L = 34;
export const TONGUE_W = 24;

/**
 * Chamfer length at the tongue-to-skirt corner, mm — see `FenderConfig.bevel`
 * (PLAN §13.3). Only applies when the tongue is on: without a tongue there is no
 * "tongue's edge" to bevel from, and the nose is already a plain flat edge, not a
 * sharp corner.
 */
export const BEVEL_L = 20;

/**
 * Lead/trail coverage per side (PLAN §13.1 / §9.16) — source of truth for `PRESETS`
 * only (PLAN FEEDBACK §16.5, decision A1). Rear sums to exactly 220°, the "coverage
 * exceeds frame" threshold — deliberately on the line, not over it, so a fresh rear
 * fender does not trip that warning on its own.
 *
 * `DEFAULTS` and the rail's Side selector (`src/lib/sideDefaults.ts`) used to read this
 * too, collapsed into one constant by WP13 specifically because the three had drifted
 * apart once (§9.16). A1 deliberately decouples those two again, trading that
 * protection for the freedom to tune the default and the quick-start side values
 * separately from the presets — both keep their own literal, equal to this today by
 * intent, not by reference. If you find three sets of coverage numbers, this is why:
 * it's the intended shape, not the bug §9.16 describes returning.
 */
export const COVERAGE: Record<Side, { lead: number; trail: number }> = {
  front: { lead: 55, trail: 120 },
  rear: { lead: 120, trail: 100 }
};

/** How far a panel is cut past its seam line to lap under the next one. */
export const OVERLAP = 20;

/** A4 landscape live area inside a 15 mm safe margin, and the tile overlap. */
export const PW = 267;
export const PH = 180;
export const OV = 12;

/**
 * Panel length, derived from the page rather than a bare literal (PLAN FEEDBACK WP15
 * §15.1). Panels were cut to a magic ~250 mm, then each cut a further `OVERLAP` mm past
 * its seam to form the lap — so a panel plus its lap could reach 270 mm against PW's
 * 267 mm of printable width. The lap could push a panel off the sheet.
 *
 * `PANEL_SAFETY` keeps the lap clear of the trim edge; `PANEL_L` is the longest a panel
 * can be while still leaving room for its own lap inside that safe width, so
 * `PANEL_L + OVERLAP ≤ PW` always holds by construction — see pattern.test.ts's
 * invariant test.
 */
export const PANEL_SAFETY = 4;
export const PANEL_L = PW - 2 * PANEL_SAFETY - OVERLAP;

/**
 * Vertical room reserved above each slot on a combined print page (PLAN FEEDBACK WP15
 * §15.3) for its own "Sheet A tile r·c" / "Sheet B page n" caption, so stacking two
 * slots on one page never runs one's content into the other's label.
 */
export const PRINT_CAPTION_H = 6;

/**
 * Live height available to Sheet B, which gives up 8 mm of PH to its title line.
 *
 * The design checked Sheet B against PW only and never against this, so a parts sheet
 * taller than 172 mm was silently scaled down to fit while the app reported "fits A4 at
 * full size". See PLAN §9.18.
 */
export const PARTS_PH = 172;

/** Strut strip width, and the fold inset from each end. */
export const STRUT_W = 14;
export const STRUT_FOLD_INSET = 26;

/**
 * "Rear commuter 700c".
 *
 * Deliberately NOT the design file's original default, which tripped five warnings on
 * first load (260° coverage, unmeasured radius, tail narrower than the tyre, 1221 mm of
 * stock in one piece, and Sheet B too wide for A4). Every one was correct, but arriving
 * to a wall of red teaches people to ignore the warnings.
 *
 * This config trips exactly one: "tyre radius is estimated — measure the real thing".
 * That one should fire. It is the largest single error in the whole pattern and it is
 * the one thing only the user can fix.
 *
 * The original values no longer ship as a preset (PLAN FEEDBACK WP18): they tripped
 * four of those warnings themselves, which is the same wall-of-red problem this default
 * exists to avoid. They are pinned instead as the `cargo-20in-single` case in
 * src/fender/__tests__/golden.json, the historical record `presets.test.ts` checks
 * directly rather than against the "Cargo / folder 20in" preset, which now ships a
 * working config under the same wheel and intent.
 *
 * `lead`/`trail` are this config's own literals, not a read of `COVERAGE.rear` (PLAN
 * FEEDBACK §16.5, decision A1 — see `COVERAGE`'s doc comment for why they were
 * decoupled). 120/100 is the same effective coverage `COVERAGE.rear` holds today, kept
 * identical on purpose so decoupling changes nothing behaviourally, but this default is
 * now free to diverge from the presets later without dragging them along.
 */
export const DEFAULTS: FenderConfig = {
  side: 'rear',
  wheel: '700c',
  tyre: 35,
  measuredR: 0,
  clear: 14,
  crown: 55,
  skirt: 26,
  angle: 55,
  thick: 0.8,
  lead: 120,
  trail: 100,
  taper: 15,
  taperAt: 70,
  flaps: 20,
  struts: 2,
  strutLen: 160,
  mudflap: 100,
  join: 'zip',
  stock: 'a4',
  tongue: true,
  fuse: false,
  nest: false,
  hem: false,
  bevel: BEVEL_L
};

/**
 * Bounds for every parameter. Drives the sliders AND clamps decoded URL hashes —
 * a hash is untrusted input and must never be able to produce NaN geometry.
 */
export const PARAM_SPECS: Record<ConfigKey, ParamSpec> = {
  side: { kind: 'enum', options: ['front', 'rear'] },
  wheel: { kind: 'enum', options: ['700c', '650b', '26in', '20in'] },
  tyre: { kind: 'number', min: 20, max: 90, step: 1, unit: 'mm' },
  measuredR: { kind: 'number', min: 0, max: 400, step: 1, unit: 'mm' },
  clear: { kind: 'number', min: 6, max: 40, step: 1, unit: 'mm' },
  crown: { kind: 'number', min: 30, max: 140, step: 1, unit: 'mm' },
  skirt: { kind: 'number', min: 0, max: 70, step: 1, unit: 'mm' },
  angle: { kind: 'number', min: 20, max: 85, step: 1, unit: 'deg' },
  thick: { kind: 'number', min: 0, max: 4, step: 0.1, unit: 'mm' },
  lead: { kind: 'number', min: 0, max: 160, step: 5, unit: 'deg' },
  trail: { kind: 'number', min: 0, max: 200, step: 5, unit: 'deg' },
  taper: { kind: 'number', min: 0, max: 60, step: 1, unit: '%' },
  taperAt: { kind: 'number', min: 30, max: 95, step: 1, unit: '%' },
  flaps: { kind: 'number', min: 4, max: 40, step: 1 },
  struts: { kind: 'number', min: 1, max: 6, step: 1 },
  strutLen: { kind: 'number', min: 80, max: 420, step: 10, unit: 'mm' },
  mudflap: { kind: 'number', min: 0, max: 220, step: 5, unit: 'mm' },
  join: { kind: 'enum', options: ['zip', 'rivet', 'slot', 'none'] },
  stock: { kind: 'enum', options: ['single', 'a4'] },
  tongue: { kind: 'boolean' },
  fuse: { kind: 'boolean' },
  nest: { kind: 'boolean' },
  hem: { kind: 'boolean' },
  bevel: { kind: 'number', min: 0, max: 40, step: 1, unit: 'mm' }
};

/** Field order for URL serialisation. Append-only — changing it breaks shared links. */
export const CONFIG_ORDER: readonly ConfigKey[] = [
  'side',
  'wheel',
  'tyre',
  'measuredR',
  'clear',
  'crown',
  'skirt',
  'angle',
  'thick',
  'lead',
  'trail',
  'taper',
  'taperAt',
  'flaps',
  'struts',
  'strutLen',
  'mudflap',
  'join',
  'stock',
  'tongue',
  'fuse',
  'nest',
  'hem',
  'bevel'
];

/** One decimal place, always. Matches the design source's f1(). */
export const f1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** Nearest integer as a string. Matches the design source's f0(). */
export const f0 = (n: number): string => String(Math.round(n));
