/**
 * The contract. Every work package imports from here.
 *
 * Nothing in src/fender/ may import React or touch the DOM — buildModel() returns
 * plain data so the same model drives the screen, the print sheets, the exports and
 * the preset thumbnails. Labels are data, not elements.
 *
 * Units are millimetres throughout, angles in degrees at the config boundary and
 * radians inside Geometry. Where a field is a pre-formatted string it is named
 * *Label; where it is a number it is raw mm.
 */

// ── Configuration ────────────────────────────────────────────────────────────

export type Side = 'front' | 'rear';
export type WheelKey = '700c' | '650b' | '26in' | '20in';
export type JoinKey = 'zip' | 'rivet' | 'slot' | 'none';
export type StockKey = 'single' | 'a4';

/** The 24 parameters that fully determine a fender. Serialised to the URL in this order. */
export interface FenderConfig {
  side: Side;
  wheel: WheelKey;
  /** Tyre section width, mm. */
  tyre: number;
  /** Measured tyre outer radius, mm. 0 = derive from BSD + section width. */
  measuredR: number;
  /** Gap between tyre and fender inner face, mm. */
  clear: number;
  /** Flat crown width over the tyre, mm. */
  crown: number;
  /** Skirt length before bend allowance, mm. */
  skirt: number;
  /** Skirt angle from the crown plane, degrees. */
  angle: number;
  /** Material thickness, mm. 0 = ideal zero-thickness pattern. */
  thick: number;
  /** Coverage ahead of the axle, degrees. */
  lead: number;
  /** Coverage behind the axle, degrees. */
  trail: number;
  /** Tail narrowing, percent of crown width. */
  taper: number;
  /** Where the taper begins, percent along the arc. */
  taperAt: number;
  /** Number of flaps; darts = flaps - 1. */
  flaps: number;
  struts: number;
  strutLen: number;
  /** 0 = no mudflap. */
  mudflap: number;
  join: JoinKey;
  stock: StockKey;
  /** Slotted frame-mount tab at the nose. */
  tongue: boolean;
  /** Sacrificial (oversize) strut end hole. */
  fuse: boolean;
  /** Nest a second fender tail-to-nose. */
  nest: boolean;
  /** Fold the skirt edge back on itself. */
  hem: boolean;
  /** Chamfer length at the tongue-to-skirt corner, mm. 0 = square corner (off). */
  bevel: number;
}

export type ConfigKey = keyof FenderConfig;

export interface WheelSpec {
  bsd: number;
  label: string;
}

