import { describe, expect, it } from 'vitest';
import golden from '../../fender/__tests__/golden.json';
import { buildModel } from '../../fender/index';
import { PRESETS } from '../presets';
import { decodeConfig, encodeConfig } from '../urlCodec';
import type { FenderConfig, Geometry } from '../../fender/types';

describe('PRESETS', () => {
  it('has six presets with unique ids', () => {
    expect(PRESETS).toHaveLength(6);
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

  it('"Cargo / folder 20″" is exactly the design file\'s original defaults', () => {
    const cargo = PRESETS.find((p) => p.id === 'cargo-20in');
    expect(cargo).toBeDefined();
    const fixtureConfig = (golden as unknown as { 'cargo-20in-single': { config: FenderConfig } })[
      'cargo-20in-single'
    ].config;
    expect(cargo!.config).toEqual(fixtureConfig);
  });
});
