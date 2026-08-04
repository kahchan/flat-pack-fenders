import { COVERAGE, DEFAULTS } from '../fender/defaults';
import type { FenderConfig } from '../fender/types';

/**
 * PLAN §5's presets, each a `Partial<FenderConfig>` merged over `DEFAULTS`. Nine as of
 * WP26: the original seven (six plus `front-gravel-650b`, added so the Front group in
 * `PresetStrip` was not a single card against Rear's five, PLAN FEEDBACK WP18) plus
 * `front-mtb-26in` and `front-cargo-20in`, which even up Front/Rear to 4/4.
 */
export interface Preset {
  id: string;
  name: string;
  /** Short mono spec line for the preset card. */
  spec: string;
  config: FenderConfig;
  /**
   * WP26: `config.side` always resolves to a concrete value (it's a required field, so
   * `hole-free-minimal` inherits `DEFAULTS.side === 'rear'`), which is not the same as
   * belonging to the Rear wheel group — it's a construction profile, not a wheel profile
   * (FEEDBACK-3-PLAN.md:492). `PresetSelect` keeps anything flagged here out of both
   * Front/Rear `<optgroup>`s so those read the wheel-preset counts, not the raw side field.
   */
  ungrouped?: boolean;
}

const preset = (
  id: string,
  name: string,
  spec: string,
  overrides: Partial<FenderConfig>
): Preset => ({ id, name, spec, config: { ...DEFAULTS, ...overrides } });

/**
 * `lead`/`trail` pairs below read as the `X/Y°` notation from PLAN §5 — the same
 * `${s.lead}/${s.trail}` pairing `assembledLabel` prints (specs.ts:95). A singular
 * "flap N" in that table means `mudflap`; plural "flaps N" means the flap count.
 */
