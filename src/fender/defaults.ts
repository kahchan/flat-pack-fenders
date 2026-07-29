import type { ConfigKey, FenderConfig, ParamSpec, Side, WheelKey, WheelSpec } from './types';

export const WHEELS: Record<WheelKey, WheelSpec> = {
  '700c': { bsd: 622, label: '700c · 622' },
  '650b': { bsd: 584, label: '650b · 584' },
  '26in': { bsd: 559, label: '26" · 559' },
  '20in': { bsd: 406, label: '20" · 406' }
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
 * Lead/trail coverage per side (PLAN §13.1 / §9.16) — the single source `DEFAULTS`,
 * `PRESETS` and the rail's Side selector (`src/lib/sideDefaults.ts`) all read, so the
 * three cannot drift apart again the way they did once. Rear sums to exactly 220°, the
 * "coverage exceeds frame" threshold — deliberately on the line, not over it, so a
 * fresh rear fender does not trip that warning on its own.
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
 * The original values ship intact as the "Cargo / folder 20in" preset.
 *
 * `lead`/`trail` come from `COVERAGE.rear` (PLAN §13.1) rather than their own literals,
 * so this, the preset cards and the Side selector cannot drift apart again.
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
  lead: COVERAGE.rear.lead,
  trail: COVERAGE.rear.trail,
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
