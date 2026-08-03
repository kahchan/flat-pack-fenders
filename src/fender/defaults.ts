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

/** A4 landscape live area inside a 15 mm safe margin. */
export const PW = 267;
export const PH = 180;

/**
 * WP19 §19.1 / decision B1: one printed tile IS one material panel for `stock: 'a4'`, so
 * the tile's own overlap and the panel's fastening lap are the same physical band, not
 * two numbers that happen to overlap on the drawing. `OV` (tile registration overlap)
 * and the old `OVERLAP` (panel fastening lap) collapse into this one constant.
 *
 * Tile/panel step is `PW - LAP` (247 mm): each tile is `PW` wide, the next tile starts
 * `LAP` mm before the previous one ends, and that shared band is both where the paper
 * registers AND where the panel below laps under the one above. A panel (including
 * panel 1's tongue) can never exceed `PW`, because that's the width of the window it's
 * cut from — see `buildBlank`'s panel/seam derivation and pattern.test.ts's invariant.
 */
export const LAP = 20;

/**
 * `stock: 'single'` has no panels — the fender is one piece, however many A4 tiles it
 * takes to print. Those tiles still need a plain registration overlap so taped paper
 * lines up, but there's no fastening lap to make it do double duty, so it keeps its own
 * smaller number rather than inheriting `LAP`'s panel-sized band.
 */
export const OV = 12;

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
 * Strap-mounted strut end (PLAN FEEDBACK WP21 §21.1) — the frame end flares from the
 * plain `STRUT_W` strip to a paddle wide enough to carry two transverse slots for a
 * 25 mm hook-and-loop strap, which cannot thread through the strip itself.
 *
 * `STRUT_STRAP_TRANS_L` is the flare's own length; `STRUT_STRAP_PADDLE_L` is the flat
 * paddle length beyond it that actually holds the slots. Both eat into the strut's own
 * `strutLen`, rather than extending it — the paddle is a reshaping of the existing
 * frame end, not an added tab.
 */
export const STRUT_STRAP_W = 25;
export const STRUT_STRAP_TRANS_L = 20;
export const STRUT_STRAP_PADDLE_L = 24;
export const STRUT_STRAP_PADDLE_W = 32;
export const STRUT_STRAP_SLOT_L = 27;
export const STRUT_STRAP_SLOT_W = 3.5;
/** Centre-to-centre spacing between the two slots — the reason there are two: a strap
 * anchored through only one slot can still slide along the stay under braking. */
export const STRUT_STRAP_SLOT_GAP = 10;

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
  // WP23 §23.3 — every preset clears `cinch` at its shipped flap count with headroom
  // (the table in §23.3), but none clears `zip`/`slot` (both need 11 mm of lap; the
  // default has ~4.9 mm). `cinch` is the join the redesign is built around: real
  // overlap under a butt-seam-style tie, so it costs nothing to make the default fit.
  join: 'cinch',
  stock: 'a4',
  tongue: true,
  fuse: false,
  nest: false,
  hem: false,
  bevel: BEVEL_L,
  strutEnd: 'bolt'
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
  join: { kind: 'enum', options: ['none', 'cinch', 'rivet', 'zip', 'slot'] },
  stock: { kind: 'enum', options: ['single', 'a4'] },
  tongue: { kind: 'boolean' },
  fuse: { kind: 'boolean' },
  nest: { kind: 'boolean' },
  hem: { kind: 'boolean' },
  bevel: { kind: 'number', min: 0, max: 40, step: 1, unit: 'mm' },
  strutEnd: { kind: 'enum', options: ['bolt', 'strap'] }
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
  'bevel',
  'strutEnd'
];

/** One decimal place, always. Matches the design source's f1(). */
export const f1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** Nearest integer as a string. Matches the design source's f0(). */
export const f0 = (n: number): string => String(Math.round(n));