export const PRESETS: Preset[] = [
  // Deliberately identical to DEFAULTS: this preset IS the app's fresh-load state, so
  // clicking it returns you to what you first saw. An earlier draft of PLAN §5 gave it
  // 55°/200° — but that is 255° of coverage, which trips the very warning §9.5 chose the
  // default to avoid, and a preset that silently differs from the state sharing its name
  // is a trap. See PLAN §5.
  preset(
    'rear-700c',
    'Rear commuter 700c',
    `Rear, 700c, 35 mm tyre, ${COVERAGE.rear.lead}°/${COVERAGE.rear.trail}°, 20 flaps, 2 struts`,
    {}
  ),

  preset(
    'front-700c',
    'Front commuter 700c',
    `Front, 700c, 35 mm tyre, ${COVERAGE.front.lead}°/${COVERAGE.front.trail}°, 20 flaps, 2 struts`,
    {
      side: 'front',
      wheel: '700c',
      tyre: 35,
      crown: 55,
      lead: COVERAGE.front.lead,
      trail: COVERAGE.front.trail,
      flaps: 20,
      struts: 2,
      mudflap: 60
    }
  ),

  preset('gravel-650b', 'Gravel 650b', 'Rear, 650b, 50 mm tyre, hemmed skirt, 22 flaps', {
    side: 'rear',
    wheel: '650b',
    tyre: 50,
    clear: 18,
    crown: 72,
    skirt: 32,
    flaps: 22,
    hem: true
  }),

  preset('mtb-26in', 'MTB 26″', 'Rear, 26in, 55 mm tyre, 78 mm crown, 18 flaps', {
    side: 'rear',
    wheel: '26in',
    tyre: 55,
    clear: 20,
    crown: 78,
    flaps: 18
  }),

  preset(
    'front-gravel-650b',
    'Front gravel 650b',
    'Front, 650b, 50 mm tyre, hemmed skirt, 22 flaps',
    {
      side: 'front',
      wheel: '650b',
      tyre: 50,
      clear: 18,
      crown: 72,
      skirt: 32,
      flaps: 22,
      hem: true,
      lead: COVERAGE.front.lead,
      trail: COVERAGE.front.trail,
      mudflap: 60
    }
  ),

  // NOT the design file's original defaults (PLAN FEEDBACK WP18). Those values —
  // 260° coverage, a tail narrower than the tyre, 1221 mm of stock in one piece and
  // struts 24 mm longer than the real mount distance — trip four warnings, which is
  // the same wall-of-red problem DEFAULTS was rewritten to avoid (see DEFAULTS'
  // comment), just recreated under a different preset. A preset that ships broken
  // teaches people to ignore the warning banner.
  //
  // This keeps the wheel and the intent — a short-wheel cargo/folding fender with a
  // wide crown for panniers and a low taper so the tail still clears a 50 mm tyre —
  // and fixes the four numbers that tripped: coverage 60/140 (200°, was 60/200 = 260°),
  // taper down to 5% (was 25%, crownTail was 46.5 mm against a 56 mm floor), stock 'a4'
  // (was 'single', at 939 mm this still fits one piece but a 4-panel cargo fender is
  // easier to print and post than one 1221 mm roll), and strutLen 200 mm (was 220,
  // against a ~196 mm real mount distance).
  //
  // The original values are not lost: they are pinned as the `cargo-20in-single` case
  // in src/fender/__tests__/golden.json, checked directly against that literal in
  // presets.test.ts rather than against this preset, so the historical record no
  // longer constrains what ships.
  preset(
    'cargo-20in',
    'Cargo / folder 20″',
    'Rear, 20in, 50 mm tyre, 3 struts, A4 panels',
    {
      side: 'rear',
      wheel: '20in',
      tyre: 50,
      measuredR: 0,
      clear: 16,
      crown: 62,
      skirt: 30,
      angle: 55,
      thick: 0.8,
      lead: 60,
      trail: 140,
      taper: 5,
      taperAt: 70,
      flaps: 16,
      struts: 3,
      strutLen: 200,
      mudflap: 90,
      // WP23 §23.3 — cinch clears every preset's shipped flap count with headroom.
      join: 'cinch',
      stock: 'a4',
      tongue: true,
      fuse: false,
      nest: false,
      hem: false
    }
  ),

  // WP26 — front-side sibling of `mtb-26in`: same wheel/tyre/crown/flap count, retargeted
  // to front coverage with a mudflap (front presets carry one; rear MTB doesn't). Join is
  // left unset so it inherits `DEFAULTS`' `cinch` — 3.6 mm of lap here, which is the only
  // join that fits below `rivet`'s 7 mm floor.
  preset(
    'front-mtb-26in',
    'Front MTB 26″',
    'Front, 26in, 55 mm tyre, 78 mm crown, 18 flaps',
    {
      side: 'front',
      wheel: '26in',
      tyre: 55,
      clear: 20,
      crown: 78,
      flaps: 18,
      lead: COVERAGE.front.lead,
      trail: COVERAGE.front.trail,
      mudflap: 60
    }
  ),

  // WP26 — front-side sibling of `cargo-20in`: same wheel and stock, retargeted to front
  // coverage. `cargo-20in` carries `join: 'cinch'` (not the `zip` its own comment predates);
  // this preset leaves `join` unset so it inherits that same `cinch` from `DEFAULTS` rather
  // than risking a stale re-specification. 4.7 mm of lap here — `cinch` fits, `zip`/`slot`
  // (11 mm) would not.
  preset(
    'front-cargo-20in',
    'Front cargo / folder 20″',
    'Front, 20in, 50 mm tyre, 3 struts, A4 panels',
    {
      side: 'front',
      wheel: '20in',
      tyre: 50,
      measuredR: 0,
      clear: 16,
      crown: 62,
      skirt: 30,
      angle: 55,
      thick: 0.8,
      lead: COVERAGE.front.lead,
      trail: COVERAGE.front.trail,
      taper: 5,
      taperAt: 70,
      flaps: 16,
      struts: 3,
      strutLen: 200,
      mudflap: 90,
      stock: 'a4',
      tongue: true,
      fuse: false,
      nest: false,
      hem: false
    }
  ),

  {
    ...preset(
      'hole-free-minimal',
      'Hole-free minimal',
      'No rivets or zip-ties, 1 strut, slotted tongue mount',
      {
        join: 'none',
        struts: 1,
        tongue: true,
        mudflap: 0
      }
    ),
    ungrouped: true
  }
];
