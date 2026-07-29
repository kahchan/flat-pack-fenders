import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../fender/defaults';
import { PRESETS } from '../../state/presets';
import { presetMatchesConfig } from '../presetMatch';

describe('presetMatchesConfig', () => {
  it('matches "Rear commuter 700c" against fresh DEFAULTS — it IS the fresh-load state', () => {
    const preset = PRESETS.find((p) => p.id === 'rear-700c')!;
    expect(presetMatchesConfig(preset, DEFAULTS)).toBe(true);
  });

  it('does not match a config that differs by a single field', () => {
    const preset = PRESETS.find((p) => p.id === 'rear-700c')!;
    expect(presetMatchesConfig(preset, { ...DEFAULTS, crown: 999 })).toBe(false);
  });

  it('every preset matches itself', () => {
    for (const preset of PRESETS) {
      expect(presetMatchesConfig(preset, preset.config)).toBe(true);
    }
  });

  it('no two distinct presets match each other’s config', () => {
    for (const a of PRESETS) {
      for (const b of PRESETS) {
        if (a.id === b.id) continue;
        expect(presetMatchesConfig(a, b.config)).toBe(false);
      }
    }
  });
});
