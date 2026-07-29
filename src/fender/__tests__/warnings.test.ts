import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { DEFAULTS } from '../defaults';
import { buildWarnings } from '../warnings';
import { buildParts } from '../parts';
import { PW } from '../defaults';
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
    // sheet-b-too-wide deliberately diverges — it now reports whichever dimension
    // overflows, and the fixture records the design's width-only wording. PLAN §9.18.
    const ours = warnings.filter((w) => w.id !== 'sheet-b-too-wide').map((w) => w.text);
    const theirs = c.warnings.map((w) => w.text).filter((t) => !t.startsWith('Sheet B is'));
    expect(ours).toEqual(theirs);
  });

  it('the Sheet B warning names the dimension that actually overflows (PLAN §9.18)', () => {
    const w = warnings.find((x) => x.id === 'sheet-b-too-wide');
    const parts = buildParts(c.config);
    if (parts.fitsA4) {
      expect(w).toBeUndefined();
      return;
    }
    expect(w).toBeDefined();
    if (parts.width > PW) expect(w!.text).toContain('Shorten the struts');
    else expect(w!.text).toMatch(/\d+ mm tall/);
    // Advice must match the failure: struts do not help a sheet that is merely too tall.
    if (parts.width <= PW) expect(w!.text).not.toContain('Shorten the struts');
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

  it('the default ALSO warns that Sheet B will not print 1:1 — see PLAN §9.18', () => {
    // Not a regression and not something to tune away: with 2 struts and a 100 mm
    // mudflap, Sheet B is 220 mm tall against 172 mm of live page. It cannot fit, and no
    // sensible default makes it fit (the ceiling is a ~52 mm mudflap). The design hid
    // this by scaling the sheet to 78% while reporting a 1:1 fit.
    //
    // Delete this test when Sheet B paginates like Sheet A; until then it documents a
    // known, surfaced limitation rather than letting it rot into folklore.
    const ids = buildWarnings(DEFAULTS).map((w) => w.id);
    expect(ids).toContain('sheet-b-too-wide');
  });
});
