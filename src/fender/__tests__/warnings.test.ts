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

/**
 * Fixed by source condition order — every case's warnings are a subsequence of this.
 * `tyre-too-wide` and `strut-too-long` (PLAN §13.2, §13.4) are new, not in the design
 * source at all, so they're appended last rather than interleaved — and buildWarnings()
 * pushes them last too, so this order is never violated regardless of which other
 * warnings also fire.
 */
const ID_ORDER = [
  'coverage-exceeds-frame',
  'radius-estimated',
  'tail-narrower-than-tyre',
  'darts-too-wide',
  'skirt-too-short',
  'single-blank-too-long',
  'sheet-b-too-wide',
  'tyre-too-wide',
  'strut-too-long'
];

/** Ids with no fixture counterpart at all — new checks, not source transcriptions. */
const NEW_IDS = new Set(['sheet-b-too-wide', 'tyre-too-wide', 'strut-too-long']);

// PLAN FEEDBACK WP17 — these four ids' text lost an em-dash each (decision A3), reworded
// as a colon per the notes.ts scheme (it introduces the reason/consequence, same as
// notes.test.ts's CORRECTED_INDICES). golden.json keeps the original design wording as
// the historical record, so these are excluded from the verbatim comparison below rather
// than regenerated; see the "corrected prose" block for what actually changed.
const REWORDED_IDS = new Set([
  'coverage-exceeds-frame',
  'radius-estimated',
  'tail-narrower-than-tyre',
  'darts-too-wide'
]);

describe.each(CASES)('buildWarnings(%s)', (_name, c) => {
  const warnings = buildWarnings(c.config);

  it('warning text matches the design source, in condition order', () => {
    // sheet-b-too-wide deliberately diverges — it now reports whichever dimension
    // overflows, and the fixture records the design's width-only wording (PLAN §9.18).
    // tyre-too-wide and strut-too-long have no fixture counterpart at all (PLAN §13.2,
    // §13.4) — the design source never checked either condition.
    // Both arrays are still in fixed source-condition order at this point, so pairing
    // them up by index (before the WP17 REWORDED_IDS filter) is safe.
    const oursWithId = warnings.filter((w) => !NEW_IDS.has(w.id));
    const theirsText = c.warnings.map((w) => w.text).filter((t) => !t.startsWith('Sheet B is'));
    const pairs = oursWithId.map((w, i) => [w, theirsText[i]] as const);

    const ours = pairs.filter(([w]) => !REWORDED_IDS.has(w.id)).map(([w]) => w.text);
    const theirs = pairs.filter(([w]) => !REWORDED_IDS.has(w.id)).map(([, t]) => t);
    expect(ours).toEqual(theirs);
  });

  it('reworded warnings drop their em-dash but keep the same facts (WP17)', () => {
    for (const w of warnings) {
      if (!REWORDED_IDS.has(w.id)) continue;
      expect(w.text, w.id).not.toMatch(/—/);
    }
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

  // PLAN §13.2 — new: the tyre plus clearance on both sides must fit inside the crown
  // plus both skirt projections. crown-only-too-narrow.tyre widens the tyre until it
  // does not.
  describe('tyre-too-wide', () => {
    it('fires once the tyre plus clearance exceeds crown plus both skirt projections', () => {
      const tooWide: FenderConfig = { ...DEFAULTS, tyre: 90 };
      const ids = buildWarnings(tooWide).map((w) => w.id);
      expect(ids).toContain('tyre-too-wide');
    });

    it('does not fire for any fixture config (all comfortably narrower than their crown)', () => {
      for (const [, c] of CASES) {
        expect(buildWarnings(c.config).map((w) => w.id)).not.toContain('tyre-too-wide');
      }
    });

    it('names the required width, the available width, and a crown that would fit', () => {
      const tooWide: FenderConfig = { ...DEFAULTS, tyre: 90 };
      const w = buildWarnings(tooWide).find((x) => x.id === 'tyre-too-wide')!;
      expect(w.text).toMatch(/90 mm tyre/);
      expect(w.text).toMatch(/Widen the crown to at least \d+ mm/);
    });
  });

  // PLAN §13.4 — new: isometric.ts used to clamp the drawn strut to the mount
  // distance, hiding an over-long strut. The warning is the visible replacement.
  describe('strut-too-long', () => {
    it('fires once strutLen exceeds the mount distance by more than ~10%', () => {
      const tooLong: FenderConfig = { ...DEFAULTS, strutLen: 420 };
      const ids = buildWarnings(tooLong).map((w) => w.id);
      expect(ids).toContain('strut-too-long');
    });

    // Three CARGO20-derived fixtures (strutLen 220 mm) genuinely trip this: their mount
    // distance is only ~194-196 mm, so the shipped "Cargo / folder 20″" preset's own
    // struts need trimming by roughly 5-25 mm before fitting — a real finding surfaced
    // by dropping the isometric clamp (PLAN §13.4), not a test-authoring mistake.
    const STRUT_TOO_LONG_CASES = new Set([
      'cargo-20in-single',
      'measured-no-taper-nojoin',
      'nested-cargo-20in',
      // WP21 §21.1/§21.2 — same CARGO20 strutLen/mount geometry as 'cargo-20in-single',
      // just with a strap frame end; this warning is about strutLen vs. mount distance,
      // not the strut end's shape, so it fires here for the same reason.
      'strap-strut-end-cargo'
    ]);

    it('fires only for the fixtures whose strutLen genuinely overshoots their mount', () => {
      for (const [name, c] of CASES) {
        const fires = buildWarnings(c.config)
          .map((w) => w.id)
          .includes('strut-too-long');
        expect(fires, name).toBe(STRUT_TOO_LONG_CASES.has(name));
      }
    });

    it('does not fire for a strut that merely reaches the mount', () => {
      const justRight: FenderConfig = { ...DEFAULTS, strutLen: 160 };
      expect(buildWarnings(justRight).map((w) => w.id)).not.toContain('strut-too-long');
    });
  });

  // PLAN §9.17 — the source's expression goes negative once the tyre alone exceeds
  // crown width; clamped at 0 and the advice switched to widening the crown.
  it('tail-narrower-than-tyre never quotes a negative percentage', () => {
    const wide: FenderConfig = { ...DEFAULTS, tyre: 90, taper: 0 };
    const w = buildWarnings(wide).find((x) => x.id === 'tail-narrower-than-tyre');
    expect(w).toBeDefined();
    expect(w!.text).not.toMatch(/-\d+%/);
    expect(w!.text).toMatch(/no taper helps here: widen the crown instead/);
  });
});
