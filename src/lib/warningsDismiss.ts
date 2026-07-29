import type { Warning } from '../fender/types';

/**
 * PLAN §9.8: dismissal keys on stable `Warning.id`s, not the joined prose the design
 * source used — so a wording tweak alone can't silently un-dismiss (or a wording tweak
 * that changes nothing meaningful can't spuriously re-surface) the banner.
 */
export function warningsKey(warnings: Warning[]): string {
  return warnings.map((w) => w.id).join('|');
}

/** The banner is visible whenever there are warnings the current dismissal doesn't cover. */
export function hasVisibleWarnings(warnings: Warning[], dismissedKey: string): boolean {
  return warnings.length > 0 && dismissedKey !== warningsKey(warnings);
}
