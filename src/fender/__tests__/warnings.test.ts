import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { DEFAULTS } from '../defaults';
import { buildWarnings } from '../warnings';
import { buildParts } from '../parts';
import { PW } from '../defaults';
import type { FenderConfig } from '../types';

/** Every golden fixture's longest strut is well under PW, so none of them trip the
 * new (PLAN §12) `sheet-b-too-wide` condition — a single part too long for a page in
 * either orientation. This constant is used to build a config that deliberately does. */
const TOO_LONG_STRUT = PW + 10;

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
    // sheet-b-too-wide deliberately diverges — it now reports whichever dimension
    // overflows, and the fixture records the design's width-only wording. PLAN §9.18.
    const ours = warnings.filter((w) => w.id !== 'sheet-b-too-wide').map((w) => w.text);
    const theirs = c.warnings.map((w) => w.text).filter((t) => !t.startsWith('Sheet B is'));
    expect(ours).toEqual(theirs);
  });

  it('sheet-b-too-wide only fires when a part cannot fit a page in either orientation (PLAN §12)', () => {
    const w = warnings.find((x) => x.id === 'sheet-b-too-wide');
    const parts = buildParts(c.config);
    expect(parts.oversizedParts.length > 0).toBe(w !== undefined);
    // None of the fixture configs actually need this — needing a second packed page
    // (which several of them do) is no longer warning-worthy on its own.
    if (parts.pages.length > 1) expect(parts.oversizedParts).toEqual([]);
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
  it('the default config raises exactly one warning about the fender itself', () => {
    // PLAN §9.5 chose this default so a first-time visitor is not met by a wall of red.
    // The one geometry warning that survives is "measure your tyre", which is the only
    // one the user can act on and the largest single error in the pattern.
    const ids = buildWarnings(DEFAULTS).map((w) => w.id);
    expect(ids).toContain('radius-estimated');
    expect(ids.filter((id) => id !== 'sheet-b-too-wide')).toEqual(['radius-estimated']);
  });

  // PLAN §12 — Sheet B now packs the default's two struts + mudflap onto one page, so
  // the §9.18 companion test that used to live here (asserting the default ALSO raised
  // `sheet-b-too-wide`) no longer applies and is deleted, per PLAN §12's own acceptance
  // criteria: "the default config packs onto one page and raises only radius-estimated".
  it('sheet-b-too-wide fires for a strut longer than the print page in any orientation', () => {
    const tooLong: FenderConfig = { ...DEFAULTS, strutLen: TOO_LONG_STRUT };
    const parts = buildParts(tooLong);
    expect(parts.oversizedParts.length).toBeGreaterThan(0);
    const ids = buildWarnings(tooLong).map((w) => w.id);
    expect(ids).toContain('sheet-b-too-wide');
  });

  it('needing a second packed page alone does not warn', () => {
    // rivet-join's fixture config (19 butt straps) is the fixture most likely to need a
    // second page; confirm that alone doesn't raise sheet-b-too-wide.
    const rivetCase = CASES.find(([name]) => name === 'rivet-join')![1];
    const parts = buildParts(rivetCase.config);
    const ids = buildWarnings(rivetCase.config).map((w) => w.id);
    if (parts.pages.length > 1) expect(ids).not.toContain('sheet-b-too-wide');
  });
});
