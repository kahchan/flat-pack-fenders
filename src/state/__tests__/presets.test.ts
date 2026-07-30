import { describe, expect, it } from 'vitest';
import golden from '../../fender/__tests__/golden.json';
import { BEVEL_L } from '../../fender/defaults';
import { buildModel } from '../../fender/index';
import { buildWarnings } from '../../fender/warnings';
import { PRESETS } from '../presets';
import { decodeConfig, encodeConfig } from '../urlCodec';
import type { FenderConfig, Geometry } from '../../fender/types';

describe('PRESETS', () => {
  it('has seven presets with unique ids', () => {
    expect(PRESETS).toHaveLength(7);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it('has unique display names', () => {
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  it.each(PRESETS.map((p) => [p.id, p] as const))(
    '"%s" produces finite geometry through buildModel()',
    (_id, preset) => {
      const model = buildModel(preset.config);
      for (const [key, value] of Object.entries(model.geo) as [keyof Geometry, number][]) {
        expect(Number.isFinite(value), `geo.${key} = ${value}`).toBe(true);
      }
    }
  );

  it.each(PRESETS.map((p) => [p.id, p] as const))(
    '"%s" round-trips through the URL codec',
    (_id, preset) => {
      const encoded = encodeConfig(preset.config);
      expect(decodeConfig(encoded)).toEqual(preset.config);
    }
  );

  // WP18: every preset must ship warning-free bar the one deliberate exception. Written
  // as a loop over PRESETS rather than one assertion per id, so it keeps working as
  // presets are added and, on failure, names the offending preset and its warnings
  // rather than leaving the next person to diff a bare array.
  it('produces no warnings other than radius-estimated', () => {
    const offenders = PRESETS.map((p) => ({
      id: p.id,
      ids: buildWarnings(p.config)
        .map((w) => w.id)
        .filter((id) => id !== 'radius-estimated')
    })).filter((o) => o.ids.length > 0);
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  // The design file's original defaults are no longer a shipped preset (WP18: they trip
  // four warnings, the "Cargo / folder 20in" card above is now a working retarget of the
  // same wheel and intent) — but they are still the historical record, so this pins them
  // directly against the fixture rather than against PRESETS, which no longer holds them.
  it('golden fixture "cargo-20in-single" still pins the design file\'s original defaults', () => {
    const fixtureConfig = (golden as unknown as { 'cargo-20in-single': { config: FenderConfig } })[
      'cargo-20in-single'
    ].config;
    expect(fixtureConfig).toEqual({
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
      hem: false,
      bevel: BEVEL_L
    });
  });
});
