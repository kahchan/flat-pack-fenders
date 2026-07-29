import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { DEFAULTS } from '../defaults';
import { buildWarnings } from '../warnings';
import type { FenderConfig } from '../types';

/**
 * warnings.ts had zero coverage before this file. golden.json's `warnings` array is a
 * verbatim transcription of the source's seven `if` checks (renderVals() lines
 * ~986–994) — comparing against it, rather than re-deriving the conditions here, is what
 * keeps this test from being circular.
 */

type WarningFixture = { text: string };
type Case = { config: FenderConfig; warnings: WarningFixture[] };

const CASES = Object.entries(golden as unknown as Record<string, Case>);

/** Fixed by source condition order — every case's warnings are a subsequence of this. */
const ID_ORDER = [
  'coverage-exceeds-frame',
  'radius-estimated',
  'tail-narrower-than-tyre',
  'darts-too-wide',
  'skirt-too-short',
  'single-blank-too-long',
  'sheet-b-too-wide'
];

describe.each(CASES)('buildWarnings(%s)', (_name, c) => {
  const warnings = buildWarnings(c.config);

  it('warning text matches the design source, in condition order', () => {
    expect(warnings.map((w) => w.text)).toEqual(c.warnings.map((w) => w.text));
  });

  it('ids are a subsequence of the fixed condition order, each at most once', () => {
    const ids = warnings.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);

    let cursor = -1;
    for (const id of ids) {
      const idx = ID_ORDER.indexOf(id);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });
});

describe('warnings invariants', () => {
  it('ids are unique across all cases and drawn only from the stable id set', () => {
    const allIds = new Set<string>();
    for (const [, c] of CASES) {
      for (const w of buildWarnings(c.config)) {
        expect(ID_ORDER).toContain(w.id);
        allIds.add(w.id);
      }
    }
    // Sanity check the fixture actually exercises more than one condition.
    expect(allIds.size).toBeGreaterThan(1);
  });

  // PLAN §9.5 — load-bearing: the whole point of the new default is that it trips
  // exactly the one warning a fresh user should see, not a wall of red.
  it('the default config produces exactly one warning, and it is radius-estimated', () => {
    const warnings = buildWarnings(DEFAULTS);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.id).toBe('radius-estimated');
  });
});
