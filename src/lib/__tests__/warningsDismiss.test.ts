import { describe, expect, it } from 'vitest';
import { hasVisibleWarnings, warningsKey } from '../warningsDismiss';
import type { Warning } from '../../fender/types';

const W = (id: string): Warning => ({ id, text: `text for ${id}` });

describe('warningsKey', () => {
  it('joins ids, not text', () => {
    expect(warningsKey([W('a'), W('b')])).toBe('a|b');
  });

  it('is empty for no warnings', () => {
    expect(warningsKey([])).toBe('');
  });
});

describe('hasVisibleWarnings', () => {
  it('is false when there are no warnings', () => {
    expect(hasVisibleWarnings([], '')).toBe(false);
  });

  it('is true when warnings exist and nothing is dismissed', () => {
    expect(hasVisibleWarnings([W('a')], '')).toBe(true);
  });

  it('is false once the current warning set has been dismissed', () => {
    const warnings = [W('a'), W('b')];
    expect(hasVisibleWarnings(warnings, warningsKey(warnings))).toBe(false);
  });

  it('re-surfaces when the id set changes even if the dismissed key is stale', () => {
    const dismissed = warningsKey([W('a')]);
    expect(hasVisibleWarnings([W('a'), W('c')], dismissed)).toBe(true);
  });

  it('does NOT re-surface when only prose changes but ids match — PLAN §9.8', () => {
    const dismissed = warningsKey([{ id: 'a', text: 'old wording' }]);
    expect(hasVisibleWarnings([{ id: 'a', text: 'new wording' }], dismissed)).toBe(false);
  });
});
