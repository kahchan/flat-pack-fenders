import { describe, expect, it } from 'vitest';
import golden from '../../fender/__tests__/golden.json';
import { CONFIG_ORDER, DEFAULTS, PARAM_SPECS } from '../../fender/defaults';
import { buildModel } from '../../fender/index';
import { PRESETS } from '../presets';
import { decodeConfig, encodeConfig } from '../urlCodec';
import type { FenderConfig, Geometry } from '../../fender/types';

/**
 * No golden fixture for this package — PLAN §6 is new work, not a port (see the WP6
 * brief). So these tests carry the whole weight: round-trip fidelity for every real
 * config we have on hand, plus a hostile-input sweep whose only real assertion is
 * "produces finite geometry, never throws".
 */

type GoldenCase = { config: FenderConfig };
const GOLDEN_CONFIGS = Object.values(golden as unknown as Record<string, GoldenCase>).map(
  (c) => c.config
);

/** Every numeric field a config can drive `buildModel()` into producing. */
function assertFiniteGeometry(config: FenderConfig): void {
  const model = buildModel(config);
  for (const [key, value] of Object.entries(model.geo) as [keyof Geometry, number][]) {
    expect(Number.isFinite(value), `geo.${key} = ${value}`).toBe(true);
  }
  for (const h of model.blank.holes) {
    expect(Number.isFinite(+h.cx)).toBe(true);
    expect(Number.isFinite(+h.cy)).toBe(true);
    expect(Number.isFinite(h.r)).toBe(true);
  }
}

describe('encodeConfig / decodeConfig — round trip', () => {
  it.each(GOLDEN_CONFIGS.map((c, i) => [i, c] as const))(
    'round-trips golden config #%i losslessly',
    (_i, config) => {
      const encoded = encodeConfig(config);
      expect(decodeConfig(encoded)).toEqual(config);
    }
  );

  it.each(PRESETS.map((p) => [p.id, p.config] as const))(
    'round-trips preset "%s" losslessly',
    (_id, config) => {
      const encoded = encodeConfig(config);
      expect(decodeConfig(encoded)).toEqual(config);
    }
  );

  it('round-trips DEFAULTS to the shortest possible string', () => {
    const encoded = encodeConfig(DEFAULTS);
    expect(encoded).toBe('f1');
    expect(decodeConfig(encoded)).toEqual(DEFAULTS);
  });

  it('accepts a leading "#", matching location.hash', () => {
    const encoded = encodeConfig(DEFAULTS);
    expect(decodeConfig(`#${encoded}`)).toEqual(DEFAULTS);
  });

  it('trailing-default omission actually shortens the string', () => {
    // Only `side` differs from DEFAULTS — every field after it should be dropped.
    const config: FenderConfig = { ...DEFAULTS, side: 'front' };
    const encoded = encodeConfig(config);
    expect(encoded).toBe('f1.front');
    expect(encoded.split('.').length).toBeLessThan(CONFIG_ORDER.length + 1);
    expect(decodeConfig(encoded)).toEqual(config);
  });

  it('a change to the LAST field cannot be trimmed and round-trips in full', () => {
    // `bevel` (PLAN §13.3) is now the last CONFIG_ORDER field, appended after `hem`.
    const config: FenderConfig = { ...DEFAULTS, bevel: 0 };
    const encoded = encodeConfig(config);
    expect(encoded.split('.').length).toBe(CONFIG_ORDER.length + 1);
    expect(decodeConfig(encoded)).toEqual(config);
  });

  it('a change to the second-to-last field alone still trims the new last field (bevel)', () => {
    const config: FenderConfig = { ...DEFAULTS, hem: true };
    const encoded = encodeConfig(config);
    expect(encoded.split('.').length).toBe(CONFIG_ORDER.length); // trailing `bevel` dropped
    expect(decodeConfig(encoded)).toEqual(config);
  });

  // PLAN §13.3 constraint — bevel is appended, not inserted, so a hash saved before it
  // existed still decodes: the missing trailing token backfills to DEFAULTS.bevel.
  it('an old URL saved before `bevel` existed still decodes, backfilling it to the default', () => {
    // One token shorter than CONFIG_ORDER.length + 1 — as if bevel were never encoded.
    const oldStyleHash = '#f1.rear.700c.35.0.14.55.26.55.8.120.100.15.70.20.2.160.100.zip.a4.1.0.0.1';
    const decoded = decodeConfig(oldStyleHash);
    expect(decoded.bevel).toBe(DEFAULTS.bevel);
    expect(decoded.hem).toBe(true);
    expect(decoded.side).toBe('rear');
    expect(decoded).toEqual({ ...DEFAULTS, hem: true });
  });

  it('carries `thick` as tenths so no field contains a "."', () => {
    const config: FenderConfig = { ...DEFAULTS, thick: 1.2, hem: true };
    const encoded = encodeConfig(config);
    // Every field is its own '.'-separated token — none of them may itself contain a dot.
    expect(encoded.split('.')).toContain('12'); // thick, encoded as tenths
    expect(decodeConfig(encoded).thick).toBe(1.2);
  });
});

