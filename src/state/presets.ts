import { DEFAULTS } from '../fender/defaults';
import type { FenderConfig } from '../fender/types';

/** PLAN §5's six presets, each a `Partial<FenderConfig>` merged over `DEFAULTS`. */
export interface Preset {
  id: string;
  name: string;
  /** Short mono spec line for the preset card. */
  spec: string;
  config: FenderConfig;
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
    'Rear · 700c · 35 mm tyre · 40°/175° · 20 flaps · 2 struts',
    {}
  ),

  preset(
    'front-700c',
    'Front commuter 700c',
    'Front · 700c · 35 mm tyre · 120°/140° · 20 flaps · 2 struts',
    {
      side: 'front',
      wheel: '700c',
      tyre: 35,
      crown: 55,
      lead: 120,
      trail: 140,
      flaps: 20,
      struts: 2,
      mudflap: 60
    }
  ),

  preset('gravel-650b', 'Gravel 650b', 'Rear · 650b · 50 mm tyre · hemmed skirt · 22 flaps', {
    side: 'rear',
    wheel: '650b',
    tyre: 50,
    clear: 18,
    crown: 72,
    skirt: 32,
    flaps: 22,
    hem: true
  }),

  preset('mtb-26in', 'MTB 26″', 'Rear · 26in · 55 mm tyre · 78 mm crown · 18 flaps', {
    side: 'rear',
    wheel: '26in',
    tyre: 55,
    clear: 20,
    crown: 78,
    flaps: 18
  }),

  // The design file's original defaults — see PLAN §9.5. Values match the
  // `cargo-20in-single` case in src/fender/__tests__/golden.json field for field;
  // presets.test.ts asserts that deep-equality directly against the fixture.
  preset(
    'cargo-20in',
    'Cargo / folder 20″',
    'Rear · 20in · 50 mm tyre · 3 struts · single-sheet blank',
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
      trail: 200,
      taper: 25,
      taperAt: 70,
      flaps: 16,
      struts: 3,
      strutLen: 220,
      mudflap: 90,
      join: 'zip',
      stock: 'single',
      tongue: true,
      fuse: false,
      nest: false,
      hem: false
    }
  ),

  preset(
    'hole-free-minimal',
    'Hole-free minimal',
    'No rivets or zip-ties · 1 strut · slotted tongue mount',
    {
      join: 'none',
      struts: 1,
      tongue: true,
      mudflap: 0
    }
  )
];