/** Slider bounds. Also the clamp used when decoding an untrusted URL hash. */
export interface NumericSpec {
  kind: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface EnumSpec<T extends string = string> {
  kind: 'enum';
  options: readonly T[];
}

export interface BooleanSpec {
  kind: 'boolean';
}

export type ParamSpec = NumericSpec | EnumSpec | BooleanSpec;

// ── Derived geometry ─────────────────────────────────────────────────────────

/**
 * Everything downstream of the config. Field names match the design source's geo()
 * exactly so the two can be diffed; see PLAN §7 for the golden values.
 */
export interface Geometry {
  bsd: number;
  /** Tyre radius estimated from BSD/2 + section width. */
  tyreRcalc: number;
  /** Tyre radius actually used — measured override if set, else tyreRcalc. */
  tyreR: number;
  /** Fender radius = tyreR + clearance. */
  R: number;
  /** Total coverage, degrees. */
  cov: number;
  /** Total coverage, radians. */
  th: number;
  /** Nose angle, radians (negative = ahead of the axle). */
  aNose: number;
  /** Developed length along the arc, mm. */
  L: number;
  /** Skirt angle, radians. */
  a: number;
  /** Skirt length in the FLAT pattern — includes bend allowance and hem. */
  skirt: number;
  /** Skirt length as folded, i.e. the config value. */
  skirtTrue: number;
  t: number;
  rBend: number;
  setback: number;
  /** Bend arc length along the neutral axis. */
  BA: number;
  /** Net bend compensation per fold. Negative — folds SHORTEN the flat pattern. */
  bendComp: number;
  hem: number;
  /** Horizontal projection added by one skirt, mm. */
  proj: number;
  /** Vertical drop of one skirt, mm. */
  drop: number;
  /** Crown width before the taper knee. */
  crown0: number;
  /** Crown width at the tail. */
  crownTail: number;
  /** Distance along the arc where the taper begins, mm. */
  knee: number;
  /** Developed width of the blank, mm. */
  Wd: number;
  /** Centreline, = Wd / 2. */
  yc: number;
  /** Flap count. */
  n: number;
  /** Arc distance between darts, mm. */
  pitch: number;
  /** Total material removed by all darts, one side, mm. */
  removal: number;
  /** Width of one dart at the free edge, mm. */
  notch: number;
}

// ── Drawing primitives ───────────────────────────────────────────────────────

/** An SVG path `d` string in millimetre user units. */
export type PathD = string;

export interface Path {
  d: PathD;
}

export interface Hole {
  cx: string;
  cy: string;
  r: number;
}

export interface Slot {
  x: string;
  y: string;
  w: number | string;
  h: number | string;
}

export interface TileRect {
  x: string;
  y: string;
  w: number;
  h: number;
}

export type TextAnchor = 'start' | 'middle' | 'end';

/** A label is data. Components turn it into <text>; the PDF writer turns it into Tj. */
export interface Label {
  x: number | string;
  y: number | string;
  size: number;
  text: string;
  fill?: string;
  anchor?: TextAnchor;
}

export interface FacetPath extends Path {
  fill: string;
}

export interface XsecPath extends Path {
  fill: string;
  stroke: string;
  sw: number;
  dash: string;
}

/** One printable A4 page covering part of the blank. */
export interface PrintTile {
  label: string;
  meta: string;
  viewBox: string;
  frame: PathD;
  ruler: PathD;
  rulerX: string;
  rulerY: string;
}

// ── Model sections ───────────────────────────────────────────────────────────

export interface BlankModel {
  outline: PathD;
  foldLines: Path[];
  scoreLines: Path[];
  holes: Hole[];
  slots: Slot[];
  seams: Path[];
  lapLines: Path[];
  /** Small arrow glyph at each lap (PLAN FEEDBACK WP15 §15.2), pointing the direction
   * water runs across the joint — downstream, from the panel on top onto the one
   * underneath. One entry per lap, same order as `lapLines`. */
  lapArrows: Path[];
  labels: Label[];
  /** Panels the blank is split into when stock is 'a4'. 1 = single sheet. */
  panelCount: number;
  /** Arc positions of the struts, as fractions of L. Consumed by the isometric view. */
  strutFrac: number[];
  viewBox: string;
  /** Bounding box of the drawn area including tongue and, when nesting, the pair. */
  bboxW: number;
  bboxH: number;
}

/**
 * One part (strut, mudflap, or hardware piece), positioned on a packed Sheet B page
 * (PLAN §12). Geometry (`outline`/`folds`/`holes`/`label`) is in LOCAL space — as if the
 * part sat unrotated at its own origin (0,0) — and the renderer wraps it in a single
 * `<g transform>` built from `x`/`y`/`rotated`/`w`/`h` (the part's natural, pre-rotation
 * size), so rotating that one group carries the label around with the part for free.
 */
export interface PackedPart {
  outline: Path;
  folds: Path[];
  holes: Hole[];
  label: Label;
  x: number;
  y: number;
  /** Natural (pre-rotation) width/height, INCLUDING the label row reserved below the
   * part's own geometry — this is the whole unit the packer placed and the transform
   * rotates, so it's also the real footprint to use for overlap/bounds checks. */
  w: number;
  h: number;
  rotated: boolean;
}

/** One PW × PARTS_PH page of Sheet B, packed by `packRects` (PLAN §12). */
export interface PartsPage {
  parts: PackedPart[];
  width: number;
  height: number;
}

export interface PartsModel {
  outlines: Path[];
  folds: Path[];
  holes: Hole[];
  slots: Slot[];
  labels: Label[];
  viewBox: string;
  width: number;
  height: number;
  /**
   * Whether Sheet B packs onto one PW × PARTS_PH page (PLAN §12) — no longer the
   * design's width-only, single-column check. `outlines`/`folds`/`holes`/`labels`/
   * `viewBox`/`width`/`height` above stay the old single continuous layout unchanged
   * (SVG/DXF export and the laser bed don't care about A4 pagination); `pages` is the
   * new packed layout the screen/print tree actually draws.
   */
  fitsA4: boolean;
  /** One entry per PW × PARTS_PH page needed to fit every part. */
  pages: PartsPage[];
  /** Longest side (mm) of each part that doesn't fit a PW × PARTS_PH page in EITHER
   * orientation — empty unless a strut is longer than the page in every rotation. This
   * is the only Sheet-B condition still worth a warning; needing more pages is not. */
  oversizedParts: number[];
  /** Count of butt straps / clips, 0 for joins that need none. */
  extraCount: number;
  extraLabel: string;
}

export interface IsoModel {
  facets: FacetPath[];
  edges: Path[];
  outline: Path[];
  wheel: Path[];
  seams: Path[];
  holes: Hole[];
  slots: Path[];
  struts: Path[];
  mudflap: Path[];
  viewBox: string;
  aspect: string;
}

export interface XsecModel {
  paths: XsecPath[];
  labels: Label[];
  viewBox: string;
  /** Finished outside width once the skirts are folded down, mm. */
  finished: number;
}

export interface TilingModel {
  cols: number;
  rows: number;
  /** rows × cols + Sheet B + instructions — a nominal tile/piece count (how many
   * distinct windows into the blank you'll trim and tape), not the number of physical
   * sheets of paper a print job actually consumes; see `PrintLayout.pageCount` for
   * that. */
  sheetCount: number;
  /** Real content height of the LAST tile row, mm — at most `PH`, often much less
   * (every earlier row is necessarily full). Drives `buildPrintLayout`'s packing
   * (PLAN FEEDBACK WP15 §15.3). */
  lastRowH: number;
  rects: TileRect[];
  tiles: PrintTile[];
  /** Transform placing the nested second blank, or null when nesting is off. */
  nestTransform: string | null;
}

// ── Print pagination (PLAN FEEDBACK WP15 §15.3) ─────────────────────────────

/** One Sheet-A tile or Sheet-B parts page, placed on a shared physical print page by
 * `buildPrintLayout`'s reuse of `packRects` (PLAN §12's packer). */
export interface PrintSlot {
  kind: 'sheetA' | 'sheetB';
  /** Index into `TilingModel.tiles` (sheetA) or `PartsModel.pages` (sheetB). */
  index: number;
  /** Vertical offset within the physical page, mm. */
  y: number;
  /** Real content height of this slot, mm — at most PH. */
  h: number;
}

/** One physical A4 page combining the shrunk last Sheet-A row with Sheet B, instead of
 * each claiming a whole page regardless of how little of it is used. */
export interface PrintPage {
  slots: PrintSlot[];
}

export interface PrintLayout {
  /** Tile indices printed one-per-page, unchanged — every row except the last, which
   * is packed onto `pages` below instead. */
  fullTileIndices: number[];
  /** Physical pages combining the last Sheet-A row with Sheet B's pages. */
  pages: PrintPage[];
  /** Real number of physical sheets the print job needs: full tiles + combined pages +
   * the instructions page. This is the number that drops under WP15 §15.3, unlike
   * `TilingModel.sheetCount`. */
  pageCount: number;
}

export interface Warning {
  /** Stable id so dismissal can key on identity rather than prose. */
  id: string;
  text: string;
}

export interface EngNote {
  title: string;
  body: string;
  formula: string;
}

export interface AssemblyStep {
  n: string;
  title: string;
  body: string;
}

export interface SpecRow {
  label: string;
  value: string;
  note: string;
}

/** The single output of buildModel(). Plain data — no React, no DOM. */
export interface DrawingModel {
  config: FenderConfig;
  geo: Geometry;
  blank: BlankModel;
  parts: PartsModel;
  iso: IsoModel;
  xsec: XsecModel;
  tiling: TilingModel;
  printLayout: PrintLayout;
  warnings: Warning[];
  notes: EngNote[];
  steps: AssemblyStep[];
  specs: SpecRow[];
  /** e.g. "Rear, 700c / 29″ / 622, 215° (40/175), 85 mm wide, 20 flaps, 2 struts". */
  assembledLabel: string;
  /** One-line spec printed on the instruction sheet. */
  printSpecLine: string;
  /** Filename stem for exports, e.g. "fender-rear-700c-1351x106mm". */
  baseName: string;
}