describe('decodeConfig — hostile input never throws and always yields finite geometry', () => {
  const HOSTILE: [string, string][] = [
    ['empty string', ''],
    ['bare hash', '#'],
    ['wrong version', '#f2.rear.700c.35.0.14.55.26.55.8.40.175.15.70.20.2.160.100.zip.a4.1.0.0.0'],
    ['too few fields', '#f1.rear'],
    ['far too many fields', `#f1.${Array(60).fill('1').join('.')}`],
    ['NaN token', '#f1.rear.700c.NaN'],
    ['Infinity token', '#f1.rear.700c.Infinity'],
    ['negative number', '#f1.rear.700c.-1'],
    ['overflowing exponent', '#f1.rear.700c.1e999'],
    ['huge out-of-range number', '#f1.rear.700c.999999999'],
    ['unknown enum value', '#f1.diagonal.700c.35'],
    ['unknown join', '#f1.rear.700c.35.0.14.55.26.55.8.40.175.15.70.20.2.160.100.launch-into-space'],
    ['injected script tag', '#f1.<script>alert(1)</script>.700c'],
    ['10000-char garbage', `#f1.${'x'.repeat(10000)}`],
    ['unicode', '#f1.後輪.700c.🚲.０'],
    ['only a version, no fields', '#f1'],
    ['trailing dot', '#f1.rear.']
  ];

  it.each(HOSTILE)('%s', (_label, hash) => {
    let decoded: FenderConfig | undefined;
    expect(() => {
      decoded = decodeConfig(hash);
    }).not.toThrow();
    expect(decoded).toBeDefined();
    // Every field must be one of the shapes FenderConfig allows — never undefined/NaN.
    for (const key of CONFIG_ORDER) {
      expect(decoded![key]).not.toBeUndefined();
    }
    assertFiniteGeometry(decoded!);
  });

  it('an empty string decodes to DEFAULTS exactly (wrong "version": "")', () => {
    expect(decodeConfig('')).toEqual(DEFAULTS);
    expect(decodeConfig('#')).toEqual(DEFAULTS);
  });
});

describe('decodeConfig — clamping is per-field, not a blanket range', () => {
  it('clamps only the out-of-range field, leaving valid neighbours intact', () => {
    const tyreSpec = PARAM_SPECS.tyre;
    if (tyreSpec.kind !== 'number') throw new Error('tyre spec is expected to be numeric');

    // tyre (3rd field) way out of range; clear (5th field) validly non-default.
    const hash = '#f1.rear.700c.99999.0.30';
    const decoded = decodeConfig(hash);
    expect(decoded.tyre).toBe(tyreSpec.max);
    expect(decoded.clear).toBe(30); // untouched by tyre's clamp
    expect(decoded.side).toBe('rear');
    expect(decoded.wheel).toBe('700c');
  });

  it('clamps a negative number up to that field\'s own min', () => {
    const hash = '#f1.rear.700c.-500';
    expect(decodeConfig(hash).tyre).toBe(20); // tyre min per PARAM_SPECS
  });

  it('snaps an off-grid value to the nearest step', () => {
    // lead: min 0, max 160, step 5. 43 should snap to 45.
    const hash = `#f1.${'rear'}.${'700c'}.${'35'}.${'0'}.${'14'}.${'55'}.${'26'}.${'55'}.${'8'}.43`;
    expect(decodeConfig(hash).lead).toBe(45);
  });

  it('clamps thick after converting from tenths, not before', () => {
    // thick max is 4mm -> 40 tenths. Token 999 tenths = 99.9mm, way over.
    const hash =
      '#f1.rear.700c.35.0.14.55.26.55.999';
    expect(decodeConfig(hash).thick).toBe(4);
  });

  it('rejects an unknown enum for one field without corrupting the rest', () => {
    const hash = '#f1.rear.700c.35.0.14.55.26.55.8.40.175.15.70.20.2.160.100.not-a-join.a4.1.0.0.0';
    const decoded = decodeConfig(hash);
    expect(decoded.join).toBe(DEFAULTS.join);
    expect(decoded.stock).toBe('a4');
    expect(decoded.tongue).toBe(true);
  });

  it('falls back a malformed boolean token to that field\'s default', () => {
    const hash = '#f1.rear.700c.35.0.14.55.26.55.8.40.175.15.70.20.2.160.100.zip.a4.yes';
    expect(decodeConfig(hash).tongue).toBe(DEFAULTS.tongue);
  });
});

describe('decodeConfig — feeds buildModel() finite geometry for every golden + preset + hostile config', () => {
  it.each(GOLDEN_CONFIGS)('golden config round-trip stays finite', (config) => {
    assertFiniteGeometry(decodeConfig(encodeConfig(config)));
  });

  it.each(PRESETS.map((p) => p.config))('preset round-trip stays finite', (config) => {
    assertFiniteGeometry(decodeConfig(encodeConfig(config)));
  });
});
